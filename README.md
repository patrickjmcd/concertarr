# concertarr

A Lidarr-style monitoring and auto-grab service for live concert recordings hosted on [archive.org](https://archive.org). Live recordings are scattered across many collections beyond the [Live Music Archive / etree](https://archive.org/details/etree) collection (taper-specific collections, `taperssection`, `hifidelity`, `folksoundomy`, `opensource_audio`, etc.), so concertarr searches by artist and audio media type rather than restricting to a single collection.

Add a band, and concertarr periodically polls archive.org for newly added recordings matching that artist, then automatically downloads the highest-priority available audio format.

## Features

- Monitor artists via an archive.org advanced-search query (defaults to `creator:("<name>") AND mediatype:(audio)`, editable per artist)
- Background poller (configurable interval) discovers newly added matching items
- Per-artist auto-download toggle, plus manual checkbox selection and "download all new" for artists in manual mode
- Automatic download with configurable format preference (e.g. `Flac,VBR MP3,MP3`)
- React + shadcn/ui frontend (dashboard, artist list/detail, concert library, manual "check now" / "retry" / "download now") talking to a FastAPI JSON API
- SQLite storage (no external DB dependency)

## Architecture

FastAPI serves a JSON API under `/api/*` and the built React SPA (everything else, with client-side routing handled via a catch-all fallback to `index.html`). Both live in one container/process — there's no separate frontend deployment.

## Configuration

All settings are environment variables prefixed `CONCERTARR_`:

| Variable | Default | Description |
|---|---|---|
| `CONCERTARR_DATABASE_URL` | `sqlite:////app/data/concertarr.db` | SQLAlchemy database URL |
| `CONCERTARR_MEDIA_ROOT` | `/media/concerts` | Root directory for downloaded concerts |
| `CONCERTARR_POLL_INTERVAL_MINUTES` | `180` | How often to poll archive.org for each artist |
| `CONCERTARR_PREFERRED_FORMATS` | `Flac,VBR MP3,MP3,Ogg Vorbis` | Priority-ordered list of archive.org file formats to download |
| `CONCERTARR_MAX_CONCURRENT_DOWNLOADS` | `2` | Download worker pool size |
| `CONCERTARR_SEARCH_ROWS` | `50` | Items fetched per routine poll (most recently added first) |
| `CONCERTARR_MAX_BACKFILL_RESULTS` | `500` | Cap on how many shows to backfill (across paginated requests) the first time an artist is added |

## Running locally

Backend:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend (dev server proxies `/api` to the backend on `:8000`):

```bash
cd frontend
npm install
npm run dev
```

For a production-style run, build the frontend and let FastAPI serve it directly:

```bash
cd frontend && npm install && npm run build && cd ..
cp -r frontend/dist static_frontend
uvicorn app.main:app
```

## Docker

```bash
docker build -t concertarr .
docker run -p 8000:8000 -v $(pwd)/data:/app/data -v /path/to/media:/media/concerts concertarr
```
