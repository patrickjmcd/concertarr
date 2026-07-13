# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

concertarr is both a listening app and a Lidarr-style monitoring/auto-grab service for live concert recordings on archive.org. Its home page (`/aadam-jacobs`) is a show-first browser/player for one specific archive.org collection, `collection:(aadamjacobs)` (Chicago taper Aadam Jacobs) — shows there are playable straight from the browse feed without any setup. Beyond that, the app also works as a generic archive.org artist monitor: add an artist, and a background poller periodically searches archive.org for new matching recordings and auto-downloads the preferred audio format. Live recordings are scattered across many taper collections (not just `etree`), so search/discovery is scoped by `TAPER_COLLECTIONS` in `app/archive_client.py` rather than a single collection. Playback always prefers an already-downloaded local file over streaming from archive.org (see `app/track_service.py`).

## Commands

Backend (from repo root, Python 3.12). The default `CONCERTARR_DATABASE_URL` (`/app/data/...`) and `CONCERTARR_MEDIA_ROOT` (`/media/concerts`) assume the Docker container's filesystem, so override both for a bare-metal run:
```bash
pip install -r requirements.txt
mkdir -p data media
CONCERTARR_DATABASE_URL="sqlite:///$(pwd)/data/concertarr.db" CONCERTARR_MEDIA_ROOT="$(pwd)/media" uvicorn app.main:app --reload
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
- `archive_client.py` — all archive.org API access (advancedsearch, metadata, download URLs). `TAPER_COLLECTIONS` defines which collections count as taper/live-recording sources; `extract_sources`/`source_string` pull a human-readable "source" (taper/uploader) out of a raw `collection` value, filtering out generic scoping collections (see `_GENERIC_COLLECTION_STEMS`). `AADAM_JACOBS_QUERY` is the dedicated query for the home-page collection.
- `heuristics.py` — `looks_like_concert(title)`: heuristic (title contains "live" or a date pattern) to flag whether a search result is actually a live recording vs. a studio release/compilation/remaster. Used to annotate (not filter) results throughout the API.
- `downloader.py` — picks files matching the first available format in `settings.preferred_format_list`, builds a sanitized destination path (`MEDIA_ROOT/<artist>/<date_or_id>/`), and streams files to disk.
- `track_service.py` — identifier-based (not `Concert`-id-based) track listing/streaming shared by both `routers/concerts.py` (a monitored concert) and `routers/archive.py` (any archive.org identifier, monitored or not). `track_list_for` looks up *any* `Concert` row matching that identifier to decide whether to stream from disk or fall back to archive.org — this is what makes "play the local download if one exists" work uniformly everywhere, including shows browsed on the Aadam Jacobs page that were never explicitly monitored.
- `scheduler.py` — APScheduler background job (`poll_all_artists`, interval = `POLL_INTERVAL_MINUTES`) plus a `ThreadPoolExecutor` (`MAX_CONCURRENT_DOWNLOADS` workers) for downloads. `poll_artist` does a full paginated backfill (up to `MAX_BACKFILL_RESULTS`) on an artist's *first* poll only, then incremental polls thereafter — this is the mechanism that keeps a prolific artist's older shows from being permanently missed. New concerts are queued for download automatically only if `Artist.auto_download` is set.
- `routers/` — one router per resource, all mounted under `/api/*`:
  - `aadamjacobs.py` — the home page's API. `GET /shows` browses/searches the Aadam Jacobs collection (`sort=recent|date|popularity`, mapped to archive.org sort strings). `POST /download` queues a single show without full artist monitoring: it finds-or-creates an `Artist` row (disabled, `auto_download=False`, so the periodic poller doesn't silently adopt it) purely to own the `Concert` record, then find-or-creates the `Concert` and queues it — idempotent, safe to call repeatedly for the same show.
  - `archive.py` — generic identifier-based track preview/streaming (`GET /{identifier}/tracks`, `GET /{identifier}/tracks/{filename}/stream`), backed by `track_service.py`. Used for shows that aren't (yet) monitored.
  - `discover.py` — aggregates raw archive.org search results by creator to suggest new artists to monitor (artist-first, all taper collections), cross-referencing against already-monitored `Artist` names.
  - `dashboard.py` — trimmed to just `{artist_count, status_counts}`; consumed by the Artists page's stat strip, not a standalone page.
  - `artists.py`, `concerts.py` — CRUD/lifecycle for monitored artists and their concerts.
- `schemas.py` — Pydantic response/request models, kept separate from the SQLAlchemy models in `models.py`.

**Frontend (`frontend/src/`)**
- React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (Radix-based components in `components/ui/`), React Router for client-side routing, Sonner for toasts.
- `lib/api.ts` — the single typed client for the backend; every `/api/*` endpoint and its request/response shape is defined here. Mirrors `app/schemas.py` — when changing a backend schema, update this file too.
- `pages/aadam-jacobs.tsx` — the app's home (`/`, `/dashboard` both redirect to `/aadam-jacobs`). Show-first feed with search + sort, lazy per-row track fetch (`api.getArchiveTracks`) feeding the shared `TrackPlayer`, and inline Download/Monitor actions that don't require pre-registering the artist.
- `pages/` — one file per other route (artists list/detail/new, concerts library/detail, discover). `App.tsx` wires routes inside a shared `Layout`.
- `components/track-player.tsx` — persistent bottom playback bar (play/pause/seek/next/prev), driven purely by `tracks: TrackItem[]` + `currentIndex` props — reused as-is by both `concert-detail.tsx` and `aadam-jacobs.tsx`, each of which owns its own `currentIndex` state and fetches tracks lazily.
- Domain-specific small components: `concert-flag.tsx` (renders the `likely_concert` heuristic), `source-tag.tsx` (renders the taper/uploader `source` field), `status-badge.tsx` (renders `Concert.status`).
- Path alias `@/*` → `frontend/src/*` (see `vite.config.ts` / `tsconfig.json`).

## Key domain concepts worth knowing before changing behavior

- **Source vs. collection**: `Concert.collection` stores the raw comma-joined archive.org collection tags; `source`/`extract_sources` in `archive_client.py` derives a more meaningful "who taped/uploaded this" label from it. When adding new collections to `TAPER_COLLECTIONS`, also consider whether they need an entry in `_GENERIC_COLLECTION_STEMS` (generic scoping tag) or should be left out of it via `NAMED_TAPER_COLLECTIONS` (specific-identity tag, like `NYCTaper`/`aadamjacobs`).
- **`likely_concert` is advisory, not a filter**: results/concerts that don't "look like" a concert are still surfaced (with a flag), never silently dropped — only apply this heuristic in UI treatment or ranking, not as a hard filter.
- **First-poll backfill**: any change to `poll_artist` in `scheduler.py` must preserve the distinction between an artist's first poll (paginated backfill) and subsequent polls (single incremental page) — collapsing this would break discovery of an artist's back catalog.
- **Local-first playback is identifier-scoped, not concert-scoped**: `track_service.track_list_for` looks up a `Concert` by `identifier` alone (regardless of which `Artist` owns it) to decide local vs. remote streaming. A show downloaded via the Aadam Jacobs page's ad-hoc `Artist` will therefore also stream locally if browsed from anywhere else in the app that shares the same identifier.
- **Ad-hoc artists from `/api/aadamjacobs/download`** are created `enabled=False, auto_download=False` deliberately — they exist to own a `Concert` row, not to opt the user into ongoing monitoring. Don't flip those flags on as a "convenience"; monitoring is an explicit separate action (the "Monitor" link, which goes through the normal `/artists/new` preview flow).
