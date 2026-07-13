import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import track_service
from app.db import get_db
from app.models import Concert
from app.scheduler import download_all_new, download_selected, queue_download
from app.schemas import ConcertOut, ConcertWithArtistOut, CountOut, TrackListOut

log = logging.getLogger("concertarr.concerts")

router = APIRouter(prefix="/api/concerts")


class DownloadSelectedRequest(BaseModel):
    concert_ids: list[int] = []


class DownloadAllRequest(BaseModel):
    artist_id: int | None = None


@router.get("", response_model=list[ConcertWithArtistOut])
def list_concerts(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Concert).order_by(Concert.discovered_at.desc())
    if status:
        query = query.filter(Concert.status == status)
    concerts = query.limit(200).all()
    return [
        ConcertWithArtistOut(**ConcertOut.model_validate(c).model_dump(), artist_name=c.artist.name)
        for c in concerts
    ]


@router.get("/{concert_id}", response_model=ConcertWithArtistOut)
def concert_detail(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    return ConcertWithArtistOut(
        **ConcertOut.model_validate(concert).model_dump(), artist_name=concert.artist.name
    )


@router.get("/{concert_id}/tracks", response_model=TrackListOut)
def concert_tracks(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    return track_service.track_list_for(concert.identifier, db)


@router.post("/{concert_id}/retry", response_model=ConcertOut)
def retry_concert(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    concert.status = "new"
    concert.error = None
    db.commit()
    queue_download(concert_id)
    db.refresh(concert)
    return concert


@router.post("/{concert_id}/download", response_model=ConcertOut)
def download_one(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    if concert.status == "new":
        queue_download(concert_id)
    return concert


@router.post("/download-selected", response_model=CountOut)
def download_selected_concerts(payload: DownloadSelectedRequest):
    count = download_selected(payload.concert_ids)
    return CountOut(count=count)


@router.post("/download-all-new", response_model=CountOut)
def download_all_new_concerts(payload: DownloadAllRequest):
    count = download_all_new(artist_id=payload.artist_id)
    return CountOut(count=count)
