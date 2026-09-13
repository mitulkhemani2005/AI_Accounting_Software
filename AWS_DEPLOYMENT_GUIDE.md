# FundSafe ERP — 100% AWS Free Tier Deployment Guide

This guide explains how to deploy FundSafe ERP on Amazon Web Services (AWS) **100% Free Tier Eligible (₹0 / $0 Cost)** in the **ap-south-1 (Mumbai, India)** region for full Indian GST & data compliance.

---

## AWS Free Tier Breakdown (100% Free for 12 Months)

| AWS Service | Free Tier Allocation | How FundSafe ERP Uses It |
|---|---|---|
| **Amazon EC2** | 750 hours / month of `t2.micro` or `t3.micro` | Runs all Docker containers (Frontend, Backend, AI, Postgres, Redis, Nginx) |
| **Amazon EBS Storage** | Up to 30 GB gp3 / gp2 SSD storage | Storage for OS, Docker images, and database data |
| **Data Transfer Out** | 100 GB / month free | Web traffic, API requests, and invoice downloads |
| **Let's Encrypt SSL** | 100% Free SSL Certificates | Free HTTPS via Certbot |

---

## Step 1: Launch your Free Tier EC2 Instance on AWS Console

1. Log in to [AWS Management Console](https://console.aws.amazon.com/).
2. In the top-right corner, select Region: **Asia Pacific (Mumbai) `ap-south-1`**.
3. Go to **EC2** > Click **Launch Instance**:
   - **Name:** `fundsafe-erp-server`
   - **Application & OS Image (AMI):** `Ubuntu Server 24.04 LTS` (64-bit x86) — *(Free tier eligible)*
   - **Instance Type:** `t2.micro` (1 vCPU, 1 GB RAM) or `t3.micro` — *(Free tier eligible)*
   - **Key Pair (Login):** Create or select your `.pem` key pair (e.g. `fundsafe-key.pem`).
   - **Network Settings (Firewall / Security Group):** Check all 3 boxes:
     - ✅ **Allow SSH traffic from** -> `My IP`
     - ✅ **Allow HTTPS traffic from the internet** (Port 443) -> `Anywhere (0.0.0.0/0)`
     - ✅ **Allow HTTP traffic from the internet** (Port 80) -> `Anywhere (0.0.0.0/0)`
   - **Configure Storage:** Change `8 GiB` to **`30 GiB`** gp3 root volume — *(30 GB is 100% Free Tier eligible)*
4. Click **Launch Instance**.

---

## Step 2: Connect to your EC2 Instance via SSH

Open your terminal (PowerShell, Command Prompt, or Mac/Linux terminal):

```bash
# Set permissions on your key file (Mac/Linux)
chmod 400 fundsafe-key.pem

# SSH into your EC2 public IP
ssh -i "fundsafe-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

## Step 3: Run the Automated Free Tier Server Setup

Run the following commands on the server. This script automatically installs Docker, Docker Compose, sets up the UFW firewall, and configures **4GB of Swap memory** (critical so 1GB RAM instances never run out of memory during Next.js builds):

```bash
# Clone the repository
git clone https://github.com/mitulkhemani2005/AI_Accounting_Software.git fundsafe-erp
cd fundsafe-erp

# Make scripts executable and run setup
chmod +x deploy/setup-aws-ec2.sh deploy/aws-deploy.sh
./deploy/setup-aws-ec2.sh

# Apply docker group permissions immediately
newgrp docker
```

---

## Step 4: Configure Production Environment Variables

```bash
# Copy the production template
cp .env.production .env

# Edit the environment file
nano .env
```

Set your production secrets:
```ini
ENVIRONMENT=production
PROJECT_NAME="FundSafe ERP"
POSTGRES_USER=fundsafe_admin
POSTGRES_PASSWORD=CreateAStrongPasswordHere123!
POSTGRES_DB=fundsafe_erp_prod
JWT_SECRET_KEY=generate_a_random_64_character_secret_string_here
CORS_ORIGINS=http://<YOUR_EC2_PUBLIC_IP>,http://localhost:3000
```
*(Press `Ctrl+O` then `Enter` to save, and `Ctrl+X` to exit nano)*

---

## Step 5: Deploy the Entire Stack (1-Click)

```bash
./deploy/aws-deploy.sh
```

This will automatically build and start:
- 🌐 **Nginx Reverse Proxy** on Port 80 & 443
- 💻 **Next.js 14 Frontend** on Port 3000
- ⚡ **FastAPI Backend** on Port 8000
- 🤖 **AI Microservice** on Port 8001
- 🗄️ **PostgreSQL 16 Database** on Port 5432
- 🚀 **Redis 7 Cache** on Port 6379

---

## Step 6: Access Your ERP in the Browser

Open your browser and navigate to:
- **Web App:** `http://<YOUR_EC2_PUBLIC_IP>`
- **API Health Check:** `http://<YOUR_EC2_PUBLIC_IP>/api/v1/health`
- **Swagger Documentation:** `http://<YOUR_EC2_PUBLIC_IP>/docs`

---

## Step 7 (Optional): Setup Free SSL HTTPS with Custom Domain

If you have a domain (e.g. `erp.yourdomain.com`):
1. In your domain DNS manager (GoDaddy, Namecheap, Route 53, Cloudflare), add an **A record**:
   - `Host:` `@` or `erp`
   - `Points to:` `<YOUR_EC2_PUBLIC_IP>`
2. On your EC2 server, obtain and install a free SSL certificate:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d erp.yourdomain.com
   ```
3. Certbot will automatically configure HTTPS and auto-renew the certificate every 90 days for free.

---

## Maintenance & Monitoring Commands

```bash
# Check status of all containers
docker compose -f docker-compose.prod.yml ps

# View live real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Reset / Clear Database completely
docker compose -f docker-compose.prod.yml exec backend python scripts/reset_db.py

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Pull latest code and re-deploy
git pull origin main
./deploy/aws-deploy.sh
```
