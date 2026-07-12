import logging
import os
import re

import httpx

from app import archive_client
from app.config import settings

log = logging.getLogger("concertarr.downloader")


class NoMatchingFormatError(Exception):
    pass


def sanitize(name: str) -> str:
    name = name.strip()
    name = re.sub(r"[^\w\s.\-]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name[:150] or "untitled"


def choose_files(files: list[dict]) -> tuple[str, list[dict]]:
    """Pick the highest-priority preferred format that has files present."""
    for fmt in settings.preferred_format_list:
        matches = [f for f in files if f.get("format") == fmt and f.get("name")]
        if matches:
            return fmt, matches
    raise NoMatchingFormatError(
        f"No files matched any preferred format {settings.preferred_format_list}"
    )


def destination_dir(artist_name: str, show_date: str | None, identifier: str) -> str:
    artist_dir = sanitize(artist_name)
    show_dir = sanitize(f"{show_date}_{identifier}" if show_date else identifier)
    return os.path.join(settings.media_root, artist_dir, show_dir)


def download_files(identifier: str, files: list[dict], dest_dir: str) -> None:
    os.makedirs(dest_dir, exist_ok=True)
    with httpx.Client(timeout=settings.http_timeout_seconds, follow_redirects=True) as client:
        for f in files:
            filename = f["name"]
            url = archive_client.download_url(identifier, filename)
            dest_path = os.path.join(dest_dir, os.path.basename(filename))
            log.info("Downloading %s -> %s", url, dest_path)
            with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(dest_path, "wb") as fh:
                    for chunk in resp.iter_bytes(chunk_size=1024 * 256):
                        fh.write(chunk)


def preview_tracks(identifier: str) -> tuple[str | None, list[dict]]:
    """Fetch metadata and return the (format, files) that would be downloaded.

    Returns (None, []) if no preferred format matches -- does not raise.
    """
    metadata = archive_client.get_metadata(identifier)
    files = metadata.get("files", [])
    try:
        return choose_files(files)
    except NoMatchingFormatError:
        return None, []


def download_concert(artist_name: str, identifier: str, show_date: str | None) -> tuple[str, str]:
    """Fetch metadata, pick the preferred format, download all matching files.

    Returns (format_used, dest_dir). Raises NoMatchingFormatError on no match.
    """
    metadata = archive_client.get_metadata(identifier)
    files = metadata.get("files", [])
    fmt, matches = choose_files(files)
    dest_dir = destination_dir(artist_name, show_date, identifier)
    download_files(identifier, matches, dest_dir)
    return fmt, dest_dir
