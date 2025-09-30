# Research Data Collection Tool - Full Project Structure

## Project Root Structure

```
research-data-collector/
├── backend/                 # Django backend
├── analytics/              # FastAPI analytics engine
├── mobile/                 # Kivy mobile app
├── shared/                 # Shared utilities and models
├── cloud/                  # Cloud deployment configs
├── tests/                  # Test suites
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── requirements/           # Environment-specific requirements
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
└── Makefile
```

## 1. Django Backend Setup

### Create Django Project and Apps

```bash
# Create backend directory and navigate
mkdir -p data-collector/backend
cd data-collector/backend

# Create Django project
django-admin startproject core .

# Create Django apps
python manage.py startapp authentication
python manage.py startapp projects
python manage.py startapp forms
python manage.py startapp responses
python manage.py startapp sync
python manage.py startapp api
```

### Django Project Structure

```
backend/
├── core/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── development.py
│   │   ├── production.py
│   │   └── testing.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── authentication/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   ├── managers.py
│   └── permissions.py
├── projects/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── forms/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── validators.py
├── responses/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── sync/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── tasks.py
│   └── utils.py
├── api/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── urls.py
│   │   └── views.py
│   └── middleware.py
├── static/
├── media/
├── templates/
└── manage.py
```

### Django Settings Structure Script

```bash
#!/bin/bash
# scripts/setup_django_settings.sh

# Create settings directory
mkdir -p backend/core/settings

# Create base settings
cat > backend/core/settings/base.py << 'EOF'
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')

DEBUG = False

ALLOWED_HOSTS = []

# Application definition
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'django_filters',
    'drf_yasg',
]

LOCAL_APPS = [
    'authentication',
    'projects',
    'forms',
    'responses',
    'sync',
    'api',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
EOF

# Create development settings
cat > backend/core/settings/development.py << 'EOF'
from .base import *

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'dev_db.sqlite3',
    }
}

CORS_ALLOW_ALL_ORIGINS = True
EOF
```

## 2. FastAPI Analytics Engine Setup

### Create FastAPI Structure Script

```bash
#!/bin/bash
# scripts/setup_fastapi.sh

# Create analytics directory structure
mkdir -p data-collect/analytics/{app,core,services,models,utils,tests}

# Create main FastAPI app
cat > data-collect/analytics/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.api.v1.router import api_router
from core.config import settings
from core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Research Analytics Engine",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
EOF

# Create directory structure
mkdir -p data-collect/analytics/app/api/v1/{endpoints,dependencies}
mkdir -p data-collect/analytics/app/analytics/{descriptive,inferential,qualitative,auto_detect}
mkdir -p data-collect/analytics/app/sync

# Create __init__.py files
find research-data-collector/analytics -type d -exec touch {}/__init__.py \;
```

### FastAPI Project Structure

```
analytics/
├── main.py
├── app/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       ├── dependencies/
│   │       │   ├── __init__.py
│   │       │   └── auth.py
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── analytics.py
│   │           ├── sync.py
│   │           └── health.py
│   ├── analytics/
│   │   ├── __init__.py
│   │   ├── descriptive/
│   │   │   ├── __init__.py
│   │   │   ├── statistics.py
│   │   │   └── distributions.py
│   │   ├── inferential/
│   │   │   ├── __init__.py
│   │   │   ├── hypothesis_testing.py
│   │   │   └── correlation.py
│   │   ├── qualitative/
│   │   │   ├── __init__.py
│   │   │   ├── text_analysis.py
│   │   │   └── sentiment.py
│   │   └── auto_detect/
│   │       ├── __init__.py
│   │       └── detector.py
│   └── sync/
│       ├── __init__.py
│       ├── manager.py
│       └── conflict_resolver.py
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── database.py
│   └── security.py
├── models/
│   ├── __init__.py
│   ├── analytics.py
│   └── sync.py
├── services/
│   ├── __init__.py
│   ├── analytics_service.py
│   └── sync_service.py
├── utils/
│   ├── __init__.py
│   ├── compression.py
│   └── validators.py
└── tests/
    ├── __init__.py
    ├── test_analytics.py
    └── test_sync.py
```

### FastAPI Core Configuration Script

```bash
#!/bin/bash
# scripts/setup_fastapi_core.sh

# Create config.py
cat > data-collect/analytics/core/config.py << 'EOF'
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Research Analytics Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./analytics.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # Analytics
    MAX_BATCH_SIZE: int = 1000
    ANALYTICS_TIMEOUT: int = 300  # 5 minutes
    
    class Config:
        env_file = ".env"

settings = Settings()
EOF

# Create router.py
cat > data-collect/analytics/app/api/v1/router.py << 'EOF'
from fastapi import APIRouter
from app.api.v1.endpoints import analytics, sync, health

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
EOF
```

## 3. Kivy GUI Setup

### Create Kivy Structure Script

```bash
#!/bin/bash
# scripts/setup_kivy.sh

# Create mobile app directory structure
mkdir -p data-collect/gui/{screens,widgets,models,utils,services,assets}
mkdir -p data-collect/gui/assets/{images,fonts,sounds}
mkdir -p data-collect/gui/kv

# Create main.py
cat > data-collect/gui/main.py << 'EOF'
import os
os.environ['KIVY_LOG_MODE'] = 'PYTHON'

from kivy.app import App
from kivy.uix.screenmanager import ScreenManager
from kivy.core.window import Window
from kivy.utils import platform

# Import screens
from screens.login import LoginScreen
from screens.dashboard import DashboardScreen
from screens.projects import ProjectsScreen
from screens.data_collection import DataCollectionScreen
from screens.analytics import AnalyticsScreen
from screens.form_builder import FormBuilderScreen
from screens.sync import SyncScreen

# Import services
from services.database import DatabaseService
from services.sync_service import SyncService
from services.auth_service import AuthService

class ResearchCollectorApp(App):
    def build(self):
        # Set window size for development
        if platform != 'android':
            Window.size = (768, 1024)
        
        # Initialize services
        self.db_service = DatabaseService()
        self.sync_service = SyncService()
        self.auth_service = AuthService()
        
        # Create screen manager
        sm = ScreenManager()
        
        # Add screens
        sm.add_widget(LoginScreen(name='login'))
        sm.add_widget(DashboardScreen(name='dashboard'))
        sm.add_widget(ProjectsScreen(name='projects'))
        sm.add_widget(DataCollectionScreen(name='data_collection'))
        sm.add_widget(AnalyticsScreen(name='analytics'))
        sm.add_widget(FormBuilderScreen(name='form_builder'))
        sm.add_widget(SyncScreen(name='sync'))
        
        return sm
    
    def on_start(self):
        # Initialize database
        self.db_service.init_database()
        
    def on_pause(self):
        # Handle app pause (Android)
        return True
    
    def on_resume(self):
        # Handle app resume (Android)
        pass

if __name__ == '__main__':
    ResearchCollectorApp().run()
EOF

# Create __init__.py files
find data-collect/gui -type d -exec touch {}/__init__.py \;
```

### Kivy Project Structure

```
gui/
├── main.py
├── buildozer.spec
├── screens/
│   ├── __init__.py
│   ├── login.py
│   ├── dashboard.py
│   ├── projects.py
│   ├── data_collection.py
│   ├── analytics.py
│   ├── form_builder.py
│   └── sync.py
├── widgets/
│   ├── __init__.py
│   ├── stat_card.py
│   ├── project_item.py
│   ├── question_widget.py
│   ├── chart_widget.py
│   └── sync_indicator.py
├── models/
│   ├── __init__.py
│   ├── project.py
│   ├── question.py
│   ├── response.py
│   └── user.py
├── services/
│   ├── __init__.py
│   ├── database.py
│   ├── sync_service.py
│   ├── auth_service.py
│   ├── analytics_service.py
│   └── offline_queue.py
├── utils/
│   ├── __init__.py
│   ├── validators.py
│   ├── formatters.py
│   └── constants.py
├── kv/
│   ├── login.kv
│   ├── dashboard.kv
│   ├── projects.kv
│   ├── data_collection.kv
│   ├── analytics.kv
│   └── form_builder.kv
└── assets/
    ├── images/
    ├── fonts/
    └── sounds/
```

### Kivy Database Service Script

```bash
#!/bin/bash
# scripts/setup_kivy_services.sh

# Create database service
cat > data-collect/mobile/services/database.py << 'EOF'
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from kivy.utils import platform

class DatabaseService:
    def __init__(self):
        if platform == 'android':
            from android.storage import app_storage_path
            self.db_path = Path(app_storage_path()) / 'research_data.db'
        else:
            self.db_path = Path.home() / 'research_data.db'
        
        self.conn = None
        
    def init_database(self):
        """Initialize SQLite database with schema"""
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        
        # Create tables
        self._create_tables()
        
    def _create_tables(self):
        """Create all necessary tables"""
        cursor = self.conn.cursor()
        
        # Projects table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sync_status TEXT DEFAULT 'pending',
                cloud_id TEXT
            )
        ''')
        
        # Questions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id),
                question_text TEXT NOT NULL,
                question_type TEXT NOT NULL,
                options TEXT,
                validation_rules TEXT,
                order_index INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sync_status TEXT DEFAULT 'pending'
            )
        ''')
        
        # Responses table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id),
                question_id TEXT REFERENCES questions(id),
                respondent_id TEXT,
                response_value TEXT,
                response_metadata TEXT,
                collected_by TEXT,
                collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sync_status TEXT DEFAULT 'pending'
            )
        ''')
        
        # Sync queue table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                attempts INTEGER DEFAULT 0,
                last_attempt TIMESTAMP,
                status TEXT DEFAULT 'pending'
            )
        ''')
        
        self.conn.commit()
    
    def close(self):
        if self.conn:
            self.conn.close()
EOF
```

### Buildozer Specification

```bash
#!/bin/bash
# Create buildozer.spec
cat > data-collect/gui/buildozer.spec << 'EOF'
[app]
title = Research Data Collector
package.name = researchcollector
package.domain = org.research

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,db,json

version = 1.0.0

requirements = python3,kivy==2.2.1,kivymd==1.1.1,pillow,requests,sqlalchemy,pandas,numpy,matplotlib,scikit-learn,nltk

# Android specific
android.permissions = INTERNET,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE,ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION,CAMERA
android.api = 31
android.minapi = 21
android.ndk = 23b
android.accept_sdk_license = True
android.arch = arm64-v8a

# iOS specific
ios.kivy_ios_url = https://github.com/kivy/kivy-ios
ios.kivy_ios_branch = master
ios.ios_deploy_url = https://github.com/phonegap/ios-deploy
ios.ios_deploy_branch = 1.7.0

[buildozer]
log_level = 2
warn_on_root = 1
EOF
```

## 4. Requirements Files

### Main Requirements Script

```bash
#!/bin/bash
# scripts/create_requirements.sh

# Create requirements directory
mkdir -p research-data-collector/requirements

# Base requirements
cat > research-data-collector/requirements/base.txt << 'EOF'
# Core Python packages
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-dateutil==2.8.2
pytz==2023.3

# Database
sqlalchemy==2.0.23
alembic==1.12.1
databases==0.8.0

# Data processing
pandas==2.1.4
numpy==1.26.2
scipy==1.11.4
scikit-learn==1.3.2

# Utilities
requests==2.31.0
httpx==0.25.2
aiofiles==23.2.1
python-multipart==0.0.6
pillow==10.1.0

# Security
cryptography==41.0.7
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Logging
loguru==0.7.2
EOF

# Django requirements
cat > research-data-collector/requirements/django.txt << 'EOF'
-r base.txt

# Django
Django==5.0.1
django-cors-headers==4.3.1
django-filter==23.5
django-extensions==3.2.3

# Django REST Framework
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.1
drf-yasg==1.21.7

# Database
psycopg2-binary==2.9.9
django-redis==5.4.0

# Task Queue
celery==5.3.4
redis==5.0.1

# Storage
django-storages==1.14.2
boto3==1.34.11

# Testing
pytest-django==4.7.0
factory-boy==3.3.0
EOF

# FastAPI requirements
cat > research-data-collector/requirements/fastapi.txt << 'EOF'
-r base.txt

# FastAPI
fastapi==0.108.0
uvicorn[standard]==0.25.0
gunicorn==21.2.0

# Analytics packages
statsmodels==0.14.1
matplotlib==3.8.2
seaborn==0.13.0
plotly==5.18.0

# NLP/Text analysis
nltk==3.8.1
textblob==0.17.1
wordcloud==1.9.3
spacy==3.7.2

# Machine Learning
xgboost==2.0.3
lightgbm==4.2.0

# Task Queue
celery==5.3.4
redis==5.0.1

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2
EOF

# Kivy requirements
cat > research-data-collector/requirements/kivy.txt << 'EOF'
-r base.txt

# Kivy
Kivy==2.2.1
kivymd==1.1.1
kivy-garden==0.1.5

# Android specific
pyjnius==1.5.0
plyer==2.1.0
android==1.0

# UI Components
kivysome==0.2.1

# Local database
peewee==3.17.0

# Charts and visualization
matplotlib==3.8.2
kivy-garden.matplotlib==0.1.0

# Networking
requests==2.31.0
urllib3==2.1.0

# Build tools
buildozer==1.5.0
cython==3.0.7
EOF

# Production requirements
cat > research-data-collector/requirements/production.txt << 'EOF'
-r django.txt
-r fastapi.txt

# Production servers
gunicorn==21.2.0
supervisor==4.2.5

# Monitoring
sentry-sdk==1.39.1
prometheus-client==0.19.0

# Performance
uvloop==0.19.0
orjson==3.9.10

# Security
python-decouple==3.8
EOF

# Development requirements
cat > research-data-collector/requirements/development.txt << 'EOF'
-r base.txt
-r django.txt
-r fastapi.txt
-r kivy.txt

# Development tools
ipython==8.19.0
ipdb==0.13.13

# Code quality
black==23.12.1
flake8==7.0.0
isort==5.13.2
mypy==1.8.0
pylint==3.0.3

# Testing
pytest==7.4.3
pytest-cov==4.1.0
pytest-mock==3.12.0
tox==4.11.4

# Documentation
sphinx==7.2.6
sphinx-rtd-theme==2.0.0

# Pre-commit
pre-commit==3.6.0
EOF

# Main requirements.txt
cat > research-data-collector/requirements.txt << 'EOF'
# Install development requirements by default
-r requirements/development.txt
EOF
```

## 5. Additional Setup Scripts

### Git Ignore

```bash
#!/bin/bash
# Create .gitignore
cat > research-data-collector/.gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv

# Django
*.log
db.sqlite3
media/
staticfiles/
.env

# FastAPI
analytics.db
.pytest_cache/

# Kivy
.buildozer/
bin/
*.apk
*.aab

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.tox/
.pytest_cache/

# Documentation
docs/_build/
EOF
```

### Docker Compose

```bash
#!/bin/bash
# Create docker-compose.yml
cat > research-data-collector/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # Django Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/research_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

  # FastAPI Analytics
  analytics:
    build:
      context: ./analytics
      dockerfile: Dockerfile
    volumes:
      - ./analytics:/app
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/analytics_db
      - REDIS_URL=redis://redis:6379/1
    depends_on:
      - db
      - redis

  # PostgreSQL Database
  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=research_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Celery Worker
  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A core worker -l info
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/research_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
EOF
```

### Makefile

```bash
#!/bin/bash
# Create Makefile
cat > data-collect/Makefile << 'EOF'
.PHONY: help install dev migrate test build clean

help:
	@echo "Available commands:"
	@echo "  install    - Install all dependencies"
	@echo "  dev        - Run development servers"
	@echo "  migrate    - Run database migrations"
	@echo "  test       - Run all tests"
	@echo "  build      - Build mobile app"
	@echo "  clean      - Clean temporary files"

install:
	pip install -r requirements.txt
	cd backend && python manage.py migrate
	cd gui && buildozer android debug

dev:
	# Start all services in development mode
	docker-compose up -d db redis
	cd backend && python manage.py runserver &
	cd analytics && uvicorn main:app --reload --port 8001 &
	cd gui && python main.py

migrate:
	cd backend && python manage.py makemigrations
	cd backend && python manage.py migrate

test:
	cd backend && pytest
	cd analytics && pytest
	cd mobile && python -m pytest tests/

build:
	cd gui && buildozer android release

clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .buildozer
	rm -rf bin
EOF
```

## Quick Start Commands

```bash
# 1. Clone and setup
git clone <repository>
cd data-collect

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Setup Django
cd backend
python manage.py migrate
python manage.py createsuperuser

# 5. Run development servers
make dev

# 6. Build mobile app
cd gui
buildozer android debug
```

This complete project structure provides:
- Modular architecture for easy maintenance
- Clear separation of concerns
- Comprehensive requirements management
- Docker support for easy deployment
- Build automation with Makefile
- All necessary configuration files

The structure is designed to support the offline-first architecture with proper sync mechanisms and analytics capabilities as outlined in your development plan.