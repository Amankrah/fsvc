"""
API router for v1 endpoints - modular analytics API.
"""

from fastapi import APIRouter
from .endpoints import analytics, autoanalytics, descriptive, qualitative, inferential, sync

api_router = APIRouter()

# Legacy analytics endpoints (migration guide)
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics-migration"]
)

# Auto-detection analytics endpoints
api_router.include_router(
    autoanalytics.router,
    prefix="/analytics/auto",
    tags=["auto-analytics"]
)

# Descriptive analytics endpoints
api_router.include_router(
    descriptive.router,
    prefix="/analytics/descriptive",
    tags=["descriptive-analytics"]
)

# Qualitative analytics endpoints
api_router.include_router(
    qualitative.router,
    prefix="/analytics/qualitative",
    tags=["qualitative-analytics"]
)

# Inferential analytics endpoints
api_router.include_router(
    inferential.router,
    prefix="/analytics/inferential",
    tags=["inferential-analytics"]
)

# Sync endpoints
api_router.include_router(
    sync.router,
    prefix="/sync",
    tags=["sync"]
) 