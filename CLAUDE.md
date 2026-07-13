# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

concertarr is a Lidarr-style monitoring/auto-grab service for live concert recordings on archive.org. Users add artists; a background poller periodically searches archive.org for new matching recordings and auto-downloads the preferred audio format. Live recordings are scattered across many taper collections (not just `etree`), so search/discovery is scoped by `TAPER_COLLECTIONS` in `app/archive_client.py` rather than a single collection.

## Commands

Backend (from repo root, Python 3.12):
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload          # dev server on :8000
```
There is no configured lint/format/test tooling for the Python backend (no ruff/black/pytest config present) — don't assume commands that aren't in `requirements.txt`.

Frontend (from `frontend/`):
```bash
npm install
npm run dev       # vite dev server; proxies /api to 127.0.0.1:8000 (see vite.config.ts)
npm run build     # tsc -b && vite build
npm run lint       # oxlint
```
No frontend test runner is configured.

Production-style single-process run (mirrors the Dockerfile):
```bash
cd frontend && npm install && npm run build && cd ..
cp -r frontend/dist static_frontend
uvicorn app.main:app
```
FastAPI only serves the SPA when `static_frontend/` exists (see `app/main.py`); it's gitignored and must be built.

Docker:
```bash
docker build -t concertarr .
docker run -p 8000:8000 -v $(pwd)/data:/app/data -v /path/to/media:/media/concerts concertarr
```

## Configuration

All settings are env vars prefixed `CONCERTARR_`, defined in `app/config.py` (`Settings`, pydantic-settings). Notable ones: `DATABASE_URL` (SQLite by default, no external DB), `MEDIA_ROOT`, `POLL_INTERVAL_MINUTES`, `PREFERRED_FORMATS` (ordered list, e.g. `Flac,VBR MP3,MP3`), `MAX_CONCURRENT_DOWNLOADS`, `SEARCH_ROWS`, `MAX_BACKFILL_RESULTS`.

## Architecture

One FastAPI process serves both the JSON API (`/api/*`) and the built React SPA (catch-all route in `app/main.py` falls back to `index.html` for client-side routing). There is no separate frontend deployment/server.

**Backend (`app/`)**
- `main.py` — FastAPI app setup, lifespan (`init_db` + `start_scheduler`/`shutdown_scheduler`), SPA static-file mounting.
- `models.py` — SQLAlchemy models: `Artist` (has a `query`, an archive.org advancedsearch query string, defaulting to `creator:("<name>") AND mediatype:(audio)`) and `Concert` (one discovered recording, unique per `(artist_id, identifier)`, with a `status` lifecycle: `new` → `downloading` → `downloaded`/`failed`).
- `db.py` — engine/session setup; `init_db()` creates tables and runs a tiny ad-hoc migration (`_add_missing_columns`) instead of using Alembic — add new lightweight migrations there if columns are added to existing tables.
- `archive_client.py` — all archive.org API access (advancedsearch, metadata, download URLs). `TAPER_COLLECTIONS` defines which collections count as taper/live-recording sources; `extract_sources`/`source_string` pull a human-readable "source" (taper/uploader) out of a raw `collection` value, filtering out generic scoping collections (see `_GENERIC_COLLECTION_STEMS`).
- `heuristics.py` — `looks_like_concert(title)`: heuristic (title contains "live" or a date pattern) to flag whether a search result is actually a live recording vs. a studio release/compilation/remaster. Used to annotate (not filter) results throughout the API.
- `downloader.py` — picks files matching the first available format in `settings.preferred_format_list`, builds a sanitized destination path (`MEDIA_ROOT/<artist>/<date_or_id>/`), and streams files to disk.
- `scheduler.py` — APScheduler background job (`poll_all_artists`, interval = `POLL_INTERVAL_MINUTES`) plus a `ThreadPoolExecutor` (`MAX_CONCURRENT_DOWNLOADS` workers) for downloads. `poll_artist` does a full paginated backfill (up to `MAX_BACKFILL_RESULTS`) on an artist's *first* poll only, then incremental polls thereafter — this is the mechanism that keeps a prolific artist's older shows from being permanently missed. New concerts are queued for download automatically only if `Artist.auto_download` is set.
- `routers/` — one router per resource (`artists`, `concerts`, `dashboard`, `discover`), all mounted under `/api/*`. `discover.py` aggregates raw archive.org search results by creator to suggest new artists to monitor, cross-referencing against already-monitored `Artist` names.
- `schemas.py` — Pydantic response/request models, kept separate from the SQLAlchemy models in `models.py`.

**Frontend (`frontend/src/`)**
- React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (Radix-based components in `components/ui/`), React Router for client-side routing, Sonner for toasts.
- `lib/api.ts` — the single typed client for the backend; every `/api/*` endpoint and its request/response shape is defined here. Mirrors `app/schemas.py` — when changing a backend schema, update this file too.
- `pages/` — one file per route (dashboard, artists list/detail/new, concerts library/detail, discover). `App.tsx` wires routes inside a shared `Layout`.
- Domain-specific small components: `concert-flag.tsx` (renders the `likely_concert` heuristic), `source-tag.tsx` (renders the taper/uploader `source` field), `status-badge.tsx` (renders `Concert.status`).
- Path alias `@/*` → `frontend/src/*` (see `vite.config.ts` / `tsconfig.json`).

## Key domain concepts worth knowing before changing behavior

- **Source vs. collection**: `Concert.collection` stores the raw comma-joined archive.org collection tags; `source`/`extract_sources` in `archive_client.py` derives a more meaningful "who taped/uploaded this" label from it. When adding new collections to `TAPER_COLLECTIONS`, also consider whether they need an entry in `_GENERIC_COLLECTION_STEMS` (generic scoping tag) or should be left out of it (specific-identity tag, like `NYCTaper`).
- **`likely_concert` is advisory, not a filter**: results/concerts that don't "look like" a concert are still surfaced (with a flag), never silently dropped — only apply this heuristic in UI treatment or ranking, not as a hard filter.
- **First-poll backfill**: any change to `poll_artist` in `scheduler.py` must preserve the distinction between an artist's first poll (paginated backfill) and subsequent polls (single incremental page) — collapsing this would break discovery of an artist's back catalog.
