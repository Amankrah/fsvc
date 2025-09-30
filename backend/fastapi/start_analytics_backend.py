#!/usr/bin/env python3
"""
Startup script for the FastAPI analytics backend.
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = [
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('pandas', 'pandas'),
        ('numpy', 'numpy'),
        ('django', 'django'),
        ('scipy', 'scipy'),
        ('sklearn', 'scikit-learn'),
        ('textblob', 'textblob'),
        ('nltk', 'nltk'),
        ('pingouin', 'pingouin')
    ]
    
    missing_packages = []
    
    for package_name, install_name in required_packages:
        try:
            __import__(package_name)
        except ImportError:
            missing_packages.append(install_name)
    
    if missing_packages:
        print(f"❌ Missing dependencies: {', '.join(missing_packages)}")
        print("Please install the missing packages:")
        print("pip install -r requirements.txt")
        print("Or install individually:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    else:
        print("✅ All core dependencies are available")
        return True

def setup_django():
    """Setup Django environment"""
    try:
        # Add Django project to Python path
        # FastAPI is in backend/fastapi/, Django is in backend/django_core/
        fastapi_dir = Path(__file__).parent  # backend/fastapi/
        backend_dir = fastapi_dir.parent  # backend/
        django_project_dir = backend_dir / "django_core"  # backend/django_core/
        
        # Add backend/ to path so we can import django_core
        sys.path.insert(0, str(backend_dir))
        
        # Set Django settings
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
        
        # Initialize Django
        import django
        django.setup()
        print("✅ Django setup completed")
        return True
    except Exception as e:
        print(f"❌ Django setup failed: {e}")
        return False

def start_backend():
    """Start the FastAPI backend"""
    try:
        print("🚀 Starting FastAPI Analytics Backend...")
        print("📊 Backend URL: http://localhost:8001")
        print("📖 API Documentation: http://localhost:8001/docs")
        print("💡 Health Check: http://localhost:8001/api/v1/analytics/health")
        print("\nPress Ctrl+C to stop the server\n")
        
        # Run uvicorn server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8001", 
            "--reload"
        ])
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Failed to start server: {e}")

def main():
    """Main startup function"""
    print("🔧 Setting up FastAPI Analytics Backend...")
    
    # Change to FastAPI directory
    fastapi_dir = Path(__file__).parent
    os.chdir(fastapi_dir)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup Django
    if not setup_django():
        print("\n💡 Django setup failed. Try running the Django setup script first:")
        print("   cd backend")
        print("   python setup_django_db.py")
        print("   cd fastapi")
        print("   python start_analytics_backend.py")
        sys.exit(1)
    
    # Start backend
    start_backend()

if __name__ == "__main__":
    main() 