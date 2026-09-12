from fastapi import FastAPI
from app.config import ai_settings
from app.routers import health

app = FastAPI(
    title=ai_settings.SERVICE_NAME,
    version=ai_settings.VERSION,
    description="AI Microservice for Market Basket Recommendations, Sales Velocity Restock Forecasting, and NL Queries",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

app.include_router(health.router, tags=["Health"])


@app.get("/")
def root():
    return {
        "service": ai_settings.SERVICE_NAME,
        "status": "online",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
