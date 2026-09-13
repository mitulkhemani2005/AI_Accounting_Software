#!/bin/bash
# ==============================================================================
# FundSafe ERP - AWS EC2 / Lightsail Server Initialization Script
# OS: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (ap-south-1 Mumbai Region)
# ==============================================================================

set -e

echo "=========================================="
echo " Starting FundSafe ERP Server Setup (AWS) "
echo "=========================================="

# 1. Update and Upgrade System Packages
echo "[1/6] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Essential Tools
echo "[2/6] Installing dependencies (git, curl, ufw, htop, fail2ban)..."
sudo apt-get install -y curl git ufw htop fail2ban ca-certificates gnupg lsb-release

# 3. Install Docker Engine & Docker Compose Plugin
echo "[3/6] Installing official Docker CE..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Enable Docker for current user without sudo
echo "[4/6] Configuring Docker permissions..."
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# 5. Configure UFW Firewall
echo "[5/6] Configuring firewall rules (SSH, HTTP, HTTPS)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable

# 6. Setup Swap (4GB) for AWS Free Tier instances (t2.micro / t3.micro with 1GB RAM)
echo "[6/6] Configuring 4GB Swap space (crucial for Free Tier t2.micro/t3.micro)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=20
    echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
fi

echo "======================================================================"
echo " Server provisioning complete! "
echo " Please log out and log back in, or run: newgrp docker "
echo " Next step: clone repository, copy .env.production to .env, and run deploy/aws-deploy.sh"
echo "======================================================================"
