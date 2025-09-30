"""
Main FastAPI application for the streamlined analytics engine.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.v1.api import api_router
from core.config import settings
from core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for the FastAPI application."""
    # Startup
    await init_db()
    print("Modular Analytics Engine started successfully")
    print("Available modules: Auto-Analytics, Descriptive Analytics, Qualitative Analytics, Inferential Analytics")
    yield
    # Shutdown
    print("Modular Analytics Engine shutting down")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Modular analytics engine for research data collection with specialized endpoints for auto-detection, descriptive, qualitative, and inferential analytics",
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix=settings.API_V1_STR)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Modular Research Analytics Engine API",
        "version": settings.VERSION,
        "status": "running",
        "architecture": "modular",
        "modules": {
            "auto_analytics": "/api/v1/analytics/auto",
            "descriptive_analytics": "/api/v1/analytics/descriptive",
            "qualitative_analytics": "/api/v1/analytics/qualitative", 
            "inferential_analytics": "/api/v1/analytics/inferential"
        },
        "migration_guide": "/api/v1/analytics/migration-guide"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True) 