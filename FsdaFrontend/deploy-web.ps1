# PowerShell Web Deployment Script for Food Systems Analytics
# This script deploys the pre-built React Native Web app to production

$ErrorActionPreference = "Stop"

Write-Host "🌐 Starting Web App Deployment" -ForegroundColor Cyan
Write-Host ""

# Configuration
$WEB_APP_DIR = "/var/www/fsvc-app"
$REMOTE_USER = "ubuntu"
$REMOTE_HOST = "13.60.137.180"
$SSH_KEY = "..\fsda_key.pem"

# Verify SSH key exists
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "❌ Error: SSH key not found at $SSH_KEY" -ForegroundColor Red
    exit 1
}

# Verify web-build exists
if (-not (Test-Path "web-build\index.html")) {
    Write-Host "❌ Error: web-build not found. Run 'npm run build:web:prod' first" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Creating deployment directory on server..." -ForegroundColor Blue
ssh -i $SSH_KEY "$REMOTE_USER@$REMOTE_HOST" "sudo mkdir -p $WEB_APP_DIR && sudo chown -R $REMOTE_USER`:$REMOTE_USER $WEB_APP_DIR"
Write-Host "✓ Deployment directory ready" -ForegroundColor Green

Write-Host "Step 2: Uploading web build to server..." -ForegroundColor Blue
scp -i $SSH_KEY -r web-build/* "$REMOTE_USER@$REMOTE_HOST`:$WEB_APP_DIR/"
Write-Host "✓ Files uploaded" -ForegroundColor Green

Write-Host "Step 3: Setting correct permissions..." -ForegroundColor Blue
ssh -i $SSH_KEY "$REMOTE_USER@$REMOTE_HOST" "sudo chown -R www-data:www-data $WEB_APP_DIR && sudo chmod -R 755 $WEB_APP_DIR"
Write-Host "✓ Permissions set" -ForegroundColor Green

Write-Host "Step 4: Verifying deployment..." -ForegroundColor Blue
$verifyResult = ssh -i $SSH_KEY "$REMOTE_USER@$REMOTE_HOST" "ls -la $WEB_APP_DIR/index.html 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment verification failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Deployment verified" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Web app deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Web app is now available at: https://foodsystemsanalytics.com/app" -ForegroundColor Blue
Write-Host "🔧 Environment: production" -ForegroundColor Yellow
Write-Host "🌐 API URL: https://foodsystemsanalytics.com/api" -ForegroundColor Yellow
Write-Host ""
