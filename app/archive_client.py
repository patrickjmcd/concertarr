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


def search(
    query: str, rows: int, page: int = 1, sort: str = "addeddate desc"
) -> tuple[list[dict], int]:
    """Query archive.org's advancedsearch API for a single page.

    Returns (docs, total_matches_found).
    """
    params = {
        "q": query,
        "fl[]": SEARCH_FIELDS,
        "rows": rows,
        "page": page,
        "sort[]": sort,
        "output": "json",
    }
    resp = httpx.get(ADVANCED_SEARCH_URL, params=params, timeout=settings.http_timeout_seconds)
    resp.raise_for_status()
    response = resp.json().get("response", {})
    return response.get("docs", []), response.get("numFound", 0)


def search_items(query: str, rows: int | None = None, sort: str = "addeddate desc") -> list[dict]:
    """Query archive.org's advancedsearch API and return raw item dicts for a single page."""
    docs, _ = search(query, rows=rows or settings.search_rows, sort=sort)
    return docs


def search_items_paginated(
    query: str, max_results: int, page_size: int = 100, sort: str = "addeddate desc"
) -> list[dict]:
    """Page through archive.org search results until max_results or the full
    match count is reached, whichever comes first.

    page_size must stay fixed across requests -- archive.org computes each
    page's offset as (page - 1) * rows, so varying rows between calls would
    skip or re-fetch items.
    """
    all_docs: list[dict] = []
    page = 1
    while len(all_docs) < max_results:
        docs, num_found = search(query, rows=page_size, page=page, sort=sort)
        if not docs:
            break
        all_docs.extend(docs)
        if len(all_docs) >= num_found:
            break
        page += 1
    return all_docs[:max_results]


def get_metadata(identifier: str) -> dict:
    """Fetch full item metadata (including file listing) for a single identifier."""
    url = METADATA_URL.format(identifier=identifier)
    resp = httpx.get(url, timeout=settings.http_timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def download_url(identifier: str, filename: str) -> str:
    return DOWNLOAD_URL.format(identifier=identifier, filename=filename)
