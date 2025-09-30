# Streamlined Analytics Engine

A simplified, efficient analytics engine for the Research Data Collection Tool.

## Overview

This streamlined analytics engine provides:
- **Consolidated API endpoints** for all analytics functionality
- **Direct Django database connection** for real-time data analysis  
- **Smart auto-detection** of appropriate analysis methods
- **Minimal dependencies** for easy deployment

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Kivy GUI Frontend                       │
│                (analytics_service.py)                   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP requests
                      ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Analytics Engine                   │
│                  (Port 8001)                           │
├─────────────────────────────────────────────────────────┤
│  📊 /api/v1/analytics/project/{id}/stats              │
│  📈 /api/v1/analytics/project/{id}/analyze            │
│  💡 /api/v1/analytics/project/{id}/recommendations    │
│  🔍 /api/v1/analytics/project/{id}/data-characteristics│
│  ❤️  /api/v1/analytics/health                         │
└─────────────────────┬───────────────────────────────────┘
                      │ SQLite queries
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Django SQLite Database                     │
│                 (db.sqlite3)                           │
└─────────────────────────────────────────────────────────┘
```

## Installation

1. **Install dependencies:**
   ```bash
   cd backend/analytics
   pip install -r requirements.txt
   ```

2. **Start the analytics engine:**
   ```bash
   python start_analytics.py
   ```

   Or manually:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```

## API Endpoints

### Project Statistics
```
GET /api/v1/analytics/project/{project_id}/stats
```
Returns basic project statistics including response counts, completion rates, and data quality metrics.

### Data Analysis
```
POST /api/v1/analytics/project/{project_id}/analyze
Body: {"analysis_type": "auto|descriptive|correlation|text"}
```
Runs the specified analysis on project data:
- `auto`: Runs all applicable analyses
- `descriptive`: Basic statistics and summaries
- `correlation`: Correlation analysis for numeric variables
- `text`: Basic text analysis for text fields

### Analysis Recommendations
```
GET /api/v1/analytics/project/{project_id}/recommendations
```
Returns smart recommendations for appropriate analysis methods based on data characteristics.

### Data Characteristics  
```
GET /api/v1/analytics/project/{project_id}/data-characteristics
```
Returns detailed information about data types, quality, and structure.

### Health Check
```
GET /api/v1/analytics/health
```
Returns service health status and database connectivity.

## Usage Examples

### Basic Usage
```python
import requests

# Get project statistics
response = requests.get('http://localhost:8001/api/v1/analytics/project/123/stats')
stats = response.json()

# Run automatic analysis
response = requests.post(
    'http://localhost:8001/api/v1/analytics/project/123/analyze',
    json={'analysis_type': 'auto'}
)
results = response.json()
```

### Frontend Integration
The GUI analytics service automatically uses these endpoints:

```python
# In analytics_service.py
analytics_service = AnalyticsService(auth_service, db_service)

# Get recommendations
recommendations = analytics_service.get_analysis_recommendations(project_id)

# Run analysis
results = analytics_service.run_descriptive_analysis(project_id)
```

## Data Flow

1. **GUI Request**: Frontend requests analysis for a project
2. **API Call**: Analytics service calls FastAPI endpoint
3. **Data Retrieval**: FastAPI queries Django SQLite database directly
4. **Analysis**: Pandas DataFrame processing with appropriate analytics
5. **Response**: Structured JSON response with results
6. **Caching**: Results cached for 5 minutes to improve performance

## Configuration

Edit `core/config.py` to customize:

```python
class Settings(BaseSettings):
    PROJECT_NAME: str = "Research Analytics Engine"
    DATABASE_URL: str = "sqlite:///./analytics.db"  # Change as needed
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    MAX_BATCH_SIZE: int = 1000
    ANALYTICS_TIMEOUT: int = 300
```

## Database Schema

The analytics engine connects directly to Django's SQLite database:

```sql
-- Key tables used:
responses_response    -- Survey responses
forms_question       -- Question definitions  
projects_project     -- Project metadata
authentication_user  -- User information
```

## Error Handling

The system includes comprehensive error handling:
- **Graceful degradation**: Falls back to local analysis if API fails
- **Timeout protection**: Prevents long-running analyses from blocking
- **Caching**: Reduces load and improves response times
- **Standardized responses**: Consistent error message format

## Development

### Adding New Analysis Types

1. **Add method to `AnalyticsUtils`**:
   ```python
   @staticmethod
   def run_new_analysis(df: pd.DataFrame) -> Dict[str, Any]:
       # Implementation here
       pass
   ```

2. **Update analytics endpoint**:
   ```python
   elif analysis_type == "new_analysis":
       results['analyses']['new_analysis'] = AnalyticsUtils.run_new_analysis(df)
   ```

3. **Update frontend service**:
   ```python
   def run_new_analysis(self, project_id: str) -> Dict:
       return self._make_analytics_request(
           f'project/{project_id}/analyze', 
           method='POST', 
           data={'analysis_type': 'new_analysis'}
       )
   ```

### Testing

```bash
# Test health endpoint
curl http://localhost:8001/api/v1/analytics/health

# Test with project data
curl -X POST http://localhost:8001/api/v1/analytics/project/123/analyze \
  -H "Content-Type: application/json" \
  -d '{"analysis_type": "auto"}'
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**: Ensure Django SQLite database exists
2. **Port 8001 in use**: Change port in `start_analytics.py`
3. **Missing dependencies**: Run `pip install -r requirements.txt`
4. **CORS errors**: Update `BACKEND_CORS_ORIGINS` in config

### Logs

Check console output for detailed error messages and debugging information.

## Performance

- **Response time**: < 2 seconds for typical analyses
- **Memory usage**: Optimized for datasets up to 10,000 responses
- **Concurrent requests**: Supports multiple simultaneous analyses
- **Caching**: 5-minute cache for frequently accessed results

## Security

- **No authentication required**: Internal service for local use
- **CORS configured**: Restricts access to specified origins
- **Input validation**: Sanitizes all user inputs
- **Error handling**: Prevents information leakage in error messages 