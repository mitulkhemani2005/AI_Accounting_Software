# FundSafe ERP — AWS Deployment Guide

This guide provides end-to-end instructions for deploying FundSafe ERP on AWS in the **ap-south-1 (Mumbai, India)** region for Indian data localization and GST compliance.

---

## Architecture Overview

```
[ Internet / Clients ]
         │
         ▼
[ AWS Route 53 / CloudFront / ALB ]
         │
         ▼
[ Nginx Reverse Proxy (Port 80 / 443) ]
   ├── /api/v1/*   ──► FastAPI Backend (Port 8000)
   ├── /docs       ──► Swagger UI (Port 8000)
   ├── /_next/*    ──► Next.js Static Cache
   └── /*          ──► Next.js Frontend (Port 3000)
         │
    ┌────┴────────────────────────┐
    ▼                             ▼
[ PostgreSQL 16 ]            [ Redis 7 ]
(Amazon RDS / Container)     (ElastiCache / Container)
```

---

## Method 1: Fast Deployment on AWS EC2 / Lightsail (Recommended)

### Step 1: Launch an EC2 Instance
- **AMI:** Ubuntu 22.04 LTS or 24.04 LTS (64-bit x86)
- **Instance Type:** `t3.small` (2 vCPU, 2GB RAM) or `t3.medium` (2 vCPU, 4GB RAM)
- **Storage:** 20 GB gp3 SSD
- **Region:** `ap-south-1` (Mumbai)
- **Security Group Inbound Rules:**
  - `SSH` (Port 22) from your IP
  - `HTTP` (Port 80) from `0.0.0.0/0`
  - `HTTPS` (Port 443) from `0.0.0.0/0`

### Step 2: Connect to the Server & Run Setup
```bash
ssh -i "your-key.pem" ubuntu@<YOUR_AWS_EC2_PUBLIC_IP>

# Clone repository
git clone <YOUR_GIT_REPO_URL> fundsafe-erp
cd fundsafe-erp

# Run the automated server provisioner
chmod +x deploy/setup-aws-ec2.sh deploy/aws-deploy.sh
./deploy/setup-aws-ec2.sh

# Apply docker group permissions
newgrp docker
```

### Step 3: Configure Environment Variables
```bash
cp .env.production .env
nano .env
```
Ensure you fill in your production values:
- `POSTGRES_USER=fundsafe_admin`
- `POSTGRES_PASSWORD=<STRONG_GENERATED_PASSWORD>`
- `POSTGRES_DB=fundsafe_erp_prod`
- `JWT_SECRET_KEY=<SECURE_64_CHAR_RANDOM_KEY>`
- `RAZORPAY_KEY_ID=<YOUR_RAZORPAY_KEY>`
- `RAZORPAY_KEY_SECRET=<YOUR_RAZORPAY_SECRET>`
- `CORS_ORIGINS=https://yourdomain.com,http://<YOUR_EC2_IP>`

### Step 4: Deploy the Application
```bash
./deploy/aws-deploy.sh
```

### Step 5: Setup Free SSL with Let's Encrypt (Certbot)
If you have a domain pointing to your EC2 Elastic IP:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Method 2: Enterprise Managed AWS Deployment (ECS + RDS + ElastiCache)

For high availability and autoscaling:

1. **Database:** Create an **Amazon RDS PostgreSQL 16** instance (`db.t4g.small` or higher) in Multi-AZ mode.
2. **Cache:** Create an **Amazon ElastiCache for Redis** cluster.
3. **Container Registry:** Push images to **Amazon ECR**:
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
   
   docker build -t fundsafe-backend ./apps/backend
   docker tag fundsafe-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/fundsafe-backend:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/fundsafe-backend:latest
   
   docker build -t fundsafe-frontend ./apps/web-frontend
   docker tag fundsafe-frontend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/fundsafe-frontend:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/fundsafe-frontend:latest
   ```
4. **Orchestration:** Deploy using **AWS ECS Fargate** with an Application Load Balancer (ALB) and AWS Certificate Manager (ACM) SSL certificate.

---

## Useful Operations Commands

### View Live Logs
```bash
# All containers
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend only
docker compose -f docker-compose.prod.yml logs -f web-frontend
```

### Reset Database (Clear all data)
```bash
docker compose -f docker-compose.prod.yml exec backend python scripts/reset_db.py
```

### Restart All Services
```bash
docker compose -f docker-compose.prod.yml restart
```
