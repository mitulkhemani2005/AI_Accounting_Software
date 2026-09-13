#!/bin/bash
# ==============================================================================
# FundSafe ERP - Automatic Zero-Effort Secrets Generator
# Generates a production .env file with secure passwords & auto-detected AWS IP
# ==============================================================================

set -e

ENV_FILE=".env"

echo "=============================================="
echo " FundSafe ERP - Automatic Secrets Generator   "
echo "=============================================="

# If .env already exists, ask or keep existing
if [ -f "$ENV_FILE" ]; then
    echo "Notice: An existing .env file was found."
    echo "Keeping existing secrets to prevent overwriting database credentials."
    exit 0
fi

echo "Detecting your server public IP address..."
PUBLIC_IP=$(curl -s --connect-timeout 4 http://checkip.amazonaws.com 2>/dev/null || curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || curl -s --connect-timeout 4 ifconfig.me 2>/dev/null || echo "127.0.0.1")

echo "Server Public IP detected: $PUBLIC_IP"

echo "Generating cryptographically secure secrets..."
# Generate 64-char JWT secret key
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)

# Generate 32-char PostgreSQL password
POSTGRES_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p -c 16 2>/dev/null || date +%s%N | sha256sum | head -c 32)

echo "Writing auto-generated .env configuration..."

cat <<EOF > "$ENV_FILE"
# ==============================================================================
# FundSafe ERP - Production Environment Configuration (Auto-Generated)
# ==============================================================================

ENVIRONMENT=production
PROJECT_NAME="FundSafe ERP"
VERSION=0.1.0
DATA_REGION=ap-south-1

# PostgreSQL Database Configuration
POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_USER=fundsafe_admin
POSTGRES_PASSWORD=$POSTGRES_PASS
POSTGRES_DB=fundsafe_erp_prod
DATABASE_URL=postgresql+asyncpg://fundsafe_admin:$POSTGRES_PASS@postgres:5432/fundsafe_erp_prod
DATABASE_SYNC_URL=postgresql://fundsafe_admin:$POSTGRES_PASS@postgres:5432/fundsafe_erp_prod

# Redis Cache
REDIS_URL=redis://redis:6379/0

# Security & JWT Authentication
JWT_SECRET_KEY=$JWT_SECRET
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS Allowed Origins
CORS_ORIGINS=http://$PUBLIC_IP,http://localhost,http://localhost:3000,http://127.0.0.1:3000

# AI Microservice
AI_SERVICE_URL=http://ai-service:8001
BACKEND_INTERNAL_URL=http://backend:8000

# Optional Third-Party Integration Keys (Fill in anytime if needed)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
EOF

chmod 600 "$ENV_FILE"

echo "=============================================="
echo " SUCCESS: Production .env created with:      "
echo "  - Auto-generated Database Password          "
echo "  - Auto-generated 64-char JWT Secret Key     "
echo "  - Pre-configured CORS for IP: $PUBLIC_IP   "
echo "=============================================="
