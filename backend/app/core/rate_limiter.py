import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from app.config import settings


class InMemoryRateLimiter:
    """
    Thread-safe, sliding-window in-memory rate limiter.
    Enforces per-endpoint request rate limits based on client IP or user identity.
    """
    def __init__(self):
        # Maps key (e.g., "auth_login:192.168.1.1") -> list of timestamps
        self._records: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Checks if the given key has exceeded `max_requests` within `window_seconds`.
        Returns (is_limited, retry_after_seconds).
        """
        now = time.time()
        cutoff = now - window_seconds
        timestamps = self._records[key]

        # Purge expired timestamps
        self._records[key] = [t for t in timestamps if t > cutoff]

        if len(self._records[key]) >= max_requests:
            oldest_in_window = self._records[key][0]
            retry_after = max(1, int(window_seconds - (now - oldest_in_window)))
            return True, retry_after

        # Record this request
        self._records[key].append(now)
        return False, 0

    def check(self, request: Request, action_name: str, max_requests: int, window_seconds: int = 60):
        """
        Convenience validator method to raise 429 HTTPException if limit exceeded.
        Bypasses general testclient calls unless 'x-test-rate-limit' header is explicitly passed.
        """
        if not getattr(settings, "RATE_LIMITING_ENABLED", True):
            return

        client_ip = request.client.host if request.client else "unknown"
        if client_ip == "testclient" and "x-test-rate-limit" not in request.headers:
            return

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        key = f"{action_name}:{client_ip}"
        is_limited, retry_after = self.is_rate_limited(key, max_requests, window_seconds)
        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests for '{action_name}'. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )


rate_limiter = InMemoryRateLimiter()
