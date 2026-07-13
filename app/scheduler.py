import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app import archive_client, downloader
from app.config import settings
from app.db import SessionLocal
from app.downloader import NoMatchingFormatError
from app.models import Artist, Concert

log = logging.getLogger("concertarr.scheduler")

_executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_downloads)
_scheduler = BackgroundScheduler()


def process_concert(concert_id: int) -> None:
    """Download a single concert's audio files. Safe to call from any thread."""
    db = SessionLocal()
    try:
        concert = db.get(Concert, concert_id)
        if concert is None:
            return
        concert.status = "downloading"
        concert.error = None
        db.commit()

        try:
            fmt, dest_dir = downloader.download_concert(
                concert.artist.name, concert.identifier, concert.show_date, concert_id=concert_id
            )
        except NoMatchingFormatError as exc:
            concert.status = "failed"
            concert.error = str(exc)
            db.commit()
            log.warning("Concert %s: %s", concert.identifier, exc)
            return
        except Exception as exc:  # noqa: BLE001
            concert.status = "failed"
            concert.error = str(exc)
            db.commit()
            log.exception("Concert %s failed to download", concert.identifier)
            return

        concert.status = "downloaded"
        concert.format_used = fmt
        concert.download_path = dest_dir
        concert.downloaded_at = datetime.now(timezone.utc)
        db.commit()
        log.info("Concert %s downloaded to %s", concert.identifier, dest_dir)
    finally:
        db.close()


def queue_download(concert_id: int) -> None:
    _executor.submit(process_concert, concert_id)


def poll_artist(artist_id: int) -> int:
    """Search archive.org for new items matching one artist's query. Returns count of new concerts found.

    The first poll for an artist backfills their full back catalog (paginating
    up to settings.max_backfill_results) rather than just the most-recently-added
    page -- otherwise a prolific artist's older shows would never surface, since
    every later poll only looks at what's newest.
    """
    db = SessionLocal()
    try:
        artist = db.get(Artist, artist_id)
        if artist is None or not artist.enabled:
            return 0

        is_first_poll = artist.last_checked_at is None
        try:
            if is_first_poll:
                docs = archive_client.search_items_paginated(
                    artist.query, max_results=settings.max_backfill_results
                )
            else:
                docs = archive_client.search_items(artist.query)
        except Exception:  # noqa: BLE001
            log.exception("Search failed for artist %s (%s)", artist.name, artist.query)
            return 0

        known_identifiers = {
            c.identifier for c in db.query(Concert).filter(Concert.artist_id == artist.id).all()
        }

        new_count = 0
        new_ids: list[int] = []
        for doc in docs:
            identifier = doc.get("identifier")
            if not identifier or identifier in known_identifiers:
                continue
            concert = Concert(
                artist_id=artist.id,
                identifier=identifier,
                title=doc.get("title", identifier),
                show_date=(doc.get("date") or "")[:10] or None,
                venue=doc.get("venue"),
                collection=",".join(doc.get("collection", []))
                if isinstance(doc.get("collection"), list)
                else doc.get("collection"),
                status="new",
            )
            db.add(concert)
            db.flush()
            new_ids.append(concert.id)
            new_count += 1

        artist.last_checked_at = datetime.now(timezone.utc)
        auto_download = artist.auto_download
        db.commit()

        if auto_download:
            for concert_id in new_ids:
                queue_download(concert_id)

        return new_count
    finally:
        db.close()


def download_all_new(artist_id: int | None = None) -> int:
    """Queue every concert currently in 'new' status. Optionally scoped to one artist."""
    db = SessionLocal()
    try:
        query = db.query(Concert).filter(Concert.status == "new")
        if artist_id is not None:
            query = query.filter(Concert.artist_id == artist_id)
        concert_ids = [c.id for c in query.all()]
    finally:
        db.close()
    for concert_id in concert_ids:
        queue_download(concert_id)
    return len(concert_ids)


def download_selected(concert_ids: list[int]) -> int:
    """Queue a specific set of concerts, skipping any not currently in 'new' status."""
    db = SessionLocal()
    try:
        valid_ids = [
            c.id
            for c in db.query(Concert)
            .filter(Concert.id.in_(concert_ids), Concert.status == "new")
            .all()
        ]
    finally:
        db.close()
    for concert_id in valid_ids:
        queue_download(concert_id)
    return len(valid_ids)


def poll_all_artists() -> None:
    db = SessionLocal()
    try:
        artist_ids = [a.id for a in db.query(Artist).filter(Artist.enabled.is_(True)).all()]
    finally:
        db.close()
    for artist_id in artist_ids:
        poll_artist(artist_id)


def start_scheduler() -> None:
    if _scheduler.running:
        return
    _scheduler.add_job(
        poll_all_artists,
        "interval",
        minutes=settings.poll_interval_minutes,
        next_run_time=datetime.now(),
        id="poll_all_artists",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
