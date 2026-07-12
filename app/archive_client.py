import logging

import httpx

from app.config import settings

log = logging.getLogger("concertarr.archive_client")

ADVANCED_SEARCH_URL = "https://archive.org/advancedsearch.php"
METADATA_URL = "https://archive.org/metadata/{identifier}"
DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"

SEARCH_FIELDS = ["identifier", "title", "date", "creator", "collection", "venue"]

# Collections used by the archive.org live-recording taping community. Restricting
# discovery/browse queries to these (rather than the much broader mediatype:(audio))
# keeps results to actual concert tapes instead of podcasts, audiobooks, and other
# unrelated audio uploads.
TAPER_COLLECTIONS = [
    "etree",
    "taperssection",
    "hifidelity",
    "folksoundomy",
    "roiocollection",
    "cratediggers",
    "NYCTaper",
]
TAPER_COLLECTIONS_QUERY = "(" + " OR ".join(f"collection:({c})" for c in TAPER_COLLECTIONS) + ")"


def search_items(query: str, rows: int | None = None, sort: str = "addeddate desc") -> list[dict]:
    """Query archive.org's advancedsearch API and return raw item dicts."""
    params = {
        "q": query,
        "fl[]": SEARCH_FIELDS,
        "rows": rows or settings.search_rows,
        "page": 1,
        "sort[]": sort,
        "output": "json",
    }
    resp = httpx.get(ADVANCED_SEARCH_URL, params=params, timeout=settings.http_timeout_seconds)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", {}).get("docs", [])


def get_metadata(identifier: str) -> dict:
    """Fetch full item metadata (including file listing) for a single identifier."""
    url = METADATA_URL.format(identifier=identifier)
    resp = httpx.get(url, timeout=settings.http_timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def download_url(identifier: str, filename: str) -> str:
    return DOWNLOAD_URL.format(identifier=identifier, filename=filename)
