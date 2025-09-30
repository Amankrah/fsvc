#!/usr/bin/env python3
"""
Simple test to check if Django imports work from FastAPI backend.
"""

import os
import sys
from pathlib import Path

print("🔍 Testing Django Import from FastAPI Backend")
print("=" * 50)

# Show current working directory
print(f"Current working directory: {os.getcwd()}")

# Setup correct paths
fastapi_dir = Path(__file__).parent.resolve()  # backend/fastapi/
backend_dir = fastapi_dir.parent  # backend/
project_root = backend_dir.parent  # data_collect/
django_project_dir = backend_dir / "django_core"  # backend/django_core/

print(f"FastAPI directory: {fastapi_dir}")
print(f"Backend directory: {backend_dir}")
print(f"Project root: {project_root}")
print(f"Django project directory: {django_project_dir}")

# Check if directories exist
print(f"\nDirectory checks:")
print(f"FastAPI dir exists: {fastapi_dir.exists()}")
print(f"Backend dir exists: {backend_dir.exists()}")
print(f"Django project dir exists: {django_project_dir.exists()}")

# Check if Django settings files exist
settings_dir = django_project_dir / "settings"
dev_settings = settings_dir / "development.py"
print(f"Django settings dir exists: {settings_dir.exists()}")
print(f"Development settings exist: {dev_settings.exists()}")

# Add paths to sys.path
print(f"\nAdding paths to sys.path:")
sys.path.insert(0, str(fastapi_dir))
sys.path.insert(0, str(backend_dir))
print(f"Added: {fastapi_dir}")
print(f"Added: {backend_dir}")

# Show current Python path
print(f"\nCurrent Python path:")
for i, path in enumerate(sys.path[:10]):  # Show first 10
    print(f"  {i}: {path}")

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
print(f"\nDjango settings module: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

# Test Django import
print(f"\nTesting Django import...")
try:
    import django
    print(f"✅ Django imported successfully (version: {django.get_version()})")
    
    # Test Django setup
    print(f"Setting up Django...")
    django.setup()
    print(f"✅ Django setup successful")
    
    # Test Django models import
    print(f"Testing Django models import...")
    from django.conf import settings
    print(f"✅ Django settings imported")
    print(f"Debug mode: {settings.DEBUG}")
    print(f"Database engine: {settings.DATABASES['default']['ENGINE']}")
    
    # Test app models
    print(f"Testing app models import...")
    from projects.models import Project
    from forms.models import Question
    from responses.models import Response
    from authentication.models import User
    print(f"✅ All Django models imported successfully")
    
    # Test database connection
    print(f"Testing database connection...")
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
    print(f"✅ Database connection successful: {result}")
    
    print(f"\n🎉 All Django tests passed!")
    
except ImportError as e:
    print(f"❌ Django import failed: {e}")
    print(f"   Make sure Django is installed and paths are correct")
    
except Exception as e:
    print(f"❌ Django setup failed: {e}")
    print(f"   Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()

print(f"\n" + "=" * 50)
print(f"Django import test complete") 