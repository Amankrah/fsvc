# Response Links Migration Instructions

## Issue Fixed

The import error in `backend/responses/link_views.py` has been fixed by removing the non-existent import:
```python
# REMOVED: from utils.conditionalLogic import filterQuestionsWithConditions
# ADDED: from django.db import models
```

## Steps to Run Migrations

### 1. Activate Virtual Environment

Open a new PowerShell terminal and run:

```powershell
cd C:\Users\eakwofie\Desktop\dev_project\fsvc\backend
.\venv\Scripts\Activate.ps1
```

If you get an execution policy error, run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Create Migrations

```powershell
python manage.py makemigrations responses
```

Expected output:
```
Migrations for 'responses':
  responses/migrations/0XXX_responselink.py
    - Create model ResponseLink
```

### 3. Apply Migrations

```powershell
python manage.py migrate
```

Expected output:
```
Operations to perform:
  Apply all migrations: ...
Running migrations:
  Applying responses.0XXX_responselink... OK
```

### 4. Verify Migration

```powershell
python manage.py showmigrations responses
```

You should see a checkmark [X] next to the new migration.

### 5. Start the Server

```powershell
python manage.py runserver
```

The server should now start without errors.

## Migration Details

The migration will create a `responses_responselink` table with the following fields:

- `id` (UUID, primary key)
- `token` (CharField, unique, indexed)
- `project_id` (ForeignKey)
- `created_by_id` (ForeignKey)
- `question_set` (JSONField)
- `respondent_type` (CharField)
- `commodity` (CharField)
- `country` (CharField)
- `title` (CharField)
- `description` (TextField)
- `is_active` (BooleanField)
- `expires_at` (DateTimeField)
- `max_responses` (PositiveIntegerField)
- `response_count` (PositiveIntegerField, default=0)
- `access_count` (PositiveIntegerField, default=0)
- `auto_expire_after_use` (BooleanField)
- `created_at` (DateTimeField, auto_now_add)
- `last_accessed_at` (DateTimeField, null=True)

## Troubleshooting

### Error: "No module named 'django'"
**Solution**: Activate the virtual environment (Step 1)

### Error: "No changes detected"
**Solution**: The migration may already exist. Check with `python manage.py showmigrations responses`

### Error: "Import error in link_views.py"
**Solution**: Already fixed. Make sure you have the latest version of the file.

### Error: "ModuleNotFoundError: No module named 'utils'"
**Solution**: Already fixed by removing the import from link_views.py

## Next Steps After Migration

1. Test the API endpoints:
   ```bash
   # Create a link
   curl -X POST http://localhost:8000/api/v1/response-links/ \
     -H "Authorization: Token YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "project": "PROJECT_UUID",
       "question_set": ["QUESTION_UUID_1", "QUESTION_UUID_2"],
       "title": "Test Survey",
       "expiration_days": 7
     }'
   ```

2. Test the mobile app:
   - Navigate to Data Collection
   - Generate questions
   - Click share icon
   - Create a link
   - View in Response Links screen

3. Optional: Create a test link via Django admin:
   - Go to http://localhost:8000/admin/
   - Navigate to Responses → Response links
   - Click "Add Response Link"
   - Fill in the fields and save

## Production Deployment

Before deploying to production:

1. Update `FRONTEND_URL` in Django settings:
   ```python
   FRONTEND_URL = 'https://yourdomain.com'
   ```

2. Configure CORS:
   ```python
   CORS_ALLOWED_ORIGINS = [
       'https://yourdomain.com',
   ]
   ```

3. Run migrations on production:
   ```bash
   python manage.py migrate
   ```

4. Collect static files:
   ```bash
   python manage.py collectstatic
   ```

5. Restart the application server

---

**Status**: Ready to migrate ✅
**Date**: January 2025
