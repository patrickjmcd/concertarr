# concertarr

A Lidarr-style monitoring and auto-grab service for live concert recordings hosted on [archive.org](https://archive.org). Live recordings are scattered across many collections beyond the [Live Music Archive / etree](https://archive.org/details/etree) collection (taper-specific collections, `taperssection`, `hifidelity`, `folksoundomy`, `opensource_audio`, etc.), so concertarr searches by artist and audio media type rather than restricting to a single collection.

Add a band, and concertarr periodically polls archive.org for newly added recordings matching that artist, then automatically downloads the highest-priority available audio format.

## Features

- Monitor artists via an archive.org advanced-search query (defaults to `creator:("<name>") AND mediatype:(audio)`, editable per artist)
- Background poller (configurable interval) discovers newly added matching items
- Automatic download with configurable format preference (e.g. `Flac,VBR MP3,MP3`)
- Simple web UI: dashboard, artist list/detail, concert library, manual "check now" / "retry"
- SQLite storage (no external DB dependency)

## Configuration

All settings are environment variables prefixed `CONCERTARR_`:

| Variable | Default | Description |
|---|---|---|
| `CONCERTARR_DATABASE_URL` | `sqlite:////app/data/concertarr.db` | SQLAlchemy database URL |
| `CONCERTARR_MEDIA_ROOT` | `/media/concerts` | Root directory for downloaded concerts |
| `CONCERTARR_POLL_INTERVAL_MINUTES` | `180` | How often to poll archive.org for each artist |
| `CONCERTARR_PREFERRED_FORMATS` | `Flac,VBR MP3,MP3,Ogg Vorbis` | Priority-ordered list of archive.org file formats to download |
| `CONCERTARR_MAX_CONCURRENT_DOWNLOADS` | `2` | Download worker pool size |
| `CONCERTARR_SEARCH_ROWS` | `50` | Items fetched per poll (most recently added first) |

## Running locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Docker

```bash
docker build -t concertarr .
docker run -p 8000:8000 -v $(pwd)/data:/app/data -v /path/to/media:/media/concerts concertarr
```
