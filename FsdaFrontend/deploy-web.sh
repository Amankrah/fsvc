#!/bin/bash

# Web App Deployment Script for Food Systems Analytics
# This script builds and deploys the React Native Web app to production

set -e  # Exit on any error

echo "🌐 Starting Web App Deployment"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
WEB_APP_DIR="/var/www/fsvc-app"
REMOTE_USER="ubuntu"
REMOTE_HOST="13.60.137.180"
SSH_KEY="../fsda_key.pem"

# Verify SSH key exists
if [ ! -f "$SSH_KEY" ]; then
  echo -e "${RED}❌ Error: SSH key not found at $SSH_KEY${NC}"
  exit 1
fi

echo -e "${BLUE}Step 0:${NC} Cleaning up old build..."
rm -rf web-build
echo -e "${GREEN}✓ Old build removed${NC}"

echo -e "${BLUE}Step 1:${NC} Building production web app..."
EXPO_PUBLIC_ENVIRONMENT=production EXPO_PUBLIC_API_URL=https://foodsystemsanalytics.com/api npm run build:web
echo -e "${GREEN}✓ Build completed${NC}"

# Verify build exists
if [ ! -f "web-build/index.html" ]; then
  echo -e "${RED}❌ Error: Build failed - index.html not found${NC}"
  exit 1
fi

echo -e "${BLUE}Step 2:${NC} Fixing asset paths for /app base URL..."
# The baseUrl in app.config.js should handle most paths, but we ensure all are correct
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS sed syntax
  sed -i '' 's|href="/favicon\.ico"|href="/app/favicon.ico"|g' web-build/index.html
  sed -i '' 's|src="/_expo/|src="/app/_expo/|g' web-build/index.html
else
  # Linux sed syntax
  sed -i 's|href="/favicon\.ico"|href="/app/favicon.ico"|g' web-build/index.html
  sed -i 's|src="/_expo/|src="/app/_expo/|g' web-build/index.html
fi
echo -e "${GREEN}✓ Asset paths fixed${NC}"

echo -e "${BLUE}Step 3:${NC} Creating deployment directory on server..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "sudo mkdir -p $WEB_APP_DIR && sudo chown -R $REMOTE_USER:$REMOTE_USER $WEB_APP_DIR"
echo -e "${GREEN}✓ Deployment directory ready${NC}"

echo -e "${BLUE}Step 4:${NC} Uploading web build to server..."
rsync -avz --delete -e "ssh -i $SSH_KEY" web-build/ $REMOTE_USER@$REMOTE_HOST:$WEB_APP_DIR/
echo -e "${GREEN}✓ Files uploaded${NC}"

echo -e "${BLUE}Step 5:${NC} Setting correct permissions..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "sudo chown -R www-data:www-data $WEB_APP_DIR && sudo chmod -R 755 $WEB_APP_DIR"
echo -e "${GREEN}✓ Permissions set${NC}"

echo -e "${BLUE}Step 6:${NC} Verifying deployment..."
RESPONSE=$(ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "ls -la $WEB_APP_DIR/index.html 2>&1" || echo "error")
if [[ "$RESPONSE" == *"error"* ]] || [[ "$RESPONSE" == *"No such file"* ]]; then
  echo -e "${RED}❌ Deployment verification failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Deployment verified${NC}"

echo ""
echo -e "${GREEN}✅ Web app deployed successfully!${NC}"
echo ""
echo -e "📱 Web app is now available at: ${BLUE}https://foodsystemsanalytics.com/app${NC}"
echo -e "🔧 Environment: ${YELLOW}production${NC}"
echo -e "🌐 API URL: ${YELLOW}https://foodsystemsanalytics.com/api${NC}"
echo ""
