import logging
import sys
from app.core.config import settings


def setup_logging():
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Format for production vs development
    log_format = (
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        if settings.ENVIRONMENT == "development"
        else '{"time": "%(asctime)s", "level": "%(levelname)s", "name": "%(name)s", "message": "%(message)s"}'
    )

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True
    )

    logger = logging.getLogger("ai_accounting")
    logger.info(f"Logging initialized at level {settings.LOG_LEVEL} for environment: {settings.ENVIRONMENT}")
    return logger


logger = setup_logging()
