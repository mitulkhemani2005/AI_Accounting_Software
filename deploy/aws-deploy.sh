#!/bin/bash
# ==============================================================================
# FundSafe ERP - AWS Production Deployment Script
# ==============================================================================

set -e

echo "=============================================="
echo " Deploying FundSafe ERP (Production on AWS)   "
echo "=============================================="

# 1. Check or Auto-Generate .env file
if [ ! -f .env ]; then
    echo "[1/4] .env file not found. Auto-generating secure production configuration..."
    chmod +x deploy/generate-secrets.sh
    ./deploy/generate-secrets.sh
else
    echo "[1/4] Production .env file found."
fi

# 2. Pull latest code (if in git repo)
if [ -d .git ]; then
    echo "[2/4] Pulling latest changes from git repository..."
    git pull origin main || echo "Git pull skipped."
fi

# 3. Build & Run Docker Containers
echo "[3/4] Building production images with Docker Compose..."
# For Free Tier (t2.micro / t3.micro), sequential builds prevent memory spikes
docker compose -f docker-compose.prod.yml --env-file .env build

echo "[4/4] Starting services in detached mode..."
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

# 4. Check Health & Running Containers
sleep 5
echo ""
echo "=============================================="
echo " Service Status:                              "
echo "=============================================="
docker compose -f docker-compose.prod.yml ps

PUBLIC_IP=$(curl -s --connect-timeout 3 http://checkip.amazonaws.com 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "=============================================="
echo " Deployment completed successfully!          "
echo " Web App URL:   http://$PUBLIC_IP"
echo " Backend API:   http://$PUBLIC_IP/api/v1/health"
echo " API Docs:      http://$PUBLIC_IP/docs"
echo "=============================================="
