import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "DocuMind API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    RATE_LIMITING_ENABLED: bool = True

    # Security & JWT
    SECRET_KEY: str = "documind_default_super_secret_jwt_key_change_in_production_987654321"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/documind"

    # AI / LLM / Embeddings
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_PROVIDER: str = "openai"  # "openai", "local", or "mock"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536
    RAG_TOP_K: int = 6
    RAG_SIMILARITY_THRESHOLD: float = 0.20
    RAG_ENABLE_HYBRID: bool = True
    RAG_ENABLE_RERANKING: bool = True

    # Cloud Object Storage (S3 / MinIO / Cloudflare R2)
    STORAGE_PROVIDER: str = "local"  # "local" or "s3"
    LOCAL_STORAGE_DIR: str = "./storage/uploads"
    MAX_FILE_SIZE_MB: int = 50
    S3_BUCKET_NAME: str = "documind-documents"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""  # For MinIO or Cloudflare R2

    @field_validator("SECRET_KEY")
    def validate_secret_key(cls, v: str, info) -> str:
        # Prevent insecure default secrets in production
        env = info.data.get("ENVIRONMENT", "development") if info.data else "development"
        if env.lower() == "production":
            if not v or "default" in v.lower() or "change_in_production" in v.lower() or len(v) < 32:
                raise ValueError(
                    "CRITICAL SECURITY: In production ENVIRONMENT, SECRET_KEY must be set to a secure, random string at least 32 characters long."
                )
        return v

    @field_validator("OPENAI_API_KEY")
    def validate_openai_api_key(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development") if info.data else "development"
        provider = info.data.get("EMBEDDING_PROVIDER", "openai") if info.data else "openai"
        if env.lower() == "production" and provider == "openai" and not v:
            raise ValueError(
                "CRITICAL: In production with EMBEDDING_PROVIDER='openai', OPENAI_API_KEY must be configured."
            )
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
