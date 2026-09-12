# Architecture & Technical Decision Log (DECISIONS.md)

This document tracks all key technical decisions, trade-offs, library selections, and architectural assumptions made during the build of **AI_Accounting_Software**.

---

## ADR 001: Backend Framework Selection
- **Decision:** Python FastAPI with Uvicorn, SQLAlchemy 2.0 (Async), Alembic, and Pydantic v2.
- **Context:** The user explicitly requested FastAPI backend for the transactional core API and AI layer.
- **Rationale:**
  - Native async I/O with high concurrency.
  - Seamless Python ML/AI ecosystem interoperability (decoupled AI microservice sharing schemas and validation).
  - Pydantic v2 gives sub-millisecond serialization and strict schema validation.
  - SQLAlchemy 2.0 Async Session ensures strict ACID transaction boundaries crucial for double-entry bookkeeping.
  - Automatic OpenAPI / Swagger docs generated from route types and Pydantic models.
- **Date:** 2026-09-13

---

## ADR 002: Monorepo Architecture
- **Decision:** Modular multi-app structure:
  - `apps/backend`: FastAPI REST API (Auth, Tenancy, Billing, Inventory, Accounting Engine, Reports, RBAC, Entitlements).
  - `apps/web-frontend`: Next.js / React (Modern Admin Dashboard, POS Counter, Staff Bills Review, Financial Reports).
  - `apps/mobile-app`: React Native / Expo (Lightweight offline-first POS & staff billing).
  - `apps/ai-service`: Python FastAPI (Scheduled batch jobs, market basket recommendation, sales forecasting, LLM query engine).
- **Context:** Enables unified developer experience, shared domain schemas, clear separation of concerns, and clean CI/CD.
- **Date:** 2026-09-13

---

## ADR 003: Multi-Tenancy & Security Isolation Strategy
- **Decision:** Row-Level Tenancy with `tenant_id` on every transactional table, combined with server-side FastAPI `TenantMiddleware` and dependency injection (`get_current_tenant`, `get_current_user`).
- **Context:** `plan.md` mandates strict multi-tenant isolation without per-client deployments, ensuring Indian data-localization compliance and horizontal scalability.
- **Rationale:** Prevents tenant data leakage at the API layer regardless of UI state.
- **Date:** 2026-09-13

---

## ADR 004: Server-Side RBAC & Entitlement Enforcement
- **Decision:** Dedicated RBAC tables (`roles`, `permissions`, `role_permissions`) with FastAPI Dependency Guards (`require_permission`, `require_module_entitlement`).
- **Context:** Sub-users (staff) must strictly be prevented from editing or deleting bills, enforced via 403 at API routes. Unpurchased modules return 403 Forbidden.
- **Date:** 2026-09-13

---

## ADR 005: Error Logging & Observability
- **Decision:** Structured JSON logging with Sentry SDK integration across Backend and AI Service.
- **Context:** Sentry provides instant error tracing and performance monitoring in multi-tenant environments.
- **Date:** 2026-09-13
