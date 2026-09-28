import logging
import sys
import json
import time
from contextvars import ContextVar
from typing import Optional, Dict, Any

request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id_ctx", default=None)
user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id_ctx", default=None)


class StructuredJsonFormatter(logging.Formatter):
    """
    Production JSON log formatter that automatically injects request context
    and filters sensitive fields.
    """
    SENSITIVE_KEYS = {"password", "token", "secret", "authorization", "api_key", "access_token"}

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Inject context variables
        req_id = request_id_ctx.get()
        if req_id:
            log_obj["request_id"] = req_id

        uid = user_id_ctx.get()
        if uid:
            log_obj["user_id"] = uid

        # Extract extra structured attributes attached to record
        for key, val in record.__dict__.items():
            if key not in (
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "module", "msecs",
                "message", "msg", "name", "pathname", "process", "processName",
                "relativeCreated", "stack_info", "thread", "threadName"
            ):
                if any(sens in key.lower() for sens in self.SENSITIVE_KEYS):
                    log_obj[key] = "[REDACTED]"
                else:
                    log_obj[key] = val

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def setup_logging(environment: str = "development") -> None:
    """Configures application-wide logging based on environment."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if environment.lower() == "production":
        handler.setFormatter(StructuredJsonFormatter())
    else:
        fmt = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(fmt)

    root_logger.addHandler(handler)
    # Suppress verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("passlib").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
