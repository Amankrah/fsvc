"""
Configuration settings for the FastAPI analytics engine.
"""

import os
from typing import List

class Settings:
    PROJECT_NAME: str = "Research Analytics Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    
    # CORS settings
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://10.122.115.54:8000",  # Mobile device access
        "http://10.0.0.42:8000",      # Alternative IP
        "*",  # Allow all origins for development
    ]
    
    # Django database settings
    DJANGO_SETTINGS_MODULE: str = "django_core.settings.development"
    
    # Analytics settings
    MAX_ANALYSIS_ROWS: int = 10000
    DEFAULT_SAMPLE_SIZE: int = 1000
    
    # File paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DJANGO_PROJECT_DIR: str = os.path.join(BASE_DIR, "..")

settings = Settings() 