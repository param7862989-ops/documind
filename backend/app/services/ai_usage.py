import time
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)


class AIUsageRecord(BaseModel):
    timestamp: float
    user_id: str
    operation: str  # "chat_completion", "embedding_batch", "compare_generation"
    model: str
    token_count: int
    latency_ms: float
    status: str = "success"


class AIUsageService:
    """
    Lightweight in-memory AI usage and spending guardrail tracker.
    Tracks AI request volumes, estimated tokens, latencies, and enforces user daily quotas.
    """
    def __init__(self):
        # Maps user_id -> list of AIUsageRecord
        self._user_usage: Dict[str, List[AIUsageRecord]] = defaultdict(list)
        # Global metrics counters
        self._total_requests: int = 0
        self._total_embeddings: int = 0
        self._total_tokens: int = 0

    def record_usage(
        self,
        user_id: str,
        operation: str,
        model: str,
        token_count: int,
        latency_ms: float,
        status: str = "success"
    ) -> None:
        """Records an AI operation for observability and metrics."""
        rec = AIUsageRecord(
            timestamp=time.time(),
            user_id=user_id,
            operation=operation,
            model=model,
            token_count=token_count,
            latency_ms=latency_ms,
            status=status,
        )
        self._user_usage[user_id].append(rec)
        self._total_requests += 1
        if "embedding" in operation.lower():
            self._total_embeddings += 1
        self._total_tokens += token_count

        logger.info(
            "AI Operation completed: op=%s model=%s user=%s tokens=%d latency=%.1fms status=%s",
            operation,
            model,
            user_id,
            token_count,
            latency_ms,
            status,
            extra={
                "operation": operation,
                "model": model,
                "user_id": user_id,
                "token_count": token_count,
                "latency_ms": latency_ms,
            }
        )

    def check_user_quota(self, user_id: str, max_daily_operations: int = 200) -> None:
        """
        Enforces a daily quota on AI operations per user to prevent runaway API spend.
        """
        now = time.time()
        one_day_ago = now - 86400

        # Purge records older than 24 hours for this user
        records = [r for r in self._user_usage[user_id] if r.timestamp > one_day_ago]
        self._user_usage[user_id] = records

        if len(records) >= max_daily_operations:
            logger.warning("User %s exceeded daily AI quota (%d operations)", user_id, max_daily_operations)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily AI usage quota reached ({max_daily_operations} requests/day). Please try again tomorrow.",
                headers={"Retry-After": "86400"}
            )

    def get_user_metrics(self, user_id: str) -> Dict[str, Any]:
        """Returns usage summary for a specific user."""
        now = time.time()
        one_day_ago = now - 86400
        recent = [r for r in self._user_usage[user_id] if r.timestamp > one_day_ago]
        total_tokens = sum(r.token_count for r in recent)
        avg_latency = (sum(r.latency_ms for r in recent) / len(recent)) if recent else 0.0

        return {
            "user_id": user_id,
            "requests_last_24h": len(recent),
            "tokens_last_24h": total_tokens,
            "avg_latency_ms": round(avg_latency, 2),
            "quota_limit": getattr(settings, "AI_QUOTA_PER_USER_DAILY", 200),
        }

    def get_system_metrics(self) -> Dict[str, Any]:
        """Returns high-level system-wide AI usage metrics for observability."""
        return {
            "total_ai_requests": self._total_requests,
            "total_embeddings": self._total_embeddings,
            "total_estimated_tokens": self._total_tokens,
            "active_users_tracked": len(self._user_usage),
        }


ai_usage_service = AIUsageService()
