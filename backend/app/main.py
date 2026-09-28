import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.core.logging_config import setup_logging, request_id_ctx
from app.core.database import engine, Base, SessionLocal
import app.models  # Ensure all models are registered with Base metadata
from app.api.v1.router import api_router

# Initialize application logging
setup_logging(settings.ENVIRONMENT)
logger = logging.getLogger("documind.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema / pgvector extension
    try:
        with engine.connect() as conn:
            if "postgres" in settings.DATABASE_URL.lower():
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    conn.commit()
                except Exception as ext_err:
                    logger.warning("Notice: vector extension check: %s", ext_err)
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error("Database initialization notice (will retry when DB available): %s", e)

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)


# Request ID and Structured Logging Middleware
@app.middleware("http")
async def logging_and_request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_ctx.set(req_id)
    start_time = time.time()

    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id

        # Log non-healthcheck requests or failed requests
        if not request.url.path.endswith("/health") and not request.url.path.endswith("/ping"):
            logger.info(
                "%s %s -> %d (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.exception(
            "Unhandled exception in %s %s (%.1fms): %s",
            request.method,
            request.url.path,
            duration_ms,
            exc,
            extra={
                "method": request.method,
                "path": request.url.path,
                "duration_ms": duration_ms,
                "exception_type": type(exc).__name__,
            }
        )
        raise exc
    finally:
        request_id_ctx.reset(token)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# Global Uncaught Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Global exception handler caught: %s", exc)
    if settings.ENVIRONMENT.lower() == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred. Please contact support if the issue persists."}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )


# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


@app.get("/health", summary="Top-Level Liveness Health Check")
async def top_level_health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/ready", summary="Top-Level Readiness Check")
def top_level_readiness():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "database": "connected",
        }
    except Exception as e:
        logger.error("Readiness check DB query failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "unavailable"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
