import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment & Info
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "AI Accounting Software"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Target Data Localization (Mandatory India compliance)
    DATA_REGION: str = "ap-south-1"  # AWS Mumbai / GCP asia-south1
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8081",  # Expo / Metro
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # JWT & Auth Security
    JWT_SECRET_KEY: str = "dev_secret_key_change_in_production_min_32_chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # PostgreSQL Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "ai_accounting_dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_accounting_dev"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/ai_accounting_dev"

    # Redis Cache & Background Tasks
    REDIS_URL: str = "redis://localhost:6379/0"

    # Sentry & Observability
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0
    LOG_LEVEL: str = "INFO"

    # AI Microservice
    AI_SERVICE_URL: str = "http://localhost:8001"

    # Payment Gateway (Razorpay India)
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # WhatsApp API
    WHATSAPP_API_KEY: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=f".env.{os.getenv('ENVIRONMENT', 'development')}",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )


settings = Settings()
