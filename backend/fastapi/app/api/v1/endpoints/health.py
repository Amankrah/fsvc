"""
Health check endpoints for the API.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict
from core.database import get_db
from core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Basic health check endpoint.
    
    Returns:
        Dictionary with health status
    """
    return {
        "status": "healthy",
        "version": settings.VERSION
    }

@router.get("/health/db")
async def database_health_check(db: Session = Depends(get_db)) -> Dict[str, str]:
    """
    Database health check endpoint.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with database health status
    """
    try:
        # Try to execute a simple query
        db.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        } 