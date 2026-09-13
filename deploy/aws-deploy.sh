#!/bin/bash
# ==============================================================================
# FundSafe ERP - AWS Production Deployment Script
# ==============================================================================

set -e

echo "=============================================="
echo " Deploying FundSafe ERP (Production on AWS)   "
echo "=============================================="

# 1. Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found in root directory!"
    echo "Please copy .env.production to .env and configure your secrets."
    exit 1
fi

# 2. Pull latest code (if in git repo)
if [ -d .git ]; then
    echo "[1/4] Pulling latest changes from git branch..."
    git pull origin main || echo "Git pull skipped or working tree clean."
fi

# 3. Build & Run Docker Containers
echo "[2/4] Building production images with Docker Compose..."
docker compose -f docker-compose.prod.yml --env-file .env build --parallel

echo "[3/4] Starting services in detached mode..."
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

# 4. Check Health & Running Containers
echo "[4/4] Verifying container health..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo "=============================================="
echo " Deployment completed successfully!          "
echo " Web App URL:   http://<YOUR_AWS_IP_OR_DOMAIN>"
echo " Backend API:   http://<YOUR_AWS_IP_OR_DOMAIN>/api/v1/health"
echo " API Swagger:   http://<YOUR_AWS_IP_OR_DOMAIN>/docs"
echo "=============================================="
