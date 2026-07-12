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

# Generic collection tags that don't identify a specific taper/uploader -- most of
# the TAPER_COLLECTIONS scoping tags (broad categories, not a "who uploaded this"
# identity) plus catch-alls like opensource_audio/community. Matched by prefix since
# archive.org uses sub-variants (folksoundomy_music_unsorted, hifidelity_potpourri,
# etc). NYCTaper is deliberately excluded here: unlike the others, it identifies one
# specific taper, so it's worth surfacing as a "source" like "aadamjacobs" is.
_GENERIC_COLLECTION_STEMS = [
    c.lower() for c in TAPER_COLLECTIONS if c.lower() != "nyctaper"
] + [
    "audio_music",
    "opensource_audio",
    "community",
]


def _is_generic_collection(tag: str) -> bool:
    t = tag.lower()
    return t.startswith("fav-") or any(t == stem or t.startswith(f"{stem}_") for stem in _GENERIC_COLLECTION_STEMS)


def extract_sources(collection: list[str] | str | None) -> list[str]:
    """Pull out the specific taper/uploader collection tag(s) (e.g. "aadamjacobs",
    "NYCTaper") from a raw collection value, filtering out generic scoping
    collections and favorites-list noise (fav-*).

    Accepts either the raw archive.org doc value (list or single string) or a
    comma-joined string (how Concert.collection is stored in the DB).
    """
    if isinstance(collection, list):
        parts = [str(c).strip() for c in collection if str(c).strip()]
    elif isinstance(collection, str) and collection.strip():
        parts = [p.strip() for p in collection.split(",") if p.strip()]
    else:
        parts = []
    return [p for p in parts if not _is_generic_collection(p)]


def source_string(collection: list[str] | str | None) -> str | None:
    """Display-ready version of extract_sources(), or None if no distinct source."""
    sources = extract_sources(collection)
    return ", ".join(sources) if sources else None


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
