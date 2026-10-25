from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException

from app.core.config import settings


_request_times: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = Lock()


def enforce_request_limit(client_key: str) -> None:
    now = monotonic()
    cutoff = now - 60
    with _rate_lock:
        # A bounded per-process window protects the free provider quota without persisting visitor identifiers.
        if len(_request_times) > 5000:
            stale_keys = [key for key, times in _request_times.items() if not times or times[-1] <= cutoff]
            for key in stale_keys:
                _request_times.pop(key, None)
        times = _request_times[client_key]
        while times and times[0] <= cutoff:
            times.popleft()
        if len(times) >= settings.video_practice_requests_per_minute:
            raise HTTPException(status_code=429, detail="Video practice request limit reached. Please try again in a minute.")
        times.append(now)
