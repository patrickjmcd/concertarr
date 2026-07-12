from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Artist, Concert
from app.schemas import ArtistOut, ConcertWithArtistOut, DashboardOut

router = APIRouter(prefix="/api/dashboard")


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

    return DashboardOut(
        artist_count=artist_count,
        status_counts=status_counts,
        recent_concerts=[
            ConcertWithArtistOut(**ConcertOut.model_validate(c).model_dump(), artist_name=c.artist.name)
            for c in recent_concerts
        ],
        artists=[ArtistOut.model_validate(a) for a in artists],
    )
