import logging
import os

from sqlalchemy.orm import Session

from app import archive_client, downloader
from app.models import Concert
from app.schemas import TrackItem, TrackListOut

log = logging.getLogger("concertarr.track_service")


def _track_sort_key(f: dict) -> tuple[int, str]:
    """Sort by the archive.org 'track' field (e.g. '01', '3/12') when present."""
    track = str(f.get("track") or "").split("/")[0]
    digits = "".join(ch for ch in track if ch.isdigit())
    return (int(digits) if digits else 9999, f.get("name", ""))


def find_concert_by_identifier(identifier: str, db: Session) -> Concert | None:
    return db.query(Concert).filter(Concert.identifier == identifier).first()


def track_list_for(identifier: str, db: Session) -> TrackListOut:
    """Build a track listing for any archive.org identifier.

    Streams from disk if a Concert row for this identifier has already been
    downloaded, regardless of which artist owns it; otherwise falls back to
    streaming directly from archive.org.
    """
    try:
        fmt, files = downloader.preview_tracks(identifier)
    except Exception as exc:  # noqa: BLE001
        log.warning("Track metadata fetch failed for %s: %s", identifier, exc)
        return TrackListOut(source="preview", tracks=[], error=str(exc))

    if fmt is None:
        return TrackListOut(source="preview", tracks=[], error="No matching audio format found")

    concert = find_concert_by_identifier(identifier, db)
    on_disk = bool(
        concert
        and concert.status == "downloaded"
        and concert.download_path
        and os.path.isdir(concert.download_path)
    )
    disk_sizes = {}
    if on_disk:
        for name in os.listdir(concert.download_path):
            path = os.path.join(concert.download_path, name)
            if os.path.isfile(path):
                disk_sizes[name] = os.path.getsize(path)

    tracks = [
        TrackItem(
            name=f["name"],
            title=f.get("title"),
            track_number=f.get("track"),
            length=f.get("length"),
            size_bytes=disk_sizes.get(f["name"], int(f["size"]) if f.get("size") else None),
            stream_url=(
                f"/api/archive/{identifier}/tracks/{f['name']}/stream"
                if f["name"] in disk_sizes
                else archive_client.download_url(identifier, f["name"])
            ),
        )
        for f in sorted(files, key=_track_sort_key)
    ]
    return TrackListOut(source="disk" if on_disk else "preview", format=fmt, tracks=tracks)


def resolve_local_file(identifier: str, filename: str, db: Session) -> str | None:
    """Resolve a downloaded track's on-disk path for this identifier, or None."""
    concert = find_concert_by_identifier(identifier, db)
    if concert is None or concert.status != "downloaded" or not concert.download_path:
        return None
    path = os.path.join(concert.download_path, os.path.basename(filename))
    return path if os.path.isfile(path) else None
