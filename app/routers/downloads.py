from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import progress
from app.db import get_db
from app.models import Concert
from app.schemas import DownloadProgressItem

router = APIRouter(prefix="/api/downloads")


@router.get("/active", response_model=list[DownloadProgressItem])
def active_downloads(db: Session = Depends(get_db)):
    snapshot = progress.snapshot()
    if not snapshot:
        return []

    concerts = {
        c.id: c for c in db.query(Concert).filter(Concert.id.in_(snapshot.keys())).all()
    }
    items = []
    for concert_id, p in snapshot.items():
        concert = concerts.get(concert_id)
        if concert is None:
            continue
        items.append(
            DownloadProgressItem(
                concert_id=concert_id,
                artist_name=concert.artist.name,
                title=concert.title,
                identifier=concert.identifier,
                bytes_done=p["bytes_done"],
                bytes_total=p["bytes_total"],
                current_file=p["current_file"],
            )
        )
    return items
