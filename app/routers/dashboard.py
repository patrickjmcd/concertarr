from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Artist, Concert
from app.templating import templates

router = APIRouter()


@router.get("/dashboard")
def dashboard(request: Request, db: Session = Depends(get_db)):
    artist_count = db.query(func.count(Artist.id)).scalar()
    status_counts = dict(
        db.query(Concert.status, func.count(Concert.id)).group_by(Concert.status).all()
    )
    recent_concerts = (
        db.query(Concert).order_by(Concert.discovered_at.desc()).limit(15).all()
    )
    artists = db.query(Artist).order_by(Artist.name).all()

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "artist_count": artist_count,
            "status_counts": status_counts,
            "recent_concerts": recent_concerts,
            "artists": artists,
        },
    )
