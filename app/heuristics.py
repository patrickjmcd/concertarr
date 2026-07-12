import re

# YYYY-MM-DD / YYYY.MM.DD, or compact YYYYMMDD (e.g. taper filenames like "19950904")
_DATE_PATTERN = re.compile(r"\b\d{4}[-.]\d{2}[-.]\d{2}\b|\b(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b")


def looks_like_concert(title: str | None) -> bool:
    """Heuristic: does this title look like a live recording rather than a
    studio release, compilation, remaster, etc?

    Taper-community uploads overwhelmingly follow "{Artist} Live at {venue}
    on {date}" or "{Artist} {date} {location}" naming. Verified against a
    real catalog (Wilco's 99 archive.org items): the only 4 non-concert
    items (Spotify Singles, a demos comp, a SACD remaster, a mixtape) were
    exactly the ones with neither "live" nor a full date in the title.
    """
    if not title:
        return False
    if "live" in title.lower():
        return True
    return bool(_DATE_PATTERN.search(title))
