# FSDA Backend - Django REST API

Professional Django REST API for research data collection and analytics.

## 📋 Overview

The FSDA Backend provides a comprehensive REST API for:
- User authentication and project management
- Form builder and question management
- Response collection and storage
- Team collaboration with role-based permissions
- CSV data export
- FastAPI analytics engine integration

## 🏗️ Architecture

```
backend/
├── django_core/          # Django project settings
├── authentication/       # User authentication & JWT
├── projects/            # Project management & team collaboration
├── forms/               # Form builder & question management
├── responses/           # Response collection & export
├── sync/                # Offline sync (future feature)
├── fastapi/             # Analytics engine
│   └── app/analytics/   # Auto-detect, descriptive, inferential, qualitative
└── manage.py
```

## ✨ Key Features

### Authentication
- JWT token-based authentication
- User registration and login
- Token refresh mechanism
- Password reset functionality

### Project Management
- Create and manage research projects
- Project-specific access control
- Team collaboration features
- Project invitation system (5 roles, 10 permissions)

### Form Builder
- 12+ question types supported
- Drag-and-drop ordering
- Conditional logic (future)
- Question validation rules

### Response Management
- Store responses with quality scoring
- Respondent tracking
- CSV export functionality
- Data validation

### Team Collaboration
- Invite members to projects
- Role-based permissions: Owner, Collaborator, Analyst, Member, Viewer
- Granular permissions: view_project, edit_project, view_responses, edit_responses, delete_responses, view_analytics, run_analytics, manage_questions, export_data, all
- Invitation tokens with expiry

### Analytics (FastAPI)
- Auto-detection of appropriate analyses
- Descriptive statistics
- Inferential statistics (t-test, ANOVA, chi-square)
- Text/sentiment analysis
- Data visualization

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- pip
- PostgreSQL (production) or SQLite (development)

### Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### FastAPI Analytics Server

```bash
# In a separate terminal, navigate to fastapi directory
cd backend/fastapi

# Start FastAPI server
uvicorn main:app --reload --port 8001
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login/` - Login
- `POST /api/auth/register/` - Register
- `POST /api/auth/token/refresh/` - Refresh token
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Get current user

### Projects
- `GET /api/projects/projects/` - List projects
- `POST /api/projects/projects/` - Create project
- `GET /api/projects/projects/{id}/` - Get project details
- `PATCH /api/projects/projects/{id}/` - Update project
- `DELETE /api/projects/projects/{id}/` - Delete project

### Team Management
- `GET /api/projects/projects/{id}/members/` - Get team members
- `POST /api/projects/projects/{id}/invite_member/` - Invite member
- `PATCH /api/projects/projects/{id}/update_member/` - Update member role/permissions
- `DELETE /api/projects/projects/{id}/remove_member/` - Remove member
- `GET /api/projects/projects/get_invitation_info/?token={token}` - Get invitation details
- `POST /api/projects/projects/accept_invitation/` - Accept invitation

### Forms & Questions
- `GET /api/forms/questions/?project_id={id}` - List questions
- `POST /api/forms/questions/` - Create question
- `PATCH /api/forms/questions/{id}/` - Update question
- `DELETE /api/forms/questions/{id}/` - Delete question

### Responses
- `GET /api/responses/respondents/?project_id={id}` - List respondents
- `POST /api/responses/respondents/` - Create respondent
- `GET /api/responses/respondents/{id}/` - Get respondent details
- `GET /api/responses/respondents/{id}/responses/` - Get respondent responses
- `POST /api/responses/responses/` - Submit response
- `GET /api/responses/respondents/export_csv/?project_id={id}` - Export to CSV

### Analytics (FastAPI - Port 8001)
- `POST /api/v1/analytics/auto-detect/` - Auto-detect appropriate analyses
- `POST /api/v1/analytics/descriptive/` - Run descriptive statistics
- `POST /api/v1/analytics/inferential/` - Run inferential tests
- `POST /api/v1/analytics/qualitative/` - Run text/sentiment analysis

## 🔐 Authentication & Permissions

### Token Authentication
All endpoints (except login/register) require token authentication:

```
Authorization: Token <your-token-here>
```

### Permission Levels
- **Public**: No authentication required (login, register)
- **Authenticated**: Token required (dashboard, profile)
- **Project Member**: Must be project member
- **Project Owner**: Must be project owner (invite, remove members)

## 📦 Database Models

### User
- Standard Django user model
- Extended with profile information

### Project
- name, description
- created_by (owner)
- members (ManyToMany through ProjectMember)
- is_active

### ProjectMember
- project, user
- role (owner, collaborator, analyst, member, viewer)
- permissions (array of permission strings)
- invited_by, joined_at

### PendingInvitation
- project, email
- role, permissions
- token (secure, 32-byte)
- invited_by, created_at, expires_at

### Question
- project, question_text
- response_type (text_short, numeric_integer, choice_single, etc.)
- options (JSON for choice questions)
- validation_rules (JSON)
- is_required, order_index

### Respondent
- project, respondent_id (unique)
- name (optional), email (optional)
- is_anonymous, consent_given
- created_at, last_response_at

### Response
- project, question, respondent
- response_value (text/JSON)
- device_info (JSON)
- collected_at, quality_score

## 🔧 Configuration

### Environment Variables

Create `.env` file:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:19000,http://localhost:19006
```

For production:

```env
SECRET_KEY=<generate-secure-key>
DEBUG=False
DATABASE_URL=postgresql://user:pass@localhost:5432/fsda_db
ALLOWED_HOSTS=api.yourdom ain.com
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
```

### Django Settings

Key settings in `django_core/settings.py`:

```python
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
```

## 🧪 Testing

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test authentication
python manage.py test projects
python manage.py test responses

# With coverage
coverage run --source='.' manage.py test
coverage report
```

## 📊 CSV Export Format

When exporting responses, the CSV includes:

```csv
Respondent ID, Name, Email, Created At, Last Response At, Q1: Question 1, Q2: Question 2, ...
PROJ_A3B5_1234567, John Doe, john@example.com, 2025-01-30 10:00, 2025-01-30 10:15, Answer 1, Answer 2, ...
```

## 🚀 Deployment

### Production Setup

```bash
# Install production dependencies
pip install -r requirements.txt gunicorn psycopg2-binary

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Start with Gunicorn
gunicorn django_core.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
CMD ["gunicorn", "django_core.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## 📚 Additional Documentation

- **API Documentation**: http://localhost:8000/api/docs/ (Swagger/OpenAPI)
- **Admin Interface**: http://localhost:8000/admin/
- **FastAPI Docs**: http://localhost:8001/docs

### Specific Guides
- See `COCOA_SURVEY_README.md` for cocoa survey setup example
- See `ANALYTICS_BACKEND_SETUP.md` for analytics configuration
- See `fastapi/README.md` for FastAPI analytics documentation

## 🐛 Common Issues

### Database Locked (SQLite)
**Solution**: Use PostgreSQL in production or limit concurrent writes

### CORS Errors
**Solution**: Add frontend URL to `CORS_ALLOWED_ORIGINS` in settings

### Token Expired
**Solution**: Implement token refresh in frontend

### Migration Conflicts
**Solution**: Run `python manage.py makemigrations --merge`

## 📄 License

Proprietary and confidential.

---

**Version**: 1.0.0
**Django**: 5.0+
**Python**: 3.10+
**Status**: ✅ Production Ready
