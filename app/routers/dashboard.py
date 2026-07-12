import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import archive_client
from app.db import get_db
from app.heuristics import looks_like_concert
from app.models import Artist, Concert
from app.schemas import ArtistOut, ConcertOut, ConcertWithArtistOut, DashboardOut, GlobalRecentItem

log = logging.getLogger("concertarr.dashboard")

router = APIRouter(prefix="/api/dashboard")

GLOBAL_RECENT_QUERY = archive_client.TAPER_COLLECTIONS_QUERY


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    artist_count = db.query(func.count(Artist.id)).scalar()
    status_counts = dict(
        db.query(Concert.status, func.count(Concert.id)).group_by(Concert.status).all()
    )
    recent_concerts = (
        db.query(Concert).order_by(Concert.discovered_at.desc()).limit(15).all()
    )
    artists = db.query(Artist).order_by(Artist.name).all()
    monitored_names = {a.name.strip().lower() for a in artists}

    try:
        docs = archive_client.search_items(GLOBAL_RECENT_QUERY, rows=15)
    except Exception:  # noqa: BLE001
        log.exception("Global recent feed search failed")
        docs = []

    recent_global = [
        GlobalRecentItem(
            identifier=d.get("identifier", ""),
            title=d.get("title", d.get("identifier", "")),
            date=(d.get("date") or "")[:10] or None,
            creator=d.get("creator") if isinstance(d.get("creator"), str) else None,
            monitored=(d.get("creator") or "").strip().lower() in monitored_names,
            likely_concert=looks_like_concert(d.get("title")),
            source=archive_client.source_string(d.get("collection")),
        )
        for d in docs
        if d.get("identifier")
    ]

    return DashboardOut(
        artist_count=artist_count,
        status_counts=status_counts,
        recent_concerts=[
            ConcertWithArtistOut(**ConcertOut.model_validate(c).model_dump(), artist_name=c.artist.name)
            for c in recent_concerts
        ],
        artists=[ArtistOut.model_validate(a) for a in artists],
        recent_global=recent_global,
    )
