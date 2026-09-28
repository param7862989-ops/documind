import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.core.database import get_db
from app.services.ai_usage import ai_usage_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", summary="Liveness Health Check")
async def health_check():
    """
    Liveness probe: verifies that the web service is running and responsive.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/ready", summary="Readiness Health Check")
def readiness_check(db: Session = Depends(get_db)):
    """
    Readiness probe: verifies database connectivity and core service readiness
    without leaking database credentials or internal infrastructure paths.
    """
    db_status = "unhealthy"
    try:
        # Simple non-destructive query to verify database connection pool
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error("Readiness check DB query failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "database": "unavailable"}
        )

    storage_status = "ready"
    storage_provider = settings.STORAGE_PROVIDER.lower()

    return {
        "status": "ready",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "storage": storage_status,
        "storage_provider": storage_provider,
    }


@router.get("/health/metrics", summary="System Observability & AI Metrics")
async def system_metrics():
    """
    Lightweight operational observability metrics endpoint.
    Exposes request counters, embedding volumes, and token totals.
    """
    metrics = ai_usage_service.get_system_metrics()
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "metrics": metrics,
    }


@router.get("/ping", summary="Ping Check")
async def ping():
    return {"ping": "pong"}
