# Django Backend Connection Guide

Your React Native frontend is now fully integrated with your Django backend authentication system!

## ✅ What's Been Configured

### Backend Integration
- **Django Token Authentication** - Uses DRF Token auth (not JWT)
- **API Base URL** - Configured in `src/config/env.ts`
- **Auth Endpoints** - Matches your Django URLs exactly:
  - `POST /api/auth/login/`
  - `POST /api/auth/register/`
  - `POST /api/auth/logout/`
  - `GET /api/auth/profile/`

### Frontend Updates
- **API Service** (`src/services/api.ts`) - Uses `Token <token>` header format
- **Auth Store** (`src/store/authStore.ts`) - Stores single token (not access/refresh)
- **Login Screen** - Accepts email + password
- **Register Screen** - Includes all Django required fields:
  - email, username, password, password2
  - first_name, last_name
  - role (defaults to 'researcher')
  - institution (optional)

## 🚀 Quick Start

### 1. Start Your Django Backend

```bash
cd backend
python manage.py runserver
```

Your backend should now be running at `http://localhost:8000`

### 2. Configure Frontend Connection

The frontend is already configured to connect to `http://localhost:8000/api` for desktop development.

**For different scenarios**, edit `FsdaFrontend/src/config/env.ts`:

```typescript
// Desktop/same machine (default)
const DEV_API_URL = 'http://localhost:8000/api';

// Android emulator
const DEV_API_URL = 'http://10.0.2.2:8000/api';

// Physical device (use your computer's IP)
const DEV_API_URL = 'http://192.168.1.X:8000/api';
```

**Find your IP address:**
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

### 3. Enable CORS in Django

Make sure your Django backend allows requests from the Expo dev server.

Edit `backend/django_core/settings/development.py`:

```python
# CORS settings for development
CORS_ALLOW_ALL_ORIGINS = True  # For development only!

# Or more restrictive:
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",  # Expo web
    "http://localhost:19006", # Expo web alternative
]
```

### 4. Run the Frontend

```bash
cd FsdaFrontend
npm start
```

Then:
- Press `w` for web browser
- Press `a` for Android (requires emulator)
- Press `i` for iOS (requires macOS + simulator)

## 📱 Testing Authentication

### Register a New User

1. Open the app and tap "Register"
2. Fill in all required fields:
   - Email: `test@example.com`
   - Username: `testuser`
   - First Name: `Test`
   - Last Name: `User`
   - Password: `password123`
   - Confirm Password: `password123`
3. Tap "Create Account"
4. You'll be automatically logged in and redirected to Home

### Login

1. Tap "Sign In" from register screen
2. Enter:
   - Email: `test@example.com`
   - Password: `password123`
3. Tap "Sign In"
4. You'll see the Home screen with your user info

## 🔍 How It Works

### Authentication Flow

```
┌─────────────┐                    ┌─────────────┐
│   Frontend  │                    │   Django    │
│  (Tablet)   │                    │   Backend   │
└─────────────┘                    └─────────────┘
       │                                  │
       │  POST /api/auth/register/        │
       │  { email, username, password, …} │
       ├─────────────────────────────────>│
       │                                  │
       │  { token, user }                 │
       │<─────────────────────────────────┤
       │                                  │
       │  Stores token in EncryptedStorage│
       │                                  │
       │  POST /api/auth/profile/         │
       │  Header: Token <token>           │
       ├─────────────────────────────────>│
       │                                  │
       │  { user data }                   │
       │<─────────────────────────────────┤
       │                                  │
```

### Token Storage

- Token stored securely using `react-native-encrypted-storage`
- User data stored separately as JSON
- Automatically loaded on app restart
- Cleared on logout or 401 error

### API Request Headers

Every authenticated request includes:
```
Authorization: Token a1b2c3d4e5f6...
Content-Type: application/json
```

## 🛠️ Troubleshooting

### "Network request failed"

**Check:**
1. Django backend is running (`python manage.py runserver`)
2. Backend URL in `src/config/env.ts` is correct
3. CORS is enabled in Django settings
4. Firewall isn't blocking port 8000

**For Android Emulator:**
- Use `http://10.0.2.2:8000/api` instead of `localhost`

**For Physical Device:**
- Use your computer's IP address
- Make sure device is on same WiFi network
- Check Windows Firewall allows inbound connections on port 8000

### "Invalid credentials"

**Check:**
1. Email and password are correct
2. User exists in Django database
3. Check Django console for error messages

**Verify user in Django:**
```bash
python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> User.objects.all()
```

### "Email: user with this email already exists"

The user is already registered. Either:
1. Use the Login screen instead
2. Use a different email
3. Delete the user from Django admin

### Registration validation errors

Django validates:
- Email format and uniqueness
- Username (3+ chars, unique)
- Password strength (Django validators)
- Required fields (first_name, last_name)

Check error message for specific field issues.

### Token authentication not working

**Verify Token Auth is enabled in Django:**

`backend/django_core/settings/base.py`:
```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'rest_framework.authtoken',
    ...
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
}
```

**Check token exists:**
```bash
python manage.py shell
>>> from rest_framework.authtoken.models import Token
>>> Token.objects.all()
```

## 📊 API Response Formats

### Login Response
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user_data": {
    "id": "123",
    "email": "user@example.com",
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "role": "researcher",
    "institution": "University"
  }
}
```

### Register Response
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "role": "researcher",
    "institution": "University"
  }
}
```

### Error Response
```json
{
  "email": ["user with this email already exists."],
  "username": ["This field may not be blank."]
}
```

## 🔐 Security Features

✅ **Encrypted Storage** - Tokens stored using hardware-backed encryption
✅ **Token Auth** - Django Rest Framework Token authentication
✅ **HTTPS Ready** - Configure `PROD_API_URL` for production
✅ **Password Validation** - Django validators (min length, common passwords, etc.)
✅ **Auto-logout on 401** - Clears auth on token expiration
✅ **Input Validation** - Zod schemas on frontend, Django validators on backend

## 📝 Next Steps

### Add More Endpoints

Update `src/services/api.ts` to add more methods:

```typescript
// Projects
async getProjects() {
  return await this.get('/projects/');
}

async createProject(data: any) {
  return await this.post('/projects/', data);
}

// Forms
async getForms() {
  return await this.get('/forms/');
}
```

### Add More Screens

1. Create screen component in `src/screens/`
2. Add route in `src/navigation/RootNavigator.tsx`
3. Navigate using: `navigation.navigate('ScreenName')`

### Production Deployment

1. Set `PROD_API_URL` in `src/config/env.ts`
2. Enable HTTPS on Django backend
3. Update CORS settings to your production domain
4. Build app: `eas build --platform android`

## 📚 File Reference

### Key Files Modified
- `src/config/env.ts` - Backend URL configuration
- `src/services/api.ts` - Django API client with Token auth
- `src/store/authStore.ts` - Authentication state management
- `src/screens/LoginScreen.tsx` - Email/password login
- `src/screens/RegisterScreen.tsx` - Full registration form
- `src/screens/HomeScreen.tsx` - User profile display

### Django Backend Files
- `backend/authentication/views.py` - Auth endpoints
- `backend/authentication/urls.py` - Auth URL routes
- `backend/authentication/serializers.py` - Data validation
- `backend/django_core/urls.py` - Main URL configuration
- `backend/django_core/settings/base.py` - DRF Token auth config

---

**Everything is ready to go! Just start both servers and test the authentication flow.** 🎉