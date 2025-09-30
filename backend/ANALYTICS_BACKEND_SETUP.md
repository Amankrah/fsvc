# Analytics Backend Setup Guide

## Overview

This guide will help you set up the FastAPI analytics backend with proper Django integration for the data collection platform.

## Prerequisites

- Python 3.8+ with virtual environment activated
- Django backend already configured
- All required dependencies installed

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Navigate to the FastAPI backend directory
cd backend/fastapi

# Install required packages
pip install -r requirements.txt
```

### 2. Setup Django Database

The FastAPI backend needs access to the Django database. Run this first:

```bash
# Navigate to the backend directory (NOT fastapi)
cd backend

# Run the Django database setup script
python setup_django_db.py
```

This will:
- Run Django migrations
- Create the database if it doesn't exist
- Test the database connection
- Check for sample data

### 3. Test Django Integration

Test that the FastAPI backend can properly connect to Django:

```bash
# From the fastapi directory
cd fastapi

# Run the Django import test
python test_django_import.py
```

This should show successful Django setup and model imports.

### 4. Test Analytics Utilities

Verify that the analytics utilities are working:

```bash
# Run the analytics utilities test
python test_analytics_utils.py
```

This should show all tests passing (except Django setup which we fixed).

### 5. Start the Analytics Backend

```bash
# Start the FastAPI server
python start_analytics_backend.py
```

The server should start on `http://localhost:8001` with:
- API Documentation: `http://localhost:8001/docs`
- Health Check: `http://localhost:8001/api/v1/analytics/health`

## Directory Structure

```
backend/
├── django_core/                 # Django project
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   └── ...
├── fastapi/                     # FastAPI analytics backend
│   ├── app/
│   │   ├── analytics/           # Analytics algorithms
│   │   ├── api/                 # API endpoints
│   │   └── utils/               # Shared utilities
│   ├── core/                    # Core configuration
│   └── ...
├── manage.py                    # Django management
├── setup_django_db.py          # Django setup script
└── db.sqlite3                  # SQLite database
```

## Configuration Details

### Django Settings

The FastAPI backend uses the Django development settings:
- Settings module: `django_core.settings.development`
- Database: SQLite (`db.sqlite3`)
- Debug mode: Enabled

### Python Path Setup

The FastAPI backend adds the following to `sys.path`:
- `backend/` - To import `django_core`
- `backend/fastapi/` - For FastAPI modules

### Database Integration

The FastAPI backend connects to Django's database using:
- Django ORM for model access
- SQLAlchemy for additional queries
- Proper transaction handling

## Troubleshooting

### Common Issues

1. **"No module named 'django_core'"**
   - Run `python setup_django_db.py` from the `backend/` directory
   - Verify Django is installed: `pip install django`

2. **"Database connection failed"**
   - Run Django migrations: `python manage.py migrate`
   - Check database permissions

3. **"Analytics import failed"**
   - Install missing dependencies: `pip install -r requirements.txt`
   - Check for missing packages like `pingouin`, `textblob`, etc.

4. **"Port already in use"**
   - Kill existing processes on port 8001
   - Or change port in `start_analytics_backend.py`

### Debug Mode

Run with debug logging:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --log-level debug
```

### Test Individual Components

```bash
# Test Django connection only
python test_django_import.py

# Test analytics utilities only
python test_analytics_utils.py

# Test specific endpoints
curl http://localhost:8001/api/v1/analytics/health
```

## API Endpoints

Once running, the following endpoints are available:

### Health Check
```
GET /api/v1/analytics/health
```

### Project Analytics
```
GET /api/v1/analytics/project/{project_id}/stats
GET /api/v1/analytics/project/{project_id}/data-characteristics
GET /api/v1/analytics/project/{project_id}/recommendations
POST /api/v1/analytics/project/{project_id}/analyze
```

### Custom Analysis
```
POST /api/v1/analytics/project/{project_id}/analyze/custom
```

## Integration with GUI

The Kivy GUI connects to the FastAPI backend at:
- Base URL: `http://127.0.0.1:8001`
- Service: `gui/services/analytics_service.py`
- Screen: `gui/screens/analytics.py`

## Development

### Adding New Analytics

1. Create algorithm in `app/analytics/`
2. Add to `app/utils/shared.py`
3. Update API endpoints in `app/api/v1/endpoints/analytics.py`
4. Test with `test_analytics_utils.py`

### Database Changes

1. Make Django model changes
2. Create migrations: `python manage.py makemigrations`
3. Apply migrations: `python manage.py migrate`
4. Update FastAPI database integration if needed

## Security Notes

- Development mode uses DEBUG=True
- CORS is enabled for all origins
- Secret keys should be changed for production
- SQLite is used for development (consider PostgreSQL for production)

## Performance

- Analytics results are cached for 5 minutes
- Large datasets are automatically sampled
- Background processing for long-running analyses
- Async database operations where possible

## Next Steps

1. Set up the Django backend if not already done
2. Install dependencies and run setup scripts
3. Start the FastAPI analytics backend
4. Test the API endpoints
5. Run the GUI application
6. Test end-to-end analytics functionality

For additional help, see the main `ANALYTICS_INTEGRATION_GUIDE.md` file. 