import logging

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import archive_client
from app.db import get_db
from app.models import Artist
from app.scheduler import poll_artist
from app.templating import templates

log = logging.getLogger("concertarr.artists")

router = APIRouter(prefix="/artists")

DEFAULT_QUERY_TEMPLATE = 'creator:("{name}") AND mediatype:(audio)'


@router.get("")
def list_artists(request: Request, db: Session = Depends(get_db)):
    artists = db.query(Artist).order_by(Artist.name).all()
    return templates.TemplateResponse(request, "artists.html", {"artists": artists})


@router.get("/new")
def new_artist_form(request: Request):
    return templates.TemplateResponse(
        request, "artist_new.html", {"name": "", "query": "", "results": None}
    )


@router.post("/preview")
def preview_artist(
    request: Request,
    name: str = Form(...),
    query: str = Form(""),
):
    effective_query = query.strip() or DEFAULT_QUERY_TEMPLATE.format(name=name)
    try:
        results = archive_client.search_items(effective_query, rows=20)
        error = None
    except Exception as exc:  # noqa: BLE001
        results = []
        error = str(exc)
    return templates.TemplateResponse(
        request,
        "artist_new.html",
        {"name": name, "query": effective_query, "results": results, "error": error},
    )


@router.post("")
def create_artist(
    name: str = Form(...),
    query: str = Form(""),
    db: Session = Depends(get_db),
):
    effective_query = query.strip() or DEFAULT_QUERY_TEMPLATE.format(name=name)
    artist = Artist(name=name.strip(), query=effective_query, enabled=True)
    db.add(artist)
    db.commit()
    db.refresh(artist)
    poll_artist(artist.id)
    return RedirectResponse(url=f"/artists/{artist.id}", status_code=303)


@router.get("/{artist_id}")
def artist_detail(artist_id: int, request: Request, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    return templates.TemplateResponse(request, "artist_detail.html", {"artist": artist})


@router.post("/{artist_id}/check")
def check_artist(artist_id: int):
    poll_artist(artist_id)
    return RedirectResponse(url=f"/artists/{artist_id}", status_code=303)


@router.post("/{artist_id}/toggle")
def toggle_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist:
        artist.enabled = not artist.enabled
        db.commit()
    return RedirectResponse(url=f"/artists/{artist_id}", status_code=303)


@router.post("/{artist_id}/delete")
def delete_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)
    if artist:
        db.delete(artist)
        db.commit()
    return RedirectResponse(url="/artists", status_code=303)
