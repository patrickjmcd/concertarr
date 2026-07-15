import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import archive_client
from app.db import get_db
from app.heuristics import looks_like_concert
from app.models import Artist, Concert
from app.scheduler import queue_download
from app.schemas import AJDownloadRequest, AJShowItem, AJShowsOut, ConcertOut

log = logging.getLogger("concertarr.aadamjacobs")

router = APIRouter(prefix="/api/aadamjacobs")

DEFAULT_ARTIST_QUERY_TEMPLATE = 'creator:("{name}") AND mediatype:(audio)'

# "recent" sorts by when the item was added to archive.org (addeddate);
# "date" sorts by the show's own date; "popularity" uses archive.org's
# per-item download count. "recent" and "date" support toggling direction;
# "popularity" always sorts most-popular-first regardless of direction.
SORT_FIELDS = {
    "recent": "addeddate",
    "date": "date",
    "popularity": "downloads",
}


@router.get("/shows", response_model=AJShowsOut)
def aadam_jacobs_shows(
    q: str = "",
    page: int = 1,
    rows: int = 30,
    sort: str = "recent",
    direction: str = "desc",
    db: Session = Depends(get_db),
):
    term = q.strip()
    query = (
        f"creator:({term}*) AND {archive_client.AADAM_JACOBS_QUERY}"
        if term
        else archive_client.AADAM_JACOBS_QUERY
    )
    field = SORT_FIELDS.get(sort, SORT_FIELDS["recent"])
    dir_ = direction if direction in ("asc", "desc") else "desc"
    archive_sort = f"{field} {dir_}"
    try:
        docs, total_found = archive_client.search(query, rows=rows, page=page, sort=archive_sort)
        error = None
    except Exception as exc:  # noqa: BLE001
        log.warning("Aadam Jacobs shows search failed for %r: %s", term, exc)
        docs, total_found, error = [], 0, str(exc)

    identifiers = [d.get("identifier") for d in docs if d.get("identifier")]
    concerts_by_identifier = (
        {c.identifier: c for c in db.query(Concert).filter(Concert.identifier.in_(identifiers)).all()}
        if identifiers
        else {}
    )
    monitored_names = {a.name.strip().lower() for a in db.query(Artist).all()}

    items = []
    for d in docs:
        identifier = d.get("identifier")
        if not identifier:
            continue
        creator = archive_client.normalize_creator(d.get("creator"))
        concert = concerts_by_identifier.get(identifier)
        items.append(
            AJShowItem(
                identifier=identifier,
                title=d.get("title", identifier),
                date=(d.get("date") or "")[:10] or None,
                added_date=(d.get("addeddate") or "")[:10] or None,
                creator=creator,
                venue=d.get("venue"),
                likely_concert=looks_like_concert(d.get("title")),
                source=archive_client.source_string(d.get("collection")),
                monitored=(creator or "").strip().lower() in monitored_names,
                concert_id=concert.id if concert else None,
                status=concert.status if concert else None,
                downloads=int(d["downloads"]) if d.get("downloads") is not None else None,
            )
        )
    return AJShowsOut(items=items, total_found=total_found, error=error)


@router.post("/download", response_model=ConcertOut)
def aadam_jacobs_download(payload: AJDownloadRequest, db: Session = Depends(get_db)):
    """Download a single show without setting up full artist monitoring.

    Reuses an existing Artist row by name if one is already being monitored;
    otherwise creates a disabled/non-auto-downloading one purely to own the
    Concert record, so the periodic poller doesn't silently start pulling
    this artist's whole catalog.
    """
    creator = payload.creator.strip()
    artist = db.query(Artist).filter(func.lower(Artist.name) == creator.lower()).first()
    if artist is None:
        artist = Artist(
            name=creator,
            query=DEFAULT_ARTIST_QUERY_TEMPLATE.format(name=creator),
            enabled=False,
            auto_download=False,
        )
        db.add(artist)
        db.commit()
        db.refresh(artist)

    concert = (
        db.query(Concert)
        .filter(Concert.artist_id == artist.id, Concert.identifier == payload.identifier)
        .first()
    )
    if concert is None:
        concert = Concert(
            artist_id=artist.id,
            identifier=payload.identifier,
            title=payload.title or payload.identifier,
            show_date=payload.date,
            venue=payload.venue,
            collection=payload.collection,
            status="new",
        )
        db.add(concert)
        db.commit()
        db.refresh(concert)

    if concert.status == "new":
        queue_download(concert.id)

    return concert
