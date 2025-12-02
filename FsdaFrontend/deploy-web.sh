#!/bin/bash

# Web App Deployment Script for Food Systems Analytics
# This script builds and deploys the React Native Web app to production

set -e  # Exit on any error

echo "🌐 Starting Web App Deployment"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WEB_APP_DIR="/var/www/fsvc-app"
REMOTE_USER="ubuntu"
REMOTE_HOST="13.60.137.180"
SSH_KEY="~/fsda_key.pem"

echo -e "${BLUE}Step 1:${NC} Building web app locally..."
npm run build:web

echo -e "${BLUE}Step 2:${NC} Creating deployment directory on server..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "sudo mkdir -p $WEB_APP_DIR && sudo chown -R $REMOTE_USER:$REMOTE_USER $WEB_APP_DIR"

echo -e "${BLUE}Step 3:${NC} Uploading web build to server..."
rsync -avz -e "ssh -i $SSH_KEY" web-build/ $REMOTE_USER@$REMOTE_HOST:$WEB_APP_DIR/

echo -e "${BLUE}Step 4:${NC} Setting correct permissions..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "sudo chown -R www-data:www-data $WEB_APP_DIR && sudo chmod -R 755 $WEB_APP_DIR"

echo -e "${GREEN}✅ Web app deployed successfully!${NC}"
echo ""
echo "Web app is now available at: https://foodsystemsanalytics.com/app"
echo ""
