"""
Development settings for the backend application.
"""

from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            # Wait up to 30s for a write lock instead of failing immediately.
            # Prevents "database is locked" when concurrent requests (e.g.
            # notification polling vs save_draft) hit SQLite simultaneously.
            'timeout': 30,
        },
    }
}

# Email settings
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# CORS settings for development
CORS_ALLOW_ALL_ORIGINS = True

# Allowed hosts for development and testing
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '10.0.0.42', '10.122.115.54', 'testserver', '*']

# Internal IPs for development
INTERNAL_IPS = ['127.0.0.1', '10.0.0.42', '10.122.115.54'] 