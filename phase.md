# Phase.md — Execution Plan for Antigravity

**Instructions for the agent:** Complete phases strictly in order. At the end of each phase, STOP and present the deliverable for review/confirmation before starting the next phase. Do not skip ahead or merge phases.

**Instructions for the user:** Check off each task as it's completed and confirmed. Only move to the next phase after confirming the current one works as expected.

---

## PHASE 0 — Project Setup

- [x] Initialize monorepo structure (backend / web-frontend / mobile-app / ai-service)
- [x] Set up PostgreSQL database (local + cloud dev instance, Mumbai region)
- [x] Set up backend framework (FastAPI confirmed)
- [x] Set up basic CI/CD pipeline (lint, test, deploy to staging)
- [x] Set up environment config for multi-environment (dev/staging/prod)
- [x] Set up error logging/monitoring (e.g., Sentry)

**✅ Checkpoint:** Empty project runs locally and deploys to a staging environment. Confirm before proceeding.

---

## PHASE 1 — Core: Tenancy, Auth, Roles & Permissions

- [x] Create `tenants` table + tenant creation flow
- [x] Create `users` table with `tenant_id` scoping
- [x] Implement JWT-based authentication
- [x] Implement `roles` and `permissions` tables (admin, sub_user)
- [x] Implement `role_permissions` mapping
- [x] Build API middleware: tenant isolation (every request scoped to `tenant_id`)
- [x] Build API middleware: role/permission enforcement (server-side, not UI-only)
- [x] Implement admin signup flow (creates tenant + admin user)
- [x] Implement sub-user creation flow (admin adds staff, mobile number + OTP/PIN login)
- [x] Implement audit_log table + logging on all create/edit/delete actions
- [x] Build `module_entitlements` table + entitlement-check middleware (feature flag per tenant per module)

**✅ Checkpoint:** Admin can sign up, create a tenant, add a sub-user, and log in as both. Sub-user has no access to any restricted endpoint (test this explicitly via API, not just UI). Confirm before proceeding.

---

## PHASE 2 — Billing & POS Module

- [ ] Create `customers`, `suppliers`, `items` tables
- [ ] Build item master CRUD (admin only)
- [ ] Build customer/supplier master CRUD (admin only)
- [ ] Build counter sale (POS) screen: quick add item, quantity, price, payment mode
- [ ] Implement GST calculation logic on bills
- [ ] Build `bills` and `bill_items` tables
- [ ] Implement bill creation API (available to both admin and sub-user)
- [ ] Enforce sub-user restriction: bill creation allowed, edit/delete blocked at API level
- [ ] Build admin "Staff Bills Review" screen (admin can edit/correct sub-user bills)
- [ ] Implement bill PDF generation
- [ ] Implement WhatsApp/SMS bill sharing (via WhatsApp Business API)
- [ ] Implement barcode scan support (mobile + web)
- [ ] Implement offline bill creation + local queue + sync-on-reconnect logic

**✅ Checkpoint:** Admin and sub-user can both create bills from web and mobile. Sub-user cannot edit/delete any bill (verify via direct API call, not just UI). Bills generate correctly with GST. Confirm before proceeding.

---

## PHASE 3 — Inventory Management Module

- [ ] Create `godowns` (warehouses/branches) table
- [ ] Create `stock` table (item, godown, batch, expiry, quantity)
- [ ] Implement stock-in flow (linked to purchase bills)
- [ ] Implement stock-out flow (linked to sale bills — auto-deduct on billing)
- [ ] Implement low-stock alert logic + notification
- [ ] Implement batch & expiry tracking
- [ ] Implement multi-godown stock transfer
- [ ] Build stock summary & movement reports

**✅ Checkpoint:** Selling an item via POS automatically reduces stock; purchasing restocks it. Low-stock alerts trigger correctly. Confirm before proceeding.

---

## PHASE 4 — Accounting Engine (Full Double-Entry)

> ⚠️ Get CA review on Chart of Accounts and report formats before marking this phase complete.

- [ ] Build `chart_of_accounts` table with standard Indian SMB template
- [ ] Implement auto journal-entry generation for: cash sale, credit sale, cash purchase, credit purchase, payment received, payment made
- [ ] Build `journal_entries` table
- [ ] Build Day Book report (query over journal_entries)
- [ ] Build Cash Book report
- [ ] Build Bank Book report
- [ ] Build party-wise Ledger report (customer & supplier)
- [ ] Build Trial Balance report
- [ ] Build Profit & Loss Statement report
- [ ] Build Balance Sheet report
- [ ] Implement bank reconciliation flow
- [ ] Get CA to review all reports against real test scenarios (returns, discounts, partial payments, GST edge cases)

**✅ Checkpoint:** All reports tie out correctly (Trial Balance balances, Balance Sheet balances). CA has reviewed and signed off. Confirm before proceeding — do not skip this review.

---

## PHASE 5 — Outstanding & Compliance Reports

- [ ] Build Sundry Debtors report with ageing buckets (0-30/30-60/60-90/90+ days)
- [ ] Build Sundry Creditors report with ageing buckets
- [ ] Implement automated due-payment reminders (WhatsApp/SMS)
- [ ] Build GSTR-1 export-ready report
- [ ] Build GSTR-3B export-ready report
- [ ] Implement e-invoicing (IRN/QR code generation) for eligible turnover

**✅ Checkpoint:** Ageing reports match manual calculation on test data. GST export reports are correctly formatted. Confirm before proceeding.

---

## PHASE 6 — Self-Serve Onboarding & Payments

- [ ] Build self-serve signup flow (no manual admin intervention needed)
- [ ] Build CSV import for existing stock/customer data
- [ ] Integrate Razorpay for subscription billing
- [ ] Implement auto-suspend on non-payment
- [ ] Implement auto-activation of entitlements on payment/upgrade
- [ ] Build in-app upgrade prompts (e.g., "Unlock Accounting Books — ₹600/month")
- [ ] Build free-tier bill limit enforcement

**✅ Checkpoint:** A new user can sign up, import data, subscribe to a module via Razorpay, and get instant access — with zero manual intervention from you. Confirm before proceeding.

---

## PHASE 7 — AI Layer

> Requires real transaction data (minimum ~100 transactions/shop, 30+ days) to be meaningful — can be built against synthetic/sample data first, then validated on pilot data.

- [ ] Build AI microservice (separate Python service, decoupled from core transactional system)
- [ ] Implement customer-wise item suggestion engine (association rule mining — Apriori/FP-Growth)
- [ ] Implement restock/reorder forecasting (exponential smoothing baseline)
- [ ] Implement scheduled nightly batch jobs per tenant (Celery/cron)
- [ ] Build `ai_suggestions_cache` and `restock_suggestions_cache` tables
- [ ] Implement natural language query layer (LLM-powered) over reports/ledger data
- [ ] Surface AI suggestions in POS screen (item suggestions at billing time)
- [ ] Surface restock suggestions in Inventory module

**✅ Checkpoint:** AI suggestions appear correctly for a test shop with sample transaction history. Nightly jobs run without blocking core billing/accounting operations. Confirm before proceeding.

---

## PHASE 8 — Pilot & Iteration

- [ ] Onboard 10–20 real shops (manual hand-holding allowed at this stage)
- [ ] Collect feedback on every module
- [ ] Fix critical bugs from real usage (especially accounting and offline sync)
- [ ] Measure: bill creation time, sync reliability, report accuracy, AI suggestion relevance

**✅ Checkpoint:** Pilot shops are using the product daily without needing manual support for core functions. Confirm before scaling distribution.

---

## PHASE 9 — Scale & Distribution (Post-Pilot)

- [ ] Build partner/reseller commission tracking
- [ ] Launch WhatsApp-based bill-sharing growth loop
- [ ] Launch referral program (1 month free for referring a shop)
- [ ] Set up support automation (FAQ bot, WhatsApp automated sequences)

**✅ Checkpoint:** Final review — full product live, self-serve, modular pricing enforced, AI functioning on real data.

---

## Summary Table

| Phase | Focus | Must confirm before next phase |
|---|---|---|
| 0 | Project setup | Staging deploy works |
| 1 | Auth, tenancy, RBAC | Sub-user restrictions verified server-side |
| 2 | Billing & POS | Bills created/shared correctly, offline sync works |
| 3 | Inventory | Stock auto-updates correctly |
| 4 | Accounting engine | CA sign-off on reports |
| 5 | Outstanding/GST reports | Ageing & GST reports accurate |
| 6 | Onboarding & payments | Zero-touch signup-to-paid flow |
| 7 | AI layer | Suggestions relevant, jobs don't block core system |
| 8 | Pilot | Real shops using it unaided |
| 9 | Scale | Growth loops active |

*Do not proceed to the next phase without an explicit confirmation.*
