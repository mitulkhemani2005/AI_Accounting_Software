from pydantic_settings import BaseSettings, SettingsConfigDict


class AISettings(BaseSettings):
    SERVICE_NAME: str = "ai-accounting-ai-service"
    ENVIRONMENT: str = "development"
    VERSION: str = "0.1.0"
    BACKEND_API_URL: str = "http://localhost:8000/api/v1"
    
    # Sentry & Logging
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    # LLM Settings (OpenAI / Claude / Gemini / Local)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


ai_settings = AISettings()
