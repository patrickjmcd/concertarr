import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routers import aadamjacobs, archive, artists, concerts, dashboard, discover, downloads
from app.scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(level=settings.log_level)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "static_frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="concertarr", lifespan=lifespan)

app.include_router(dashboard.router)
app.include_router(artists.router)
app.include_router(concerts.router)
app.include_router(discover.router)
app.include_router(aadamjacobs.router)
app.include_router(archive.router)
app.include_router(downloads.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = FRONTEND_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIR / "index.html")
