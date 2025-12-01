#!/bin/bash

# Food Systems Analytics Production Deployment Script
# Domain: foodsystemsanalytics.com
# Run this script on your AWS EC2 instance

set -e  # Exit on any error

echo "🚀 Starting Food Systems Analytics Production Deployment"

# Configuration
PROJECT_DIR="/var/www/fsvc"
BACKEND_DIR="$PROJECT_DIR/backend"
FASTAPI_DIR="$BACKEND_DIR/fastapi"
WEB_SURVEY_DIR="$PROJECT_DIR/web-survey"
VENV_DIR="$BACKEND_DIR/venv"
DOMAIN="foodsystemsanalytics.com"
IP="13.60.137.180"

# Email for SSL certificate (update this)
ADMIN_EMAIL="dishdevinfo@gmail.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to ensure virtual environment is activated
activate_venv() {
    if [ ! -f "$VENV_DIR/bin/activate" ]; then
        print_error "Virtual environment not found at $VENV_DIR"
        exit 1
    fi

    source $VENV_DIR/bin/activate

    if [ "$VIRTUAL_ENV" != "$VENV_DIR" ]; then
        print_error "Failed to activate virtual environment"
        exit 1
    fi

    print_status "Virtual environment active: $VIRTUAL_ENV"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

echo "========================================"
echo "  Food Systems Analytics Deployment"
echo "  Domain: $DOMAIN"
echo "  IP: $IP"
echo "========================================"
echo ""

# 1. System Dependencies
print_step "Step 1: Installing system dependencies..."
sudo apt update
sudo apt install -y \
    python3-pip python3-venv python3-dev \
    nginx supervisor certbot python3-certbot-nginx \
    postgresql postgresql-contrib libpq-dev \
    curl wget git build-essential \
    pkg-config libssl-dev

print_status "System dependencies installed ✓"

# 2. Verify project structure
print_step "Step 2: Verifying project structure..."

# Check if we're in the right directory
if [ ! -f "$BACKEND_DIR/manage.py" ]; then
    print_error "Project structure not found. Make sure the repository is cloned to $PROJECT_DIR"
    print_error "Expected file: $BACKEND_DIR/manage.py"
    exit 1
fi

# Check for requirements.txt
if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
    print_error "requirements.txt not found at $BACKEND_DIR/requirements.txt"
    exit 1
fi

print_status "Project structure verified ✓"

# 3. Create project directory permissions
print_status "Setting up project directory permissions..."
sudo chown -R $USER:$USER $PROJECT_DIR

# 4. Setup Python virtual environment
print_step "Step 3: Setting up Python virtual environment..."
cd $BACKEND_DIR

# Remove existing venv if it exists
if [ -d "$VENV_DIR" ]; then
    print_warning "Removing existing virtual environment..."
    rm -rf $VENV_DIR
fi

# Create new virtual environment
python3 -m venv $VENV_DIR

# Verify venv was created
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    print_error "Failed to create virtual environment"
    exit 1
fi

# Activate virtual environment
activate_venv

# 5. Install Python dependencies
print_step "Step 4: Installing Python dependencies..."
pip install --upgrade pip

print_status "Installing from $BACKEND_DIR/requirements.txt"
pip install -r "$BACKEND_DIR/requirements.txt"

# Install production server
pip install gunicorn

# Verify Django is installed
python -c "import django; print(f'Django {django.__version__} installed')"

print_status "Python dependencies installed ✓"

# 6. PostgreSQL Database Setup
print_step "Step 5: Setting up PostgreSQL database..."

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw fsvc_db; then
    print_warning "Database 'fsvc_db' already exists. Skipping creation."
else
    print_status "Creating PostgreSQL database and user..."

    # Generate a random password for the database
    DB_PASSWORD=$(openssl rand -base64 32)

    sudo -u postgres psql <<EOF
CREATE DATABASE fsvc_db;
CREATE USER fsvc_user WITH PASSWORD '$DB_PASSWORD';
ALTER ROLE fsvc_user SET client_encoding TO 'utf8';
ALTER ROLE fsvc_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE fsvc_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE fsvc_db TO fsvc_user;
\c fsvc_db
GRANT ALL ON SCHEMA public TO fsvc_user;
GRANT CREATE ON SCHEMA public TO fsvc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fsvc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fsvc_user;
EOF

    print_status "PostgreSQL database created ✓"
    print_warning "Database password saved to $BACKEND_DIR/.db_password"
    echo "$DB_PASSWORD" > "$BACKEND_DIR/.db_password"
    chmod 600 "$BACKEND_DIR/.db_password"
fi

# 7. Environment configuration
print_step "Step 6: Setting up environment configuration..."

# Check if .env already exists
if [ -f "$BACKEND_DIR/.env" ]; then
    print_warning ".env file already exists. Creating backup..."
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Generate Django secret key (escape special characters for .env file)
DJANGO_SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# Read database password
if [ -f "$BACKEND_DIR/.db_password" ]; then
    DB_PASSWORD=$(cat "$BACKEND_DIR/.db_password")
else
    print_error "Database password file not found. Please set up the database first."
    exit 1
fi

print_status "Creating Django environment file..."
cat > $BACKEND_DIR/.env << 'EOF_MARKER'
# Django Configuration
DJANGO_SECRET_KEY='REPLACE_SECRET_KEY'
DJANGO_SETTINGS_MODULE=django_core.settings.production
DEBUG=False

# Allowed Hosts
ALLOWED_HOSTS=REPLACE_DOMAIN,www.REPLACE_DOMAIN,REPLACE_IP,localhost,127.0.0.1

# Database Configuration
DB_ENGINE=django.db.backends.postgresql
DB_NAME=fsvc_db
DB_USER=fsvc_user
DB_PASSWORD='REPLACE_DB_PASSWORD'
DB_HOST=localhost
DB_PORT=5432

# Frontend URL (for shareable survey links)
FRONTEND_URL=https://REPLACE_DOMAIN

# CORS Origins
CORS_ALLOWED_ORIGINS=https://REPLACE_DOMAIN,https://www.REPLACE_DOMAIN

# Email Configuration (update with your SMTP settings)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-password
DEFAULT_FROM_EMAIL=noreply@REPLACE_DOMAIN

# Environment
ENVIRONMENT=production
EOF_MARKER

# Replace placeholders with actual values using sed
sed -i "s|REPLACE_SECRET_KEY|$DJANGO_SECRET_KEY|g" $BACKEND_DIR/.env
sed -i "s|REPLACE_DOMAIN|$DOMAIN|g" $BACKEND_DIR/.env
sed -i "s|REPLACE_IP|$IP|g" $BACKEND_DIR/.env
sed -i "s|REPLACE_DB_PASSWORD|$DB_PASSWORD|g" $BACKEND_DIR/.env

# Verify the .env file was created
if [ -f "$BACKEND_DIR/.env" ]; then
    print_status "Environment file created successfully ✓"
    chmod 600 "$BACKEND_DIR/.env"
else
    print_error "Failed to create .env file"
    exit 1
fi

# Update production.py to use environment variables
print_status "Updating production settings to use PostgreSQL..."
cat > $BACKEND_DIR/django_core/settings/production.py << 'EOF'
"""
Production settings for the backend application.
"""

import os
from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

# Database - PostgreSQL for production
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'fsvc_db'),
        'USER': os.getenv('DB_USER', 'fsvc_user'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Email settings
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')

# Allowed hosts
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Static and media files
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_ROOT = BASE_DIR / 'mediafiles'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs/django.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
EOF

print_status "Production settings updated ✓"

# 8. FastAPI Configuration (if exists)
if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_step "Step 7: Configuring FastAPI analytics service..."

    cat > $FASTAPI_DIR/.env << EOF
# FastAPI Configuration
API_HOST=127.0.0.1
API_PORT=8001

# CORS Settings
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

# Environment
ENVIRONMENT=production

# Logging
LOG_LEVEL=info
EOF

    print_status "FastAPI configuration created ✓"
else
    print_warning "FastAPI directory not found, skipping FastAPI configuration"
fi

# 9. Django Setup - Migrations and Static Files
print_step "Step 8: Running Django migrations and collecting static files..."

# Create logs directory
mkdir -p $BACKEND_DIR/logs

# Load environment variables (using export to avoid bash parsing issues with special chars)
export DJANGO_SECRET_KEY="$DJANGO_SECRET_KEY"
export DJANGO_SETTINGS_MODULE="django_core.settings.production"
export DB_NAME="fsvc_db"
export DB_USER="fsvc_user"
export DB_PASSWORD="$DB_PASSWORD"
export DB_HOST="localhost"
export DB_PORT="5432"

# Run migrations
print_status "Running database migrations..."
cd $BACKEND_DIR
python manage.py migrate --settings=django_core.settings.production

# Collect static files
print_status "Collecting static files..."
python manage.py collectstatic --noinput --settings=django_core.settings.production

# Create superuser (optional - will prompt for password)
print_warning "You can create a superuser now or skip this step"
read -p "Create Django superuser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python manage.py createsuperuser --settings=django_core.settings.production
fi

print_status "Django setup completed ✓"

# 10. Nginx configuration - HTTP only (SSL will be added after certbot)
print_step "Step 9: Configuring Nginx..."

# Create initial HTTP-only nginx configuration
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
# Upstream definitions
upstream django_backend {
    server 127.0.0.1:8000 fail_timeout=30s;
}

upstream fastapi_analytics {
    server 127.0.0.1:8001 fail_timeout=30s;
}

# HTTP server - temporary configuration for SSL setup
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN $IP;

    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client body size limit (for file uploads)
    client_max_body_size 100M;

    # Common proxy settings
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_redirect off;
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;

    # Static files
    location /static/ {
        alias $BACKEND_DIR/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Media files
    location /media/ {
        alias $BACKEND_DIR/mediafiles/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # FastAPI analytics endpoints (if exists)
    location /api/v1/analytics/ {
        proxy_pass http://fastapi_analytics;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://django_backend;
    }

    # Django API endpoints
    location /api/ {
        proxy_pass http://django_backend;
    }

    # Web survey - served by Django
    location /survey/ {
        proxy_pass http://django_backend;
    }

    # Django docs (if using drf_yasg)
    location /swagger/ {
        proxy_pass http://django_backend;
    }

    location /redoc/ {
        proxy_pass http://django_backend;
    }

    # Django main application
    location / {
        proxy_pass http://django_backend;
    }

    # Error pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/html;
        internal;
    }
}
EOF

# Enable the site and test configuration
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if ! sudo nginx -t; then
    print_error "Nginx configuration test failed"
    exit 1
fi

print_status "Nginx HTTP configuration completed ✓"

# Create a simple error page
sudo mkdir -p /var/www/html
sudo tee /var/www/html/50x.html > /dev/null << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Food Systems Analytics - Service Temporarily Unavailable</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            text-align: center;
            margin-top: 100px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }
        h1 { color: white; font-size: 2.5em; margin-bottom: 20px; }
        p { color: #e0e7ff; font-size: 1.2em; }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Food Systems Analytics</h1>
        <h2>Service Temporarily Unavailable</h2>
        <p>Our services are starting up. Please try again in a moment.</p>
        <p style="font-size: 0.9em; margin-top: 30px;">Research Data Collection Platform</p>
    </div>
</body>
</html>
EOF

# 11. Supervisor configuration for services
print_step "Step 10: Configuring Supervisor for service management..."

# Django backend configuration with Gunicorn
sudo tee /etc/supervisor/conf.d/fsvc-django.conf > /dev/null << EOF
[program:fsvc-django]
command=$VENV_DIR/bin/gunicorn django_core.wsgi:application --bind 127.0.0.1:8000 --workers 4 --timeout 300 --access-logfile - --error-logfile -
directory=$BACKEND_DIR
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/fsvc-django.log
stderr_logfile=/var/log/fsvc-django-error.log
environment=PATH="$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin",DJANGO_SETTINGS_MODULE="django_core.settings.production"
stopwaitsecs=60
EOF

print_status "Django supervisor configuration created ✓"

# FastAPI configuration (if exists)
if [ -f "$FASTAPI_DIR/main.py" ]; then
    sudo tee /etc/supervisor/conf.d/fsvc-fastapi.conf > /dev/null << EOF
[program:fsvc-fastapi]
command=$VENV_DIR/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --workers 2
directory=$FASTAPI_DIR
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/fsvc-fastapi.log
stderr_logfile=/var/log/fsvc-fastapi-error.log
environment=PATH="$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin"
stopwaitsecs=60
EOF
    print_status "FastAPI supervisor configuration created ✓"
fi

# 12. Create log files with proper permissions
print_status "Setting up log files..."
sudo touch /var/log/fsvc-django.log
sudo touch /var/log/fsvc-django-error.log
sudo chown $USER:$USER /var/log/fsvc-*.log

if [ -f "$FASTAPI_DIR/main.py" ]; then
    sudo touch /var/log/fsvc-fastapi.log
    sudo touch /var/log/fsvc-fastapi-error.log
    sudo chown $USER:$USER /var/log/fsvc-fastapi*.log
fi

# 13. SSL Certificate with Let's Encrypt
print_step "Step 11: Setting up SSL certificate with Let's Encrypt..."

# Ensure required certbot files exist
sudo mkdir -p /etc/letsencrypt
if [ ! -f "/etc/letsencrypt/options-ssl-nginx.conf" ]; then
    print_status "Downloading certbot SSL configuration files..."
    sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf -o /etc/letsencrypt/options-ssl-nginx.conf 2>/dev/null || true
    sudo curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem -o /etc/letsencrypt/ssl-dhparams.pem 2>/dev/null || true
fi

# Start nginx for Let's Encrypt challenge
print_status "Starting Nginx for SSL certificate verification..."
sudo systemctl start nginx

# Get SSL certificate
print_status "Requesting SSL certificate from Let's Encrypt..."
print_warning "Make sure your DNS is configured: $DOMAIN → $IP"
print_warning "Press Ctrl+C to cancel if DNS is not ready, or wait..."
sleep 5

if [ -z "$ADMIN_EMAIL" ] || [ "$ADMIN_EMAIL" = "your-email@example.com" ]; then
    print_error "Please update ADMIN_EMAIL in the script with your actual email address"
    print_warning "Skipping SSL setup. You can run 'sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN' manually later"
else
    if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $ADMIN_EMAIL --redirect; then
        print_status "SSL certificate installed successfully ✓"

        # Verify SSL certificate was installed
        if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
            # Test configuration and reload
            if sudo nginx -t; then
                sudo systemctl reload nginx
                print_status "HTTPS configuration activated ✓"
            else
                print_error "Nginx configuration test failed after SSL setup"
            fi
        fi
    else
        print_error "SSL certificate installation failed"
        print_warning "Continuing with HTTP-only configuration"
        print_warning "You can run 'sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN' manually later"
        print_warning "Make sure your domain DNS is properly configured and pointing to $IP"
    fi
fi

# 14. Start services
print_step "Step 12: Starting services..."
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
sudo systemctl enable nginx supervisor postgresql
sudo systemctl restart supervisor
sudo systemctl reload nginx

# Wait for services to start
print_status "Waiting for services to initialize..."
sleep 10

# Check service status
print_status "Checking service status..."
sudo supervisorctl status

# 15. Firewall configuration
print_step "Step 13: Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw allow 5432/tcp  # PostgreSQL (only if you need remote access)
sudo ufw --force enable

print_status "Firewall configured ✓"

# 16. Setup automatic SSL renewal
print_status "Setting up automatic SSL certificate renewal..."
(sudo crontab -l 2>/dev/null || true; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | sudo crontab -

# 17. Health check
print_step "Step 14: Running health checks..."
sleep 5

print_status "Testing Django backend..."
if curl -f http://localhost:8000 > /dev/null 2>&1; then
    print_status "✓ Django is responding"
else
    print_warning "Django health check failed - check logs: sudo tail -f /var/log/fsvc-django.log"
fi

if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_status "Testing FastAPI analytics..."
    if curl -f http://localhost:8001 > /dev/null 2>&1; then
        print_status "✓ FastAPI is responding"
    else
        print_warning "FastAPI health check failed - check logs: sudo tail -f /var/log/fsvc-fastapi.log"
    fi
fi

# 18. Performance optimization
print_step "Step 15: Performance optimization..."

# Enable gzip compression in nginx
print_status "Enabling gzip compression..."
if ! grep -q "gzip on;" /etc/nginx/nginx.conf; then
    sudo sed -i '/http {/a \        gzip on;\n        gzip_vary on;\n        gzip_proxied any;\n        gzip_comp_level 6;\n        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n        gzip_min_length 1000;' /etc/nginx/nginx.conf
    sudo systemctl reload nginx
fi

print_status "Performance optimization completed ✓"

# 19. Create update script for easy redeployment
print_status "Creating update script..."
sudo tee /usr/local/bin/fsvc-update.sh > /dev/null << 'EOFUPDATE'
#!/bin/bash
set -e

echo "🔄 Updating Food Systems Analytics..."

cd /var/www/fsvc

# Pull latest changes
git pull origin main

# Update Python dependencies
echo "Updating Django dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Load environment variables
set -a
source .env
set +a

# Run migrations
echo "Running migrations..."
python manage.py migrate --settings=django_core.settings.production

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --settings=django_core.settings.production

# Restart services
echo "Restarting services..."
sudo supervisorctl restart fsvc-django
[ -f "fastapi/main.py" ] && sudo supervisorctl restart fsvc-fastapi
sudo systemctl reload nginx

echo "✅ Update complete!"
EOFUPDATE

sudo chmod +x /usr/local/bin/fsvc-update.sh

print_status "✅ Food Systems Analytics Production Deployment Complete!"
echo ""
echo "=========================================="
echo "  🎉 Deployment Successful!"
echo "=========================================="
echo ""
print_status "Your Food Systems Analytics application is now running at:"
print_status "🌍 https://$DOMAIN (once DNS propagates and SSL is configured)"
print_status "📍 http://$IP (direct IP access)"
echo ""
print_status "Services deployed:"
print_status "├─ Django Backend: https://$DOMAIN → port 8000 (Gunicorn)"
if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_status "├─ FastAPI Analytics: https://$DOMAIN/api/v1/analytics/ → port 8001"
fi
print_status "├─ PostgreSQL Database: localhost:5432"
print_status "└─ Web Survey: Served by Django at /survey/"
echo ""
print_status "Architecture:"
print_status "├─ Django (REST API + Admin): Research data collection"
if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_status "├─ FastAPI (Analytics): Modular analytics engine"
fi
print_status "├─ PostgreSQL: Production database"
print_status "└─ Nginx: Reverse proxy with SSL"
echo ""
print_status "Next steps:"
print_status "1. Update ADMIN_EMAIL in this script and re-run SSL setup if needed"
print_status "2. Configure your domain DNS on GoDaddy:"
print_status "   • A Record: @ → $IP"
print_status "   • A Record: www → $IP"
print_status "3. Update email settings in $BACKEND_DIR/.env"
print_status "4. Verify DNS propagation: dig $DOMAIN"
print_status "5. Test the deployment: curl https://$DOMAIN"
print_status "6. Monitor logs:"
print_status "   • Django: sudo tail -f /var/log/fsvc-django.log"
if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_status "   • FastAPI: sudo tail -f /var/log/fsvc-fastapi.log"
fi
echo ""
print_status "Service management:"
print_status "• Status: sudo supervisorctl status"
print_status "• Restart Django: sudo supervisorctl restart fsvc-django"
if [ -f "$FASTAPI_DIR/main.py" ]; then
    print_status "• Restart FastAPI: sudo supervisorctl restart fsvc-fastapi"
fi
print_status "• Reload Nginx: sudo systemctl reload nginx"
print_status "• View PostgreSQL: sudo -u postgres psql fsvc_db"
echo ""
print_status "Quick update:"
print_status "• Run: sudo /usr/local/bin/fsvc-update.sh"
echo ""
print_status "Admin access:"
print_status "• Django Admin: https://$DOMAIN/admin/"
print_status "• API Documentation: https://$DOMAIN/swagger/"
echo ""
print_status "Important files:"
print_status "• Environment: $BACKEND_DIR/.env"
print_status "• DB Password: $BACKEND_DIR/.db_password"
print_status "• Nginx Config: /etc/nginx/sites-available/$DOMAIN"
print_status "• Supervisor: /etc/supervisor/conf.d/fsvc-*.conf"
echo ""
print_warning "Security reminders:"
print_warning "1. Update email settings in .env for production use"
print_warning "2. Keep .env and .db_password files secure (already set to 600)"
print_warning "3. Regularly backup your PostgreSQL database"
print_warning "4. Monitor logs for security issues"
echo ""
print_status "🎉 Deployment complete! Your Research Data Collection Platform is ready!"
