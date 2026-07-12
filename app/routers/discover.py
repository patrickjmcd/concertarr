import logging

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app import archive_client
from app.db import SessionLocal
from app.models import Artist
from app.schemas import DiscoverArtistItem, DiscoverArtistsOut

log = logging.getLogger("concertarr.discover")

router = APIRouter(prefix="/api/discover")

BROWSE_QUERY = archive_client.TAPER_COLLECTIONS_QUERY


def _search_query_for(term: str) -> str:
    return f"creator:({term}*) AND {archive_client.TAPER_COLLECTIONS_QUERY}"


def _normalize_creator(creator) -> str | None:
    if isinstance(creator, str) and creator.strip():
        return creator.strip()
    if isinstance(creator, list):
        for c in creator:
            if isinstance(c, str) and c.strip():
                return c.strip()
    return None


def _aggregate_by_creator(docs: list[dict], limit: int) -> list[DiscoverArtistItem]:
    db: Session = SessionLocal()
    try:
        monitored_names = {a.name.strip().lower() for a in db.query(Artist).all()}
    finally:
        db.close()

    counts: dict[str, dict] = {}
    for doc in docs:
        creator = _normalize_creator(doc.get("creator"))
        if creator is None:
            continue
        key = creator.lower()
        if key not in counts:
            counts[key] = {
                "name": creator,
                "count": 0,
                "sample_identifier": doc.get("identifier", ""),
                "sample_title": doc.get("title", ""),
            }
        counts[key]["count"] += 1

    items = [
        DiscoverArtistItem(
            name=v["name"],
            count=v["count"],
            sample_identifier=v["sample_identifier"],
            sample_title=v["sample_title"],
            monitored=v["name"].lower() in monitored_names,
        )
        for v in counts.values()
    ]
    items.sort(key=lambda i: i.count, reverse=True)
    return items[:limit]


@router.get("/artists", response_model=DiscoverArtistsOut)
def discover_artists(q: str = ""):
    term = q.strip()
    query = _search_query_for(term) if term else BROWSE_QUERY
    try:
        docs = archive_client.search_items(query, rows=150)
        error = None
    except Exception as exc:  # noqa: BLE001
        log.warning("Discover search failed for %r: %s", term, exc)
        docs = []
        error = str(exc)

    artists = _aggregate_by_creator(docs, limit=30)
    return DiscoverArtistsOut(query=query, artists=artists, error=error)
