import sentry_sdk
from app.core.config import settings
from app.core.logging import logger


def init_sentry():
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            enable_tracing=True,
            attach_stacktrace=True,
        )
        logger.info(f"Sentry initialized for environment: {settings.SENTRY_ENVIRONMENT}")
    else:
        logger.info("Sentry DSN not provided. Error logging running in local mode.")
