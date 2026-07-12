import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import archive_client
from app.db import get_db
from app.heuristics import looks_like_concert
from app.models import Artist
from app.schemas import (
    ArtistCreate,
    ArtistDetailOut,
    ArtistOut,
    ConcertOut,
    PreviewOut,
    SearchResultItem,
)
from app.scheduler import poll_artist

log = logging.getLogger("concertarr.artists")

router = APIRouter(prefix="/api/artists")

DEFAULT_QUERY_TEMPLATE = 'creator:("{name}") AND mediatype:(audio)'


@router.get("", response_model=list[ArtistOut])
def list_artists(db: Session = Depends(get_db)):
    artists = db.query(Artist).order_by(Artist.name).all()
    return artists


PREVIEW_ROWS = 100


@router.post("/preview", response_model=PreviewOut)
def preview_artist(payload: ArtistCreate):
    effective_query = payload.query.strip() or DEFAULT_QUERY_TEMPLATE.format(name=payload.name)
    try:
        docs, total_found = archive_client.search(effective_query, rows=PREVIEW_ROWS)
        results = [
            SearchResultItem(
                identifier=d.get("identifier", ""),
                title=d.get("title", ""),
                date=d.get("date"),
                likely_concert=looks_like_concert(d.get("title")),
            )
            for d in docs
        ]
        error = None
    except Exception as exc:  # noqa: BLE001
        results = []
        total_found = 0
        error = str(exc)
    return PreviewOut(query=effective_query, results=results, total_found=total_found, error=error)


@router.post("", response_model=ArtistOut)
def create_artist(payload: ArtistCreate, db: Session = Depends(get_db)):
    effective_query = payload.query.strip() or DEFAULT_QUERY_TEMPLATE.format(name=payload.name)
    artist = Artist(
        name=payload.name.strip(),
        query=effective_query,
        enabled=True,
        auto_download=payload.auto_download,
    )
    db.add(artist)
    db.commit()
    db.refresh(artist)
    poll_artist(artist.id)
    db.refresh(artist)
    return artist


@router.get("/{artist_id}", response_model=ArtistDetailOut)
def artist_detail(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return ArtistDetailOut(
        artist=ArtistOut.model_validate(artist),
        concerts=[ConcertOut.model_validate(c) for c in artist.concerts],
    )


@router.post("/{artist_id}/check", response_model=ArtistOut)
def check_artist(artist_id: int, db: Session = Depends(get_db)):
    poll_artist(artist_id)
    artist = db.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist


@router.post("/{artist_id}/toggle", response_model=ArtistOut)
def toggle_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    artist.enabled = not artist.enabled
    db.commit()
    db.refresh(artist)
    return artist


@router.post("/{artist_id}/toggle-auto-download", response_model=ArtistOut)
def toggle_auto_download(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    artist.auto_download = not artist.auto_download
    db.commit()
    db.refresh(artist)
    return artist


@router.delete("/{artist_id}")
def delete_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    db.delete(artist)
    db.commit()
    return {"ok": True}
