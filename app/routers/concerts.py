from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Concert
from app.scheduler import queue_download
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
