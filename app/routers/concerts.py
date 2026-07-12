from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Concert
from app.scheduler import download_all_new, download_selected, queue_download
from app.templating import templates

router = APIRouter(prefix="/concerts")


@router.get("")
def list_concerts(request: Request, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Concert).order_by(Concert.discovered_at.desc())
    if status:
        query = query.filter(Concert.status == status)
    concerts = query.limit(200).all()
    return templates.TemplateResponse(
        request, "concerts.html", {"concerts": concerts, "status_filter": status}
    )


@router.get("/{concert_id}")
def concert_detail(concert_id: int, request: Request, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    return templates.TemplateResponse(request, "concert_detail.html", {"concert": concert})


@router.post("/{concert_id}/retry")
def retry_concert(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert:
        concert.status = "new"
        concert.error = None
        db.commit()
        queue_download(concert_id)
    return RedirectResponse(url=f"/concerts/{concert_id}", status_code=303)


@router.post("/{concert_id}/download")
def download_one(concert_id: int, db: Session = Depends(get_db)):
    concert = db.get(Concert, concert_id)
    if concert and concert.status == "new":
        queue_download(concert_id)
    return RedirectResponse(url=f"/concerts/{concert_id}", status_code=303)


def _redirect_target(artist_id: int | None, status_filter: str | None) -> str:
    if artist_id is not None:
        return f"/artists/{artist_id}"
    if status_filter:
        return f"/concerts?status={status_filter}"
    return "/concerts"


@router.post("/download-selected")
def download_selected_concerts(
    concert_ids: list[int] = Form(default=[]),
    artist_id: int | None = Form(default=None),
    status_filter: str | None = Form(default=None),
):
    download_selected(concert_ids)
    return RedirectResponse(url=_redirect_target(artist_id, status_filter), status_code=303)


@router.post("/download-all-new")
def download_all_new_concerts(
    artist_id: int | None = Form(default=None),
    status_filter: str | None = Form(default=None),
):
    download_all_new(artist_id=artist_id)
    return RedirectResponse(url=_redirect_target(artist_id, status_filter), status_code=303)
