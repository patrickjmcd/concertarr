import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import archive_client, downloader
from app.db import get_db
from app.models import Concert
from app.scheduler import download_all_new, download_selected, queue_download
from app.schemas import ConcertOut, ConcertWithArtistOut, CountOut, TrackItem, TrackListOut

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


def _track_sort_key(f: dict) -> tuple[int, str]:
    """Sort by the archive.org 'track' field (e.g. '01', '3/12') when present."""
    track = str(f.get("track") or "").split("/")[0]
    digits = "".join(ch for ch in track if ch.isdigit())
    return (int(digits) if digits else 9999, f.get("name", ""))


@router.get("/{concert_id}/tracks", response_model=TrackListOut)
def concert_tracks(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")

    try:
        fmt, files = downloader.preview_tracks(concert.identifier)
    except Exception as exc:  # noqa: BLE001
        log.warning("Track metadata fetch failed for %s: %s", concert.identifier, exc)
        return TrackListOut(source="preview", tracks=[], error=str(exc))

    if fmt is None:
        return TrackListOut(source="preview", tracks=[], error="No matching audio format found")

    on_disk = bool(
        concert.status == "downloaded"
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
                f"/api/concerts/{concert_id}/tracks/{f['name']}/stream"
                if f["name"] in disk_sizes
                else archive_client.download_url(concert.identifier, f["name"])
            ),
        )
        for f in sorted(files, key=_track_sort_key)
    ]
    return TrackListOut(source="disk" if on_disk else "preview", format=fmt, tracks=tracks)


@router.get("/{concert_id}/tracks/{filename}/stream")
def stream_track(concert_id: int, filename: str, db: Session = Depends(get_db)):
    """Serve an already-downloaded track's audio file for in-app playback."""
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise HTTPException(status_code=404, detail="Concert not found")
    if concert.status != "downloaded" or not concert.download_path:
        raise HTTPException(status_code=404, detail="Track not available locally")

    path = os.path.join(concert.download_path, os.path.basename(filename))
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


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
