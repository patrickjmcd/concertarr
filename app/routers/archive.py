from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import archive_client, track_service
from app.db import get_db
from app.heuristics import looks_like_concert
from app.models import Artist, Concert
from app.schemas import AJShowItem, TrackListOut

router = APIRouter(prefix="/api/archive")


@router.get("/{identifier}", response_model=AJShowItem)
def archive_show(identifier: str, db: Session = Depends(get_db)):
    """Show metadata for any archive.org identifier, monitored or not.

    Backs the show-detail page linked from browse feeds (e.g. the Aadam
    Jacobs page) for shows that don't have a Concert row yet.
    """
    try:
        metadata = archive_client.get_metadata(identifier).get("metadata") or {}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"Could not fetch {identifier}: {exc}") from exc
    if not metadata:
        raise HTTPException(status_code=404, detail="Show not found")

    creator = archive_client.normalize_creator(metadata.get("creator"))
    concert = db.query(Concert).filter(Concert.identifier == identifier).first()
    monitored = bool(
        creator and db.query(Artist).filter(func.lower(Artist.name) == creator.lower()).first()
    )
    downloads = metadata.get("downloads")
    return AJShowItem(
        identifier=identifier,
        title=metadata.get("title", identifier),
        date=(metadata.get("date") or "")[:10] or None,
        creator=creator,
        venue=metadata.get("venue"),
        likely_concert=looks_like_concert(metadata.get("title")),
        source=archive_client.source_string(metadata.get("collection")),
        monitored=monitored,
        concert_id=concert.id if concert else None,
        status=concert.status if concert else None,
        downloads=int(downloads) if downloads is not None else None,
    )


@router.get("/{identifier}/tracks", response_model=TrackListOut)
def archive_tracks(identifier: str, db: Session = Depends(get_db)):
    """Track listing for any archive.org identifier, not just a monitored Concert."""
    return track_service.track_list_for(identifier, db)


@router.get("/{identifier}/tracks/{filename}/stream")
def archive_track_stream(identifier: str, filename: str, db: Session = Depends(get_db)):
    """Serve an already-downloaded track's audio file for in-app playback."""
    path = track_service.resolve_local_file(identifier, filename, db)
    if path is None:
        raise HTTPException(status_code=404, detail="Track not available locally")
    return FileResponse(path)
