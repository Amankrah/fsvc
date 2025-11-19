# Web Survey Interface

This directory contains a standalone web interface for respondents to complete surveys via shareable links.

## Features

- ✨ Clean, modern UI with responsive design
- 📱 Mobile-friendly
- 🔒 Consent screen before starting survey
- ➡️ Question navigation (next/previous)
- 📊 Progress indicator
- ✅ Support for all question types:
  - Short text
  - Long text
  - Numeric (integer and decimal)
  - Single choice (radio buttons)
  - Multiple choice (checkboxes)
  - Boolean (yes/no)
- 🎯 Required field validation
- 💾 Auto-saves responses when navigating between questions

## Usage

### Development

1. The web survey interface is a single-page application that can be served from any web server
2. It communicates with the Django backend API at `/api/v1/public/links/`
3. No build process required - it's pure HTML/CSS/JavaScript

### Deployment Options

#### Option 1: Serve from Django (Simple)

Add to Django's `urls.py`:

```python
from django.views.generic import TemplateView

urlpatterns = [
    # ... existing patterns
    path('respond/<str:token>/', TemplateView.as_view(
        template_name='web-survey/index.html'
    ), name='public-survey'),
]
```

#### Option 2: Static Hosting (Recommended for Production)

Deploy `index.html` to:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages
- Any static hosting service

Update `FRONTEND_URL` in Django settings to point to your deployment URL.

### URL Format

Survey links follow this pattern:
```
https://your-domain.com/respond/{token}
```

Where `{token}` is the unique token generated when creating a shareable link.

## Configuration

The JavaScript in `index.html` automatically detects the environment:

- **Localhost**: Uses `http://localhost:8000/api/v1`
- **Production**: Uses `/api/v1` (assumes same domain as frontend)

To change the API URL, modify the `API_BASE_URL` constant in the script section of `index.html`.

## Security

- No authentication required (public endpoints)
- Links expire based on configuration
- Response limits can be set per link
- Consent is required before starting survey
- All API calls use the public endpoints that don't require authentication

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
