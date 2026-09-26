from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health", summary="Health Check")
async def health_check():
    """
    Service health check endpoint to verify backend status, version, and connectivity.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/ping", summary="Ping Check")
async def ping():
    return {"ping": "pong"}
