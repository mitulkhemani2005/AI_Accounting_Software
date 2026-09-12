# AI-Powered Billing, Inventory & Accounting Software — Complete Project Plan

**Prepared for:** Development kickoff (Antigravity / coding agent handoff)
**Target Market:** SMBs in India (kirana stores, retail shops, pharmacies, wholesalers)
**Author's Role:** AI Engineer / Founder

---

## 1. Executive Summary

Build a **modular, multi-tenant SaaS platform** combining:
- Billing & Point of Sale (POS)
- Complete Inventory Management
- Full Double-Entry Accounting (ledgers, trial balance, P&L, balance sheet)
- Outstanding/Ageing Reports (receivables & payables)
- AI Layer (personalized item suggestions, restock forecasting, natural-language queries)
- Multi-user access with **Admin** (full control) and **Sub-user** (add-only billing) roles
- Each feature module sellable **individually or as a bundle**

The product must be **cloud-hosted, multi-tenant, offline-capable, GST-compliant, and India data-localized**.

---

## 2. User Roles & Permissions (RBAC)

### 2.1 Roles

| Role | Description |
|---|---|
| **Admin (Owner)** | Full control: create/edit/delete any bill, full accounting books, inventory management, all reports, manage sub-users & their permissions, subscription/module management, audit log access |
| **Sub-user (Staff)** | Add-only: can create new bills/counter sales via mobile app or web. **Cannot edit or delete** any bill after submission (including their own). No access to ledgers, accounting books, or financial reports by default |

### 2.2 Rules (must be enforced server-side, not just hidden in UI)

- Every bill/transaction stores `created_by_user_id`, `tenant_id`, `created_at`.
- Sub-user role has **no PUT/DELETE endpoints available** for bills — enforced at the API middleware level.
- Admin has a **"Staff Bills Review"** queue to edit/correct bills entered by sub-users if needed.
- Full **audit log**: who created/edited/deleted what and when.
- Sub-user login should be lightweight: mobile number + OTP/PIN (avoid complex email/password flows — staff are often non-tech-savvy).
- Design roles/permissions as generic DB tables (`roles`, `permissions`, `role_permissions`) so more granular roles (e.g., "Accountant — view only", "Manager — edit but no delete") can be added later without rearchitecting.

### 2.3 Future Role Ideas (not MVP, but design should allow)
- View-only Accountant role
- Branch Manager role (edit within one branch only)
- Per-sub-user restrictions (e.g., only allowed to bill from a specific counter/branch)

---

## 3. Complete Feature List

### 3.1 Billing & POS
- Quick billing / counter sale screen
- Barcode scanning support
- Multiple payment modes: cash, UPI, card, credit (khata)
- Hold/resume bill
- GST-compliant invoice generation
- E-invoicing (IRN/QR code) for eligible turnover
- WhatsApp/SMS/print bill sharing
- Sub-user mobile billing (add-only)

### 3.2 Inventory Management
- Stock in/out tracking
- Batch & expiry date tracking
- Multi-godown/multi-branch stock
- Low-stock alerts
- Barcode/SKU management
- Stock valuation (FIFO/weighted average)

### 3.3 Full Accounting (Double-Entry)
- Chart of Accounts (customizable, standard Indian SMB template)
- Automatic journal entries behind every transaction
- Day Book, Cash Book, Bank Book
- Party-wise Ledger (customer & supplier)
- Trial Balance
- Profit & Loss Statement
- Balance Sheet
- Bank reconciliation

### 3.4 Outstanding & Reports
- Sundry Debtors report (customers who owe money) with ageing: 0-30 / 30-60 / 60-90 / 90+ days
- Sundry Creditors report (amounts owed to suppliers) with ageing
- Automated payment due reminders (WhatsApp/SMS)
- GST reports: GSTR-1, GSTR-3B export-ready formats
- Stock summary & movement reports

### 3.5 AI Layer
- **Customer-wise item suggestions**: association rule mining (Apriori/FP-Growth) → collaborative filtering as data grows
- **Restock/reorder forecasting**: sales velocity + seasonality model (start with exponential smoothing, move to LightGBM as data volume grows)
- **Natural language report queries**: "Show me last month's top debtors" — LLM-powered query layer over structured data
- **Anomaly detection** (phase 2): unusual discounts, price overrides, suspicious deletion patterns

---

## 4. System Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Web App (Admin Dashboard)   |   Mobile App (Admin + Sub-user)  │
└───────────────────────┬────────────────────────────────────┘
                         │  REST/GraphQL API (JWT auth + role claims)
┌────────────────────────▼───────────────────────────────────┐
│                      API Layer                              │
│  - Tenant middleware (tenant_id scoping on every request)   │
│  - Role/permission middleware (admin vs sub-user)            │
│  - Entitlement middleware (which modules tenant has paid for)│
└────────────────────────┬───────────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        │                                    │
┌───────▼────────────────────┐   ┌──────────▼────────────────┐
│   Core DB (PostgreSQL)      │   │   AI Microservice (Python) │
│   - tenants, users, roles    │   │   - Scheduled batch jobs    │
│   - items, customers, bills  │◄──┤   - Recommendation engine   │
│   - journal_entries, ledgers │   │   - Forecasting models      │
│   - inventory, stock_moves   │   │   - LLM query layer         │
└───────────────────────────────┘   └────────────────────────────┘
```

### Key architectural principles
1. **Multi-tenancy**: single codebase, tenant isolation via `tenant_id` on every table (row-level security in PostgreSQL). Do NOT do per-client deployments — kills scalability.
2. **Modular entitlements**: every module check happens at the API level, not just UI. A tenant without the "Accounting" module purchased gets a 403 on those endpoints, not just a hidden button.
3. **Double-entry backbone**: every bill/payment/receipt auto-generates journal entries. All accounting reports are just queries over the journal_entries table — never hand-build separate report logic that could drift out of sync with the ledger.
4. **Offline-first**: mobile/web billing must work with poor/no internet, queue transactions locally, and sync when connectivity returns. Non-negotiable for the Indian SMB market.
5. **AI as background jobs**: recommendation/forecasting run as nightly scheduled batch jobs per tenant — not real-time inference. Cheaper, simpler, scales horizontally.

---

## 5. Core Database Schema (Starting Point)

> Note: this is a starting skeleton, not final DDL — expand during implementation.

**Tenancy & Access**
- `tenants` (id, business_name, gst_number, subscription_tier, created_at)
- `users` (id, tenant_id, name, mobile_number, role_id, pin/password_hash, created_at)
- `roles` (id, name) — e.g., admin, sub_user, accountant_view_only
- `permissions` (id, name) — e.g., bill.create, bill.edit, bill.delete, ledger.view
- `role_permissions` (role_id, permission_id)
- `module_entitlements` (tenant_id, module_name, active, expires_at)
- `audit_log` (id, tenant_id, user_id, action, entity_type, entity_id, timestamp)

**Master Data**
- `customers` (id, tenant_id, name, mobile, gst_number, opening_balance)
- `suppliers` (id, tenant_id, name, mobile, gst_number, opening_balance)
- `items` (id, tenant_id, name, sku, barcode, category, unit, gst_rate)
- `stock` (id, tenant_id, item_id, godown_id, batch_no, expiry_date, quantity)
- `godowns` (id, tenant_id, name, address)

**Transactions**
- `bills` (id, tenant_id, type [sale/purchase/credit_note/debit_note], party_id, created_by_user_id, total_amount, gst_amount, payment_mode, status, created_at)
- `bill_items` (id, bill_id, item_id, quantity, rate, gst_rate, amount)
- `payments` (id, tenant_id, bill_id, party_id, amount, mode, created_at)

**Accounting**
- `chart_of_accounts` (id, tenant_id, account_name, account_type [asset/liability/income/expense/capital], parent_id)
- `journal_entries` (id, tenant_id, bill_id/payment_id, account_id, debit_amount, credit_amount, entry_date)

**AI**
- `ai_suggestions_cache` (tenant_id, customer_id, suggested_items JSON, generated_at)
- `restock_suggestions_cache` (tenant_id, item_id, suggested_quantity, confidence_score, generated_at)

---

## 6. Accounting Engine Logic (Journal Entry Mapping)

| Transaction | Debit | Credit |
|---|---|---|
| Cash Sale | Cash | Sales + GST Payable |
| Credit Sale | Debtors (customer) | Sales + GST Payable |
| Payment received from customer | Cash/Bank | Debtors |
| Cash Purchase | Purchases + GST Input | Cash |
| Credit Purchase | Purchases + GST Input | Creditors (supplier) |
| Payment made to supplier | Creditors | Cash/Bank |

**Reports derive directly from `journal_entries`:**
- Trial Balance = sum of debit/credit per account
- P&L = Income accounts − Expense accounts (for the period)
- Balance Sheet = Assets = Liabilities + Capital (as of date)
- Party Ledger = filtered journal entries for one customer/supplier account

⚠️ **Get a Chartered Accountant to review the Chart of Accounts and report formats before launch.** Incorrect Trial Balance/P&L/Balance Sheet will destroy user trust immediately, especially since shop owners share these with their own CAs.

---

## 7. Tech Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js (NestJS) or Python (FastAPI) | NestJS gives strong built-in module/RBAC structure |
| Database | PostgreSQL | Row-level security for multi-tenancy, strong transactional integrity for accounting |
| Web Frontend | Next.js / React | SEO-friendly admin dashboard, fast dev |
| Mobile App | React Native or Flutter | Single codebase for Admin + Sub-user apps |
| AI Microservice | Python (FastAPI) | scikit-learn/LightGBM for forecasting; Claude/GPT API for NL query layer |
| Job Scheduling | Celery + Redis (or cron) | Nightly AI batch jobs, reminders |
| Payments | Razorpay | Subscription billing + customer payment collection |
| Notifications | WhatsApp Business API | Bill sharing, due reminders — critical growth channel in India |
| Hosting | AWS/GCP Mumbai region | Data localization compliance |

---

## 8. Compliance Checklist (India — Non-Negotiable)

- [ ] GST-compliant invoicing (HSN/SAC codes, tax breakdown)
- [ ] E-invoicing (IRN/QR generation) for businesses above applicable turnover threshold
- [ ] GSTR-1 / GSTR-3B export-ready report formats
- [ ] Data hosted within India (RBI/data localization norms for financial data)
- [ ] DPDP Act (Digital Personal Data Protection Act) compliance — consent management, data deletion rights
- [ ] Company registration (Pvt Ltd or LLP) + own GST registration
- [ ] Terms of Service / Privacy Policy reviewed by a lawyer familiar with SaaS + fintech-adjacent products

---

## 9. Modular Pricing Plan

| Module | Price (₹/month) |
|---|---|
| Billing + POS | 300 |
| Inventory Management | 400 |
| Accounting Books (ledger, trial balance, P&L, balance sheet) | 600 |
| Outstanding/Ageing Reports | 250 |
| AI Suggestions (recommendations + forecasting + NL query) | 400 |
| Additional sub-user seat | 100/seat |
| **All-in-One Bundle** | 1,500 (discounted vs. buying separately) |
| Free Tier | Basic billing only, limited bills/month, single user |

Entitlement checks must be enforced at the API layer (see Section 4) so unpurchased modules are inaccessible, not just hidden.

---

## 10. Build Roadmap & Milestones

| Phase | Duration | Deliverable |
|---|---|---|
| 1. Validation | 2–3 weeks | Interviews with 20–30 shop owners; confirm feature priorities & pricing tolerance |
| 2. Core + Auth + RBAC | 3–4 weeks | Tenant system, admin/sub-user roles, permission middleware, entitlement engine |
| 3. Billing + POS | 4–5 weeks | Counter sale, GST invoicing, sub-user mobile billing (add-only) |
| 4. Inventory | 3–4 weeks | Stock in/out, low-stock alerts, multi-godown |
| 5. Accounting Engine | 6–8 weeks | Chart of Accounts, auto journal entries, ledgers, Trial Balance/P&L/Balance Sheet — CA review required |
| 6. Outstanding Reports | 2 weeks | Ageing reports, due reminders (WhatsApp/SMS) |
| 7. Self-serve onboarding + payments | 2–3 weeks | Signup flow, CSV stock import, Razorpay subscriptions, auto entitlement activation |
| 8. AI Layer | 4–6 weeks | Recommendation engine, restock forecasting, NL query (requires real transaction data first) |
| 9. Pilot | Ongoing | 20–50 real shops, manual support, iterate on feedback |
| 10. Scale distribution | Ongoing | Partner/reseller network (local computer shops, CAs), WhatsApp growth loop |

**Estimated total time to full-featured launch: 8–10 months** (solo/small team pace).

---

## 11. Key Risks & What to Get Right Early

1. **Accounting correctness** — the single biggest trust risk. Every report must trace back to correct double-entry journal logic. Budget real time for CA review and testing with real scenarios (returns, discounts, partial payments, GST edge cases).
2. **Sub-user permission enforcement** — must be server-side (API-level), never just UI-hidden buttons. A staff member with browser dev tools access will find gaps in UI-only restrictions.
3. **Offline support** — bills must save locally and sync later; treat as core requirement, not a stretch feature.
4. **Scope discipline** — this is now a Tally/Vyapar/Marg-scale product plus an AI layer. Get billing + inventory + basic accounting working and validated with real paying pilot users before investing heavily in the AI layer.
5. **Data cold-start for AI** — recommendations and forecasting need real transaction history (minimum ~100 transactions/shop, 30+ days of sales data) before they're useful. Set expectations with users accordingly.

---

## 12. Notes for the Development Agent (Antigravity)

- Build in the module order given in Section 10 — do not attempt all modules simultaneously.
- Enforce tenant isolation and role/permission checks at the **API middleware layer** for every single endpoint from day one — retrofitting security is far more error-prone than building it in from the start.
- All accounting reports (Trial Balance, P&L, Balance Sheet, Ledgers) must be derived from the `journal_entries` table — never hardcode separate calculation logic per report that could drift out of sync with the underlying ledger.
- Use feature flags/entitlement checks (Section 4 & 9) to gate access to each module per tenant, enabling the "sell modules individually" business model.
- Keep the AI microservice decoupled from the core transactional system (separate service, scheduled batch jobs) so AI processing never blocks or slows down billing/accounting operations.
- Design the schema (Section 5) to support offline sync (e.g., client-generated UUIDs for bills created offline, conflict resolution on sync).

---

*End of document.*
