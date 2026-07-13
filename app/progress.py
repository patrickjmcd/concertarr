"""In-memory tracker for active download byte progress, keyed by Concert.id.

Intentionally not persisted -- this is ephemeral UI state (a restart simply
means in-flight downloads stop reporting progress, same as any other
in-process state the scheduler holds). Accessed from both the download
executor's worker threads and FastAPI's request-handling threadpool, so
access is guarded by a lock.
"""

import threading

_lock = threading.Lock()
_active: dict[int, dict] = {}


def start(concert_id: int, bytes_total: int | None) -> None:
    with _lock:
        _active[concert_id] = {"bytes_done": 0, "bytes_total": bytes_total, "current_file": None}


def add_bytes(concert_id: int, n: int, current_file: str) -> None:
    with _lock:
        entry = _active.get(concert_id)
        if entry is None:
            return
        entry["bytes_done"] += n
        entry["current_file"] = current_file


def finish(concert_id: int) -> None:
    with _lock:
        _active.pop(concert_id, None)


def snapshot() -> dict[int, dict]:
    with _lock:
        return {concert_id: dict(entry) for concert_id, entry in _active.items()}
