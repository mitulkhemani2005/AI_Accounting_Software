# AI_Accounting_Software

> **Multi-tenant SaaS platform for Billing, Inventory Management, Full Double-Entry Accounting, Outstanding Reports, and AI-powered intelligence for SMBs in India.**

---

## 🏗️ Architecture Overview

- **Core Backend (`apps/backend`):** FastAPI (Python 3.13) + SQLAlchemy 2.0 (Async) + PostgreSQL + Redis + Sentry.
- **AI Microservice (`apps/ai-service`):** FastAPI + Scikit-learn + Statsmodels + MLxtend (association rules) + LLM Query engine.
- **Web Frontend (`apps/web-frontend`):** Next.js (App Router) + React + TypeScript + Glassmorphism UI tokens.
- **Mobile App (`apps/mobile-app`):** React Native + Expo (Offline-first POS with SQLite queue).
- **Compliance:** Multi-tenant row-level security, Server-side RBAC, GST-ready invoicing, Data hosted in India (`ap-south-1` Mumbai).

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.11+ (Python 3.13 recommended)
- Node.js v20+ / npm 10+
- PostgreSQL 16 (or Docker Compose)

### 2. Start Services via Docker Compose
```bash
docker-compose up -d
```
This boots up PostgreSQL, Redis, Backend (port 8000), and AI Service (port 8001).

### 3. Or Run Backend Locally
```bash
cd apps/backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API documentation will be available at: `http://localhost:8000/api/v1/docs`.

### 4. Run AI Microservice Locally
```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### 5. Run Web Frontend Locally
```bash
cd apps/web-frontend
npm install
npm run dev
```
Web app will be available at: `http://localhost:3000`.

---

## 🧪 Running Tests

### Backend Tests:
```bash
cd apps/backend
pytest
```

### AI Service Tests:
```bash
cd apps/ai-service
pytest
```

---

## 🛡️ Multi-Environment Configuration
Environment configuration templates are provided:
- `.env.example` (Root template with documentation)
- `.env.development` (Local development defaults)
- `.env.staging` (Staging environment in AWS/GCP Mumbai `ap-south-1`)
- `.env.production` (Production configuration)
