"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  BookOpen,
  Calendar,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  RefreshCw,
  Landmark,
  Wallet,
  ArrowRightLeft,
  PieChart,
  ShieldCheck,
  Building2,
  Layers,
} from "lucide-react";
import { UpgradePaywall } from "@/components/UpgradePaywall";

export default function AccountingPage() {
  const { user, tenant, isAdmin, entitlements } = useAuth();
  const isFreePlan = (tenant?.subscription_tier || "free").toLowerCase() === "free";
  const isLocked = isFreePlan && !entitlements.includes("accounting");

  // Active Tab: overview | daybook | cashbank | ledger | trialbalance | pl | balancesheet | coa
  const [activeTab, setActiveTab] = useState<
    "overview" | "daybook" | "cashbank" | "ledger" | "trialbalance" | "pl" | "balancesheet" | "coa"
  >("overview");

  const [isLoading, setIsLoading] = useState(false);

  // Common Date Filter State
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Chart of Accounts State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountGroups, setAccountGroups] = useState<any[]>([]);
  const [coaSearch, setCoaSearch] = useState("");
  const [coaNatureFilter, setCoaNatureFilter] = useState("all");

  // Day Book State
  const [dayBookData, setDayBookData] = useState<any>(null);
  const [dayBookVoucherFilter, setDayBookVoucherFilter] = useState("");
  const [dayBookSearch, setDayBookSearch] = useState("");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Cash / Bank Book State
  const [cashBankType, setCashBankType] = useState<"cash" | "bank">("cash");
  const [cashBankData, setCashBankData] = useState<any>(null);

  // General Ledger State
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [ledgerData, setLedgerData] = useState<any>(null);

  // Trial Balance State
  const [trialBalanceData, setTrialBalanceData] = useState<any>(null);

  // Profit & Loss State
  const [plData, setPlData] = useState<any>(null);

  // Balance Sheet State
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);

  // Modals State
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    code: "",
    name: "",
    nature: "expense",
    account_type: "general",
    group_id: "",
    opening_balance: 0,
    description: "",
  });

  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [newVoucherForm, setNewVoucherForm] = useState({
    voucher_type: "journal",
    narration: "",
    items: [
      { account_id: "", debit: 0, credit: 0, narration: "" },
      { account_id: "", debit: 0, credit: 0, narration: "" },
    ],
  });
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false);

  // Load Accounts and Groups
  const fetchAccounts = async () => {
    try {
      const [accRes, grpRes] = await Promise.all([
        api.get("/accounting/accounts"),
        api.get("/accounting/groups"),
      ]);
      setAccounts(accRes.data);
      setAccountGroups(grpRes.data);
      if (accRes.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accRes.data[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
    }
  };

  // Load Day Book
  const fetchDayBook = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      if (dayBookVoucherFilter) params.voucher_type = dayBookVoucherFilter;
      if (dayBookSearch) params.search = dayBookSearch;
      const res = await api.get("/accounting/reports/day-book", { params });
      setDayBookData(res.data);
    } catch (e) {
      console.error("Failed to load day book:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Cash/Bank Book
  const fetchCashBankBook = async () => {
    setIsLoading(true);
    try {
      const endpoint = cashBankType === "cash" ? "/accounting/reports/cash-book" : "/accounting/reports/bank-book";
      const params = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const res = await api.get(endpoint, { params });
      setCashBankData(res.data);
    } catch (e) {
      console.error("Failed to load cash/bank book:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load General Ledger
  const fetchLedger = async (accId?: string) => {
    const targetId = accId || selectedAccountId;
    if (!targetId) return;
    setIsLoading(true);
    try {
      const params = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const res = await api.get(`/accounting/reports/ledger/${targetId}`, { params });
      setLedgerData(res.data);
    } catch (e) {
      console.error("Failed to load ledger:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Trial Balance
  const fetchTrialBalance = async () => {
    setIsLoading(true);
    try {
      const params = {
        as_of_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const res = await api.get("/accounting/reports/trial-balance", { params });
      setTrialBalanceData(res.data);
    } catch (e) {
      console.error("Failed to load trial balance:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load P&L
  const fetchProfitLoss = async () => {
    setIsLoading(true);
    try {
      const params = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const res = await api.get("/accounting/reports/profit-and-loss", { params });
      setPlData(res.data);
    } catch (e) {
      console.error("Failed to load P&L:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Balance Sheet
  const fetchBalanceSheet = async () => {
    setIsLoading(true);
    try {
      const params = {
        as_of_date: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const res = await api.get("/accounting/reports/balance-sheet", { params });
      setBalanceSheetData(res.data);
    } catch (e) {
      console.error("Failed to load balance sheet:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial and Tab Triggered Data Load
  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (activeTab === "overview") {
      fetchProfitLoss();
      fetchTrialBalance();
    } else if (activeTab === "daybook") {
      fetchDayBook();
    } else if (activeTab === "cashbank") {
      fetchCashBankBook();
    } else if (activeTab === "ledger") {
      if (selectedAccountId) fetchLedger(selectedAccountId);
    } else if (activeTab === "trialbalance") {
      fetchTrialBalance();
    } else if (activeTab === "pl") {
      fetchProfitLoss();
    } else if (activeTab === "balancesheet") {
      fetchBalanceSheet();
    } else if (activeTab === "coa") {
      fetchAccounts();
    }
  }, [activeTab, startDate, endDate, cashBankType, selectedAccountId]);

  // Handle Add Custom Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.code.trim() || !newAccountForm.name.trim()) return;
    try {
      await api.post("/accounting/accounts", {
        ...newAccountForm,
        code: newAccountForm.code.trim().toUpperCase(),
        name: newAccountForm.name.trim(),
        group_id: newAccountForm.group_id || undefined,
        opening_balance: parseFloat(newAccountForm.opening_balance.toString()) || 0,
      });
      await fetchAccounts();
      setShowAddAccountModal(false);
      setNewAccountForm({
        code: "",
        name: "",
        nature: "expense",
        account_type: "general",
        group_id: "",
        opening_balance: 0,
        description: "",
      });
      alert("✅ Custom Ledger Account created successfully!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create account");
    }
  };

  // Handle Post Journal Voucher
  const handleAddVoucherItem = () => {
    setNewVoucherForm((prev) => ({
      ...prev,
      items: [...prev.items, { account_id: "", debit: 0, credit: 0, narration: "" }],
    }));
  };

  const handleRemoveVoucherItem = (idx: number) => {
    if (newVoucherForm.items.length <= 2) {
      alert("A journal entry requires at least 2 line items.");
      return;
    }
    setNewVoucherForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateVoucherItem = (idx: number, field: string, value: any) => {
    setNewVoucherForm((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const voucherTotalDebit = newVoucherForm.items.reduce((sum, i) => sum + (parseFloat(i.debit?.toString()) || 0), 0);
  const voucherTotalCredit = newVoucherForm.items.reduce((sum, i) => sum + (parseFloat(i.credit?.toString()) || 0), 0);
  const isVoucherBalanced = Math.abs(voucherTotalDebit - voucherTotalCredit) < 0.01 && voucherTotalDebit > 0;

  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVoucherBalanced) {
      alert(`Unbalanced Journal Entry: Total Debit (₹${voucherTotalDebit.toFixed(2)}) must equal Total Credit (₹${voucherTotalCredit.toFixed(2)}).`);
      return;
    }
    setIsSubmittingVoucher(true);
    try {
      await api.post("/accounting/journal", {
        voucher_type: newVoucherForm.voucher_type,
        narration: newVoucherForm.narration || undefined,
        items: newVoucherForm.items.map((i) => ({
          account_id: i.account_id,
          debit: parseFloat(i.debit.toString()) || 0,
          credit: parseFloat(i.credit.toString()) || 0,
          narration: i.narration || undefined,
        })),
      });
      setShowNewVoucherModal(false);
      setNewVoucherForm({
        voucher_type: "journal",
        narration: "",
        items: [
          { account_id: "", debit: 0, credit: 0, narration: "" },
          { account_id: "", debit: 0, credit: 0, narration: "" },
        ],
      });
      alert("✅ Journal Entry voucher posted successfully!");
      if (activeTab === "daybook") fetchDayBook();
      else if (activeTab === "trialbalance") fetchTrialBalance();
      else if (activeTab === "pl") fetchProfitLoss();
      else if (activeTab === "balancesheet") fetchBalanceSheet();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to post journal entry");
    } finally {
      setIsSubmittingVoucher(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredCOA = accounts.filter((a) => {
    const matchNature = coaNatureFilter === "all" || a.nature === coaNatureFilter;
    const matchSearch =
      !coaSearch ||
      a.name.toLowerCase().includes(coaSearch.toLowerCase()) ||
      a.code.toLowerCase().includes(coaSearch.toLowerCase());
    return matchNature && matchSearch;
  });

  if (isLocked) {
    return (
      <UpgradePaywall
        moduleName="Accounting Books"
        title="Unlock Full Double-Entry Accounting Engine"
        subtitle="Access automated Trial Balance, Profit & Loss Statements, Balance Sheets, Multi-Period Ledgers, and Custom Chart of Accounts."
        requiredPlan="Enterprise Pro"
        priceMonthly="₹999 / mo"
        features={[
          "Official Double-Entry Chart of Accounts with Indian Accounting Standards",
          "Automated Real-Time Trial Balance, Profit & Loss & Balance Sheet",
          "Multi-Account Journal Vouchers & Double-Entry Verification",
          "Cash & Bank Book Reconciliation with Inward/Outward Running Balances",
          "General Ledger Statements with Filterable Date Ranges and PDF/Print Export",
        ]}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header & Quick Action Buttons */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "rgba(56, 189, 248, 0.15)", padding: "8px", borderRadius: "10px", color: "#0891b2" }}>
              <BookOpen size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Accounting Engine & Financial Books
              </h1>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Double-entry General Ledger, Day Book, Cash/Bank Books, Trial Balance & CA-Standard Statements
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons & Date Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Date Filter Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f1f5f9", padding: "4px 10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <Calendar size={14} color="#94a3b8" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: "0.75rem", outline: "none" }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: "0.75rem", outline: "none" }}
            />
          </div>

          <button
            onClick={handlePrint}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
            title="Print Current Statement / Report"
          >
            <Printer size={14} /> Print
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowNewVoucherModal(true)}
              className="btn-primary"
              style={{ padding: "8px 14px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", background: "#2563eb" }}
            >
              <Plus size={16} /> + Journal Voucher
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }} className="no-print">
        {[
          { id: "overview", label: "📊 Overview", desc: "Executive KPI Summary" },
          { id: "daybook", label: "📖 Day Book", desc: "Transaction Journal" },
          { id: "cashbank", label: "💵 Cash & Bank", desc: "Cash & Bank Books" },
          { id: "ledger", label: "📜 General Ledger", desc: "Account Statements" },
          { id: "trialbalance", label: "⚖️ Trial Balance", desc: "2-Column Ledger Balance" },
          { id: "pl", label: "📈 Profit & Loss", desc: "Trading & P&L Statement" },
          { id: "balancesheet", label: "🏛️ Balance Sheet", desc: "Assets vs Liabilities" },
          { id: "coa", label: "🌳 Chart of Accounts", desc: "Accounts & Master Ledgers" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeTab === tab.id ? "#38bdf8" : "transparent",
              background: activeTab === tab.id ? "rgba(56, 189, 248, 0.15)" : "rgba(30, 41, 59, 0.3)",
              color: activeTab === tab.id ? "#38bdf8" : "var(--text-muted)",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FINANCIAL OVERVIEW / SNAPSHOT */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {/* Sales Revenue */}
            <div className="glass-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Revenue</span>
                <TrendingUp size={18} color="#34d399" />
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>
                ₹{plData?.sales_revenue?.toFixed(2) || "0.00"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Sales Account (Taxable)</div>
            </div>

            {/* Purchase & COGS */}
            <div className="glass-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Purchases & Inward</span>
                <TrendingDown size={18} color="#f87171" />
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f87171" }}>
                ₹{plData?.purchase_costs?.toFixed(2) || "0.00"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Purchase Costs Account</div>
            </div>

            {/* Gross Profit */}
            <div className="glass-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Gross Profit</span>
                <DollarSign size={18} color="#38bdf8" />
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: (plData?.gross_profit || 0) >= 0 ? "#38bdf8" : "#f87171" }}>
                ₹{plData?.gross_profit?.toFixed(2) || "0.00"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Trading Account Balance</div>
            </div>

            {/* Net Profit */}
            <div className="glass-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Net Profit</span>
                <PieChart size={18} color={(plData?.net_profit || 0) >= 0 ? "#10b981" : "#ef4444"} />
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: (plData?.net_profit || 0) >= 0 ? "#10b981" : "#ef4444" }}>
                ₹{plData?.net_profit?.toFixed(2) || "0.00"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>After all operating expenses</div>
            </div>
          </div>

          {/* Trial Balance Health Bar */}
          {trialBalanceData && (
            <div
              className="glass-panel"
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                borderLeft: trialBalanceData.is_balanced ? "4px solid #10b981" : "4px solid #ef4444",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Scale size={24} color={trialBalanceData.is_balanced ? "#10b981" : "#ef4444"} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
                    Double-Entry Balancing Integrity: {trialBalanceData.is_balanced ? "100% Balanced ✅" : "Out of Balance ❌"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Total Debits: ₹{trialBalanceData.total_debit.toFixed(2)} | Total Credits: ₹{trialBalanceData.total_credit.toFixed(2)} | Difference: ₹{trialBalanceData.difference.toFixed(2)}
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveTab("trialbalance")} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                View Trial Balance &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAY BOOK */}
      {/* ========================================================================= */}
      {activeTab === "daybook" && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search voucher # or narration..."
                  value={dayBookSearch}
                  onChange={(e) => setDayBookSearch(e.target.value)}
                  style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
                />
                <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              </div>

              <select
                className="input-field"
                value={dayBookVoucherFilter}
                onChange={(e) => setDayBookVoucherFilter(e.target.value)}
                style={{ width: "160px", fontSize: "0.85rem" }}
              >
                <option value="">All Vouchers</option>
                <option value="sale">Sale Vouchers (SV)</option>
                <option value="purchase">Purchase Vouchers (PV)</option>
                <option value="receipt">Receipts (RC)</option>
                <option value="payment">Payments (PM)</option>
                <option value="contra">Contra (CV)</option>
                <option value="journal">Journal (JV)</option>
              </select>

              <button onClick={fetchDayBook} className="btn-secondary" style={{ padding: "8px 12px" }}>
                <RefreshCw size={14} />
              </button>
            </div>

            {dayBookData && (
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0891b2" }}>
                {dayBookData.total_entries} Entries | Turnover: ₹{dayBookData.total_debit.toFixed(2)}
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !dayBookData || dayBookData.entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No journal entries found for selected date range and filters.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Voucher #</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>Particulars / Narration</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ padding: "10px 8px", textAlign: "center" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBookData.entries.map((e: any) => {
                    const isExpanded = expandedEntryId === e.id;
                    const typeColors: Record<string, string> = {
                      sale: "#10b981",
                      purchase: "#f59e0b",
                      receipt: "#38bdf8",
                      payment: "#ef4444",
                      contra: "#8b5cf6",
                      journal: "#64748b",
                    };

                    return (
                      <React.Fragment key={e.id}>
                        <tr
                          onClick={() => setExpandedEntryId(isExpanded ? null : e.id)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            cursor: "pointer",
                            background: isExpanded ? "rgba(56, 189, 248, 0.08)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "10px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {new Date(e.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                            {e.entry_number}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: "4px", background: `${typeColors[e.voucher_type] || "#64748b"}20`, color: typeColors[e.voucher_type] || "#94a3b8" }}>
                              {e.voucher_type}
                            </span>
                          </td>
                          <td style={{ padding: "10px 8px", color: "#f1f5f9" }}>
                            {e.narration || "No narration"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            ₹{e.total_amount.toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "center", color: "#0891b2" }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                        </tr>

                        {/* Expanded Double-Entry Breakdown */}
                        {isExpanded && (
                          <tr style={{ background: "#f8fafc" }}>
                            <td colSpan={6} style={{ padding: "12px 16px" }}>
                              <div style={{ fontSize: "0.775rem", fontWeight: 700, color: "#0891b2", marginBottom: "6px" }}>
                                Double-Entry Ledger Breakdown ({e.items.length} lines):
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                <thead>
                                  <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    <th style={{ padding: "4px 6px", textAlign: "left" }}>Account Code & Name</th>
                                    <th style={{ padding: "4px 6px", textAlign: "left" }}>Line Narration</th>
                                    <th style={{ padding: "4px 6px", textAlign: "right" }}>Debit (Dr) ₹</th>
                                    <th style={{ padding: "4px 6px", textAlign: "right" }}>Credit (Cr) ₹</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.items.map((it: any) => (
                                    <tr key={it.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                      <td style={{ padding: "4px 6px", color: "#0f172a", fontWeight: 600 }}>
                                        <span style={{ color: "#0891b2", fontFamily: "monospace" }}>[{it.account_code}]</span> {it.account_name}
                                      </td>
                                      <td style={{ padding: "4px 6px", color: "var(--text-muted)" }}>{it.narration || "-"}</td>
                                      <td style={{ padding: "4px 6px", textAlign: "right", color: it.debit > 0 ? "#34d399" : "var(--text-muted)", fontWeight: it.debit > 0 ? 700 : 400 }}>
                                        {it.debit > 0 ? `₹${it.debit.toFixed(2)}` : "-"}
                                      </td>
                                      <td style={{ padding: "4px 6px", textAlign: "right", color: it.credit > 0 ? "#38bdf8" : "var(--text-muted)", fontWeight: it.credit > 0 ? 700 : 400 }}>
                                        {it.credit > 0 ? `₹${it.credit.toFixed(2)}` : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CASH & BANK BOOKS */}
      {/* ========================================================================= */}
      {activeTab === "cashbank" && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Cash / Bank Toggle & Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setCashBankType("cash")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: cashBankType === "cash" ? "2px solid #10b981" : "1px solid var(--border)",
                  background: cashBankType === "cash" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                  color: cashBankType === "cash" ? "#34d399" : "var(--text-muted)",
                }}
              >
                <Wallet size={16} /> Cash-in-Hand Book
              </button>

              <button
                onClick={() => setCashBankType("bank")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: cashBankType === "bank" ? "2px solid #38bdf8" : "1px solid var(--border)",
                  background: cashBankType === "bank" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                  color: cashBankType === "bank" ? "#38bdf8" : "var(--text-muted)",
                }}
              >
                <Landmark size={16} /> Bank Book (Primary Account)
              </button>
            </div>

            {cashBankData && (
              <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.85rem" }}>
                <div>Opening: <strong style={{ color: "#0f172a" }}>₹{cashBankData.opening_balance.toFixed(2)}</strong></div>
                <div>Receipts: <strong style={{ color: "#059669" }}>+₹{cashBankData.total_received.toFixed(2)}</strong></div>
                <div>Payments: <strong style={{ color: "#f87171" }}>-₹{cashBankData.total_paid.toFixed(2)}</strong></div>
                <div>Closing Balance: <strong style={{ color: "#0891b2", fontSize: "1rem" }}>₹{cashBankData.closing_balance.toFixed(2)}</strong></div>
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !cashBankData || cashBankData.transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No transactions recorded for {cashBankType === "cash" ? "Cash" : "Bank"} account in this period.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Voucher #</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>Particulars</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Receipt (Dr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Payment (Cr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Running Balance ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {cashBankData.transactions.map((tx: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>{tx.entry_number}</td>
                      <td style={{ padding: "10px 8px", textTransform: "uppercase", fontSize: "0.75rem", color: "var(--text-muted)" }}>{tx.voucher_type}</td>
                      <td style={{ padding: "10px 8px", color: "#f1f5f9" }}>{tx.particulars}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: tx.debit > 0 ? "#34d399" : "var(--text-muted)", fontWeight: tx.debit > 0 ? 700 : 400 }}>
                        {tx.debit > 0 ? `+₹${tx.debit.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: tx.credit > 0 ? "#f87171" : "var(--text-muted)", fontWeight: tx.credit > 0 ? 700 : 400 }}>
                        {tx.credit > 0 ? `-₹${tx.credit.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: tx.running_balance >= 0 ? "#38bdf8" : "#ef4444" }}>
                        ₹{tx.running_balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GENERAL LEDGER */}
      {/* ========================================================================= */}
      {activeTab === "ledger" && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Account Selector Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Select Ledger:</label>
              <select
                className="input-field"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name} ({a.nature.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {ledgerData && (
              <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.85rem" }}>
                <div>Opening: <strong style={{ color: "#0f172a" }}>₹{ledgerData.opening_balance.toFixed(2)}</strong></div>
                <div>Debits: <strong style={{ color: "#059669" }}>₹{ledgerData.total_debit.toFixed(2)}</strong></div>
                <div>Credits: <strong style={{ color: "#0891b2" }}>₹{ledgerData.total_credit.toFixed(2)}</strong></div>
                <div>Closing: <strong style={{ color: "#f59e0b", fontSize: "1rem" }}>₹{ledgerData.closing_balance.toFixed(2)}</strong></div>
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !ledgerData || ledgerData.entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No transactions recorded for this ledger account in the selected period.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Voucher #</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>Particulars</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Debit (Dr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Credit (Cr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Balance ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.entries.map((ent: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(ent.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>{ent.entry_number}</td>
                      <td style={{ padding: "10px 8px", textTransform: "uppercase", fontSize: "0.75rem", color: "var(--text-muted)" }}>{ent.voucher_type}</td>
                      <td style={{ padding: "10px 8px", color: "#f1f5f9" }}>{ent.particulars}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: ent.debit > 0 ? "#34d399" : "var(--text-muted)", fontWeight: ent.debit > 0 ? 700 : 400 }}>
                        {ent.debit > 0 ? `₹${ent.debit.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: ent.credit > 0 ? "#38bdf8" : "var(--text-muted)", fontWeight: ent.credit > 0 ? 700 : 400 }}>
                        {ent.credit > 0 ? `₹${ent.credit.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#f59e0b" }}>
                        ₹{ent.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TRIAL BALANCE */}
      {/* ========================================================================= */}
      {activeTab === "trialbalance" && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Trial Balance Statement</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>As of {new Date(endDate).toLocaleDateString("en-IN")}</p>
            </div>

            {trialBalanceData && (
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: trialBalanceData.is_balanced ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: trialBalanceData.is_balanced ? "#34d399" : "#f87171",
                  border: `1px solid ${trialBalanceData.is_balanced ? "#10b981" : "#ef4444"}`,
                }}
              >
                {trialBalanceData.is_balanced ? "✅ 100% Balanced" : `❌ Difference: ₹${trialBalanceData.difference.toFixed(2)}`}
              </span>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !trialBalanceData || trialBalanceData.rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No active ledger transactions to generate trial balance.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Account Code</th>
                    <th style={{ padding: "10px 8px" }}>Account Head / Ledger</th>
                    <th style={{ padding: "10px 8px" }}>Group</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Debit Total (Dr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Credit Total (Cr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Net Debit (Dr) ₹</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Net Credit (Cr) ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalanceData.rows.map((r: any) => (
                    <tr key={r.account_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "8px", fontFamily: "monospace", color: "#0891b2", fontWeight: 700 }}>{r.account_code}</td>
                      <td style={{ padding: "8px", fontWeight: 600, color: "#0f172a" }}>{r.account_name}</td>
                      <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{r.group_name || "-"}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--text-muted)" }}>₹{r.debit_total.toFixed(2)}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--text-muted)" }}>₹{r.credit_total.toFixed(2)}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: r.net_debit > 0 ? "#34d399" : "var(--text-muted)", fontWeight: r.net_debit > 0 ? 700 : 400 }}>
                        {r.net_debit > 0 ? `₹${r.net_debit.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", color: r.net_credit > 0 ? "#38bdf8" : "var(--text-muted)", fontWeight: r.net_credit > 0 ? 700 : 400 }}>
                        {r.net_credit > 0 ? `₹${r.net_credit.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  ))}
                  {/* Grand Totals */}
                  <tr style={{ borderTop: "2px solid #38bdf8", background: "rgba(56, 189, 248, 0.1)", fontWeight: 800 }}>
                    <td colSpan={5} style={{ padding: "12px 8px", color: "#0f172a", fontSize: "0.95rem" }}>
                      GRAND TOTAL
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", color: "#059669", fontSize: "0.95rem" }}>
                      ₹{trialBalanceData.total_debit.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", color: "#0891b2", fontSize: "0.95rem" }}>
                      ₹{trialBalanceData.total_credit.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PROFIT & LOSS STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === "pl" && (
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Statement of Profit & Loss</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Period: {new Date(startDate).toLocaleDateString("en-IN")} to {new Date(endDate).toLocaleDateString("en-IN")}
            </p>
          </div>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !plData ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No P&L data available.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Expenses & Direct Costs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f87171", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                  Expenditure & Costs (Debit)
                </div>

                {/* Trading Account Costs */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 0" }}>
                  <span>Purchases & Goods Inward:</span>
                  <strong style={{ color: "#f87171" }}>₹{plData.purchase_costs.toFixed(2)}</strong>
                </div>

                {plData.direct_expenses > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 0" }}>
                    <span>Direct Expenses (Freight / Delivery):</span>
                    <strong style={{ color: "#f87171" }}>₹{plData.direct_expenses.toFixed(2)}</strong>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontWeight: 700 }}>
                  <span>Cost of Goods Sold (COGS):</span>
                  <span>₹{plData.cost_of_goods_sold.toFixed(2)}</span>
                </div>

                {/* Indirect Expenses */}
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fbbf24", marginTop: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                  Operating & Indirect Expenses
                </div>

                {plData.discount_allowed > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0" }}>
                    <span>Discount Allowed to Customers:</span>
                    <span>₹{plData.discount_allowed.toFixed(2)}</span>
                  </div>
                )}

                {plData.expense_breakdown.filter((e: any) => !e.code.startsWith("5010") && !e.code.startsWith("5020")).map((e: any) => (
                  <div key={e.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0" }}>
                    <span>{e.name}:</span>
                    <span>₹{e.amount.toFixed(2)}</span>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontWeight: 700 }}>
                  <span>Total Indirect Expenses:</span>
                  <span>₹{plData.total_indirect_expenses.toFixed(2)}</span>
                </div>
              </div>

              {/* Incomes & Revenue */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#059669", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                  Income & Revenue (Credit)
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 0" }}>
                  <span>Sales Revenue (Taxable):</span>
                  <strong style={{ color: "#059669" }}>₹{plData.sales_revenue.toFixed(2)}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontWeight: 700, color: plData.gross_profit >= 0 ? "#34d399" : "#f87171" }}>
                  <span>Gross Profit c/d:</span>
                  <span>₹{plData.gross_profit.toFixed(2)}</span>
                </div>

                {/* Other Incomes */}
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0891b2", marginTop: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                  Other Operating Incomes
                </div>

                {plData.discount_received > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0" }}>
                    <span>Discount Received from Suppliers:</span>
                    <span>₹{plData.discount_received.toFixed(2)}</span>
                  </div>
                )}

                {plData.indirect_income > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0" }}>
                    <span>Other Incomes:</span>
                    <span>₹{plData.indirect_income.toFixed(2)}</span>
                  </div>
                )}

                {/* Net Profit Final Row */}
                <div
                  style={{
                    marginTop: "auto",
                    padding: "16px",
                    borderRadius: "8px",
                    background: plData.net_profit >= 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    border: `1px solid ${plData.net_profit >= 0 ? "#10b981" : "#ef4444"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                    NET PROFIT / (LOSS):
                  </span>
                  <span style={{ fontSize: "1.3rem", fontWeight: 800, color: plData.net_profit >= 0 ? "#34d399" : "#f87171" }}>
                    ₹{plData.net_profit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: BALANCE SHEET */}
      {/* ========================================================================= */}
      {activeTab === "balancesheet" && (
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Balance Sheet</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                As of {new Date(endDate).toLocaleDateString("en-IN")}
              </p>
            </div>

            {balanceSheetData && (
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: balanceSheetData.is_balanced ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: balanceSheetData.is_balanced ? "#34d399" : "#f87171",
                  border: `1px solid ${balanceSheetData.is_balanced ? "#10b981" : "#ef4444"}`,
                }}
              >
                {balanceSheetData.is_balanced ? "✅ Balanced (Assets = Liabilities + Equity)" : `❌ Difference: ₹${balanceSheetData.difference.toFixed(2)}`}
              </span>
            )}
          </div>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={28} /></div>
          ) : !balanceSheetData ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No balance sheet data.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* LIABILITIES & EQUITY */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0891b2", borderBottom: "2px solid #38bdf8", paddingBottom: "6px" }}>
                  Liabilities & Owner Equity
                </div>

                {/* Capital & Reserves */}
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>Capital & Reserves:</div>
                {balanceSheetData.capital_and_equity.items.map((it: any) => (
                  <div key={it.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", padding: "2px 0", color: "var(--text-muted)" }}>
                    <span>{it.name}:</span>
                    <span>₹{it.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", padding: "2px 0", color: balanceSheetData.net_profit_current_year >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
                  <span>Current Year Net Profit / (Loss):</span>
                  <span>₹{balanceSheetData.net_profit_current_year.toFixed(2)}</span>
                </div>

                {/* Current Liabilities */}
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a", marginTop: "12px" }}>Current Liabilities & Taxes:</div>
                {balanceSheetData.current_liabilities.items.map((it: any) => (
                  <div key={it.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", padding: "2px 0", color: "var(--text-muted)" }}>
                    <span>{it.name}:</span>
                    <span>₹{it.amount.toFixed(2)}</span>
                  </div>
                ))}

                {/* Total Liabilities */}
                <div style={{ marginTop: "auto", borderTop: "2px solid #38bdf8", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 800, color: "#0891b2" }}>
                  <span>TOTAL LIABILITIES & EQUITY:</span>
                  <span>₹{balanceSheetData.total_liabilities_and_equity.toFixed(2)}</span>
                </div>
              </div>

              {/* ASSETS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#059669", borderBottom: "2px solid #34d399", paddingBottom: "6px" }}>
                  Assets & Properties
                </div>

                {/* Fixed Assets */}
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>Fixed Assets:</div>
                {balanceSheetData.fixed_assets.items.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>None recorded</div>
                ) : (
                  balanceSheetData.fixed_assets.items.map((it: any) => (
                    <div key={it.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", padding: "2px 0", color: "var(--text-muted)" }}>
                      <span>{it.name}:</span>
                      <span>₹{it.amount.toFixed(2)}</span>
                    </div>
                  ))
                )}

                {/* Current Assets */}
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a", marginTop: "12px" }}>Current Assets & Receivables:</div>
                {balanceSheetData.current_assets.items.map((it: any) => (
                  <div key={it.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", padding: "2px 0", color: "var(--text-muted)" }}>
                    <span>{it.name}:</span>
                    <span>₹{it.amount.toFixed(2)}</span>
                  </div>
                ))}

                {/* Total Assets */}
                <div style={{ marginTop: "auto", borderTop: "2px solid #34d399", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 800, color: "#059669" }}>
                  <span>TOTAL ASSETS:</span>
                  <span>₹{balanceSheetData.total_assets.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: CHART OF ACCOUNTS */}
      {/* ========================================================================= */}
      {activeTab === "coa" && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Controls Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search account code or name..."
                  value={coaSearch}
                  onChange={(e) => setCoaSearch(e.target.value)}
                  style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
                />
                <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              </div>

              <select
                className="input-field"
                value={coaNatureFilter}
                onChange={(e) => setCoaNatureFilter(e.target.value)}
                style={{ width: "150px", fontSize: "0.85rem" }}
              >
                <option value="all">All Natures</option>
                <option value="asset">Assets</option>
                <option value="liability">Liabilities</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="btn-primary"
                style={{ padding: "8px 12px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={16} /> + New Ledger Account
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "10px 8px" }}>Account Code</th>
                  <th style={{ padding: "10px 8px" }}>Ledger Name</th>
                  <th style={{ padding: "10px 8px" }}>Nature</th>
                  <th style={{ padding: "10px 8px" }}>Group</th>
                  <th style={{ padding: "10px 8px" }}>Type</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Current Live Balance</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>Ledger</th>
                </tr>
              </thead>
              <tbody>
                {filteredCOA.map((a) => {
                  const natureColors: Record<string, string> = {
                    asset: "#34d399",
                    liability: "#f87171",
                    equity: "#38bdf8",
                    income: "#10b981",
                    expense: "#fbbf24",
                  };

                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#0891b2", fontWeight: 700 }}>
                        {a.code}
                      </td>
                      <td style={{ padding: "10px 8px", fontWeight: 600, color: "#0f172a" }}>
                        {a.name} {a.is_system && <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "4px" }}>(System)</span>}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: "4px", background: `${natureColors[a.nature] || "#64748b"}20`, color: natureColors[a.nature] || "#94a3b8" }}>
                          {a.nature}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {a.group_name || "-"}
                      </td>
                      <td style={{ padding: "10px 8px", textTransform: "capitalize", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {a.account_type}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: a.current_balance >= 0 ? "#34d399" : "#f87171" }}>
                        ₹{a.current_balance.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => {
                            setSelectedAccountId(a.id);
                            setActiveTab("ledger");
                          }}
                          style={{ background: "rgba(56, 189, 248, 0.15)", color: "#0891b2", border: "none", padding: "2px 8px", borderRadius: "4px", fontSize: "0.725rem", cursor: "pointer", fontWeight: 600 }}
                        >
                          View &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD CUSTOM LEDGER ACCOUNT */}
      {/* ========================================================================= */}
      {showAddAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAddAccountModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "460px", padding: "24px", borderRadius: "12px", background: "#ffffff" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Create Custom Ledger Account</h3>
              <button onClick={() => setShowAddAccountModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="input-label">Account Code (Optional - e.g. 5090-INTERNET)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 5090-OFFICE (Leave empty to auto-generate)"
                  value={newAccountForm.code}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, code: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Account Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Broadband & Internet Expense"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="input-label">Nature *</label>
                  <select
                    className="input-field"
                    value={newAccountForm.nature}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, nature: e.target.value })}
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Account Group</label>
                  <select
                    className="input-field"
                    value={newAccountForm.group_id}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, group_id: e.target.value })}
                  >
                    <option value="">(None / General)</option>
                    {accountGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={newAccountForm.opening_balance}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, opening_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="input-label">Description (Optional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Notes on account usage..."
                  value={newAccountForm.description}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddAccountModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: "#2563eb" }}>
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: POST MANUAL JOURNAL VOUCHER */}
      {/* ========================================================================= */}
      {showNewVoucherModal && (
        <div className="modal-overlay" onClick={() => setShowNewVoucherModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "680px", padding: "24px", borderRadius: "12px", background: "#ffffff" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Post Manual Journal Entry Voucher</h3>
              <button onClick={() => setShowNewVoucherModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePostVoucher} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                <div>
                  <label className="input-label">Voucher Type *</label>
                  <select
                    className="input-field"
                    value={newVoucherForm.voucher_type}
                    onChange={(e) => setNewVoucherForm({ ...newVoucherForm, voucher_type: e.target.value })}
                  >
                    <option value="journal">Journal (JV)</option>
                    <option value="contra">Contra (CV)</option>
                    <option value="payment">Payment (PM)</option>
                    <option value="receipt">Receipt (RC)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Voucher Narration *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Month-end depreciation on machinery"
                    value={newVoucherForm.narration}
                    onChange={(e) => setNewVoucherForm({ ...newVoucherForm, narration: e.target.value })}
                  />
                </div>
              </div>

              {/* Line Items Grid */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0891b2" }}>Double-Entry Line Items</span>
                  <button type="button" onClick={handleAddVoucherItem} className="btn-secondary" style={{ padding: "3px 8px", fontSize: "0.75rem" }}>
                    + Add Row
                  </button>
                </div>

                {newVoucherForm.items.map((it, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1.5fr 30px", gap: "8px", alignItems: "center" }}>
                    <select
                      required
                      className="input-field"
                      value={it.account_id}
                      onChange={(e) => handleUpdateVoucherItem(idx, "account_id", e.target.value)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      <option value="">Select Account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      placeholder="Debit ₹"
                      value={it.debit || ""}
                      onChange={(e) => handleUpdateVoucherItem(idx, "debit", parseFloat(e.target.value) || 0)}
                      style={{ fontSize: "0.8rem" }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      placeholder="Credit ₹"
                      value={it.credit || ""}
                      onChange={(e) => handleUpdateVoucherItem(idx, "credit", parseFloat(e.target.value) || 0)}
                      style={{ fontSize: "0.8rem" }}
                    />

                    {newVoucherForm.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVoucherItem(idx)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Total & Balancing Checker */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px", fontSize: "0.85rem" }}>
                  <div>
                    {isVoucherBalanced ? (
                      <span style={{ color: "#059669", fontWeight: 700 }}>✅ Perfectly Balanced</span>
                    ) : (
                      <span style={{ color: "#f87171", fontWeight: 700 }}>
                        ❌ Out of balance by ₹{Math.abs(voucherTotalDebit - voucherTotalCredit).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontWeight: 700 }}>
                    <span>Total Dr: <strong style={{ color: "#059669" }}>₹{voucherTotalDebit.toFixed(2)}</strong></span>
                    <span>Total Cr: <strong style={{ color: "#0891b2" }}>₹{voucherTotalCredit.toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowNewVoucherModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isVoucherBalanced || isSubmittingVoucher}
                  className="btn-primary"
                  style={{ flex: 1, background: isVoucherBalanced ? "#10b981" : "#64748b" }}
                >
                  {isSubmittingVoucher ? <Loader2 className="animate-spin" size={18} /> : "Post Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
