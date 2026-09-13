"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  FileText,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Printer,
  Download,
  Share2,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Building,
  Users,
  RefreshCw,
  Loader2,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Send,
  Copy,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  MapPin,
} from "lucide-react";
import { UpgradePaywall } from "@/components/UpgradePaywall";

export default function ReportsPage() {
  const { user, tenant, isAdmin, entitlements } = useAuth();
  const isFreePlan = (tenant?.subscription_tier || "free").toLowerCase() === "free";
  const isLocked = isFreePlan && !entitlements.includes("outstanding_reports");

  // Active Tab: debtors | creditors | reminders | gstr1 | gstr3b | einvoice
  const [activeTab, setActiveTab] = useState<
    "debtors" | "creditors" | "reminders" | "gstr1" | "gstr3b" | "einvoice"
  >("debtors");

  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Common Date Filter State
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);

  // Quick Preset Helper
  const setDatePreset = (preset: "this_month" | "last_month" | "this_quarter" | "this_fy") => {
    const current = new Date();
    if (preset === "this_month") {
      setStartDate(new Date(current.getFullYear(), current.getMonth(), 1).toISOString().split("T")[0]);
      setEndDate(current.toISOString().split("T")[0]);
    } else if (preset === "last_month") {
      const prevMonthFirst = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      const prevMonthLast = new Date(current.getFullYear(), current.getMonth(), 0);
      setStartDate(prevMonthFirst.toISOString().split("T")[0]);
      setEndDate(prevMonthLast.toISOString().split("T")[0]);
    } else if (preset === "this_quarter") {
      const quarter = Math.floor(current.getMonth() / 3);
      setStartDate(new Date(current.getFullYear(), quarter * 3, 1).toISOString().split("T")[0]);
      setEndDate(current.toISOString().split("T")[0]);
    } else if (preset === "this_fy") {
      const fyStartYear = current.getMonth() >= 3 ? current.getFullYear() : current.getFullYear() - 1;
      setStartDate(new Date(fyStartYear, 3, 1).toISOString().split("T")[0]);
      setEndDate(current.toISOString().split("T")[0]);
    }
  };

  // 1. Debtors Ageing State
  const [debtorsData, setDebtorsData] = useState<any>(null);
  const [debtorsSearch, setDebtorsSearch] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);

  // 2. Creditors Ageing State
  const [creditorsData, setCreditorsData] = useState<any>(null);
  const [creditorsSearch, setCreditorsSearch] = useState("");
  const [selectedCreditor, setSelectedCreditor] = useState<any>(null);

  // 3. Automated Reminders State
  const [remindersData, setRemindersData] = useState<any>(null);
  const [minOverdueFilter, setMinOverdueFilter] = useState<number>(0);
  const [customNote, setCustomNote] = useState("");
  const [selectedReminder, setSelectedReminder] = useState<any>(null);

  // 4. GSTR-1 State
  const [gstr1Data, setGstr1Data] = useState<any>(null);
  const [gstr1SubTab, setGstr1SubTab] = useState<"b2b" | "b2cl" | "b2cs" | "hsn" | "docs">("b2b");

  // 5. GSTR-3B State
  const [gstr3bData, setGstr3bData] = useState<any>(null);

  // 6. E-Invoicing State
  const [salesBills, setSalesBills] = useState<any[]>([]);
  const [einvoiceData, setEinvoiceData] = useState<any>(null);
  const [selectedBillForEinv, setSelectedBillForEinv] = useState<any>(null);
  const [generatingEinvId, setGeneratingEinvId] = useState<string | null>(null);

  // Clear notices after 4s
  useEffect(() => {
    if (actionSuccess || actionError) {
      const timer = setTimeout(() => {
        setActionSuccess(null);
        setActionError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess, actionError]);

  // Load Data based on active tab
  useEffect(() => {
    loadTabContent();
  }, [activeTab, startDate, endDate, minOverdueFilter]);

  const loadTabContent = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "debtors") {
        const res = await api.get(`/reports/debtors-ageing?as_of_date=${endDate}`);
        setDebtorsData(res.data);
      } else if (activeTab === "creditors") {
        const res = await api.get(`/reports/creditors-ageing?as_of_date=${endDate}`);
        setCreditorsData(res.data);
      } else if (activeTab === "reminders") {
        const res = await api.get(`/reports/reminders/due?min_overdue_days=${minOverdueFilter}`);
        setRemindersData(res.data);
      } else if (activeTab === "gstr1") {
        const res = await api.get(`/reports/gstr-1?from_date=${startDate}&to_date=${endDate}`);
        setGstr1Data(res.data);
      } else if (activeTab === "gstr3b") {
        const res = await api.get(`/reports/gstr-3b?from_date=${startDate}&to_date=${endDate}`);
        setGstr3bData(res.data);
      } else if (activeTab === "einvoice") {
        const res = await api.get("/bills?type=sale&limit=50");
        setSalesBills(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load report data:", err);
      setActionError(err.response?.data?.detail || "Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger E-Invoice Generation
  const handleGenerateEinvoice = async (billId: string) => {
    setGeneratingEinvId(billId);
    try {
      const res = await api.post(`/reports/einvoice/${billId}/generate`);
      setEinvoiceData(res.data);
      setSelectedBillForEinv(salesBills.find((b) => b.id === billId));
      setActionSuccess("E-Invoice & Signed QR Code generated successfully!");
    } catch (err: any) {
      console.error("Failed to generate E-Invoice:", err);
      setActionError(err.response?.data?.detail || "Failed to generate E-Invoice");
    } finally {
      setGeneratingEinvId(null);
    }
  };

  // Trigger Custom Reminders
  const handleGenerateCustomReminders = async () => {
    setIsLoading(true);
    try {
      const res = await api.post("/reports/reminders/generate", {
        min_overdue_days: minOverdueFilter,
        custom_note: customNote.trim() || undefined,
      });
      setRemindersData(res.data);
      setActionSuccess(`Generated ${res.data.total_customers} personalized reminders!`);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to generate reminders");
    } finally {
      setIsLoading(false);
    }
  };

  // Universal Authenticated CSV & File Download Helper
  const downloadBlobFile = async (url: string, filename: string, mimeType: string = "text/csv;charset=utf-8;") => {
    setIsLoading(true);
    try {
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      setActionSuccess(`${filename} exported successfully!`);
    } catch (err: any) {
      console.error("Export download failed:", err);
      setActionError("Failed to export file. Please ensure data exists for the selected period.");
    } finally {
      setIsLoading(false);
    }
  };

  // Download Debtors Ageing CSV
  const handleDownloadDebtorsCSV = () => {
    downloadBlobFile(
      `/reports/debtors-ageing/csv?as_of_date=${endDate}`,
      `Debtors_Ageing_${endDate}.csv`
    );
  };

  // Download Creditors Ageing CSV
  const handleDownloadCreditorsCSV = () => {
    downloadBlobFile(
      `/reports/creditors-ageing/csv?as_of_date=${endDate}`,
      `Creditors_Ageing_${endDate}.csv`
    );
  };

  // Download GSTR-1 Offline Tool JSON
  const handleDownloadGSTR1JSON = async () => {
    try {
      const res = await api.get(`/reports/gstr-1/json?from_date=${startDate}&to_date=${endDate}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${tenant?.gst_number || "EXPORT"}_${startDate}_to_${endDate}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionSuccess("GSTR-1 JSON downloaded successfully for GST Portal!");
    } catch (err: any) {
      setActionError("Failed to download GSTR-1 JSON");
    }
  };

  // Download GSTR-1 CSV
  const handleDownloadGSTR1CSV = () => {
    downloadBlobFile(
      `/reports/gstr-1/csv?from_date=${startDate}&to_date=${endDate}`,
      `GSTR1_${tenant?.gst_number || "EXPORT"}_${startDate}_to_${endDate}.csv`
    );
  };

  // Download GSTR-3B JSON
  const handleDownloadGSTR3BJSON = async () => {
    try {
      const res = await api.get(`/reports/gstr-3b/json?from_date=${startDate}&to_date=${endDate}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR3B_${tenant?.gst_number || "EXPORT"}_${startDate}_to_${endDate}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionSuccess("GSTR-3B JSON downloaded successfully!");
    } catch (err: any) {
      setActionError("Failed to download GSTR-3B JSON");
    }
  };

  // Download GSTR-3B CSV
  const handleDownloadGSTR3BCSV = () => {
    downloadBlobFile(
      `/reports/gstr-3b/csv?from_date=${startDate}&to_date=${endDate}`,
      `GSTR3B_${tenant?.gst_number || "EXPORT"}_${startDate}_to_${endDate}.csv`
    );
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setActionSuccess(`${label} copied to clipboard!`);
  };

  if (isLocked) {
    return (
      <UpgradePaywall
        moduleName="Outstanding & Reports"
        title="Unlock Outstanding Ageing & GST Compliance Center"
        subtitle="Access Sundry Debtors/Creditors Ageing Buckets (0-30, 31-60, 61-90, 90+ days), 1-Click WhatsApp Due Payment Reminders, GSTR-1, GSTR-3B, and E-Invoicing."
        requiredPlan="Standard Business"
        priceMonthly="₹499 / mo"
        features={[
          "Sundry Debtors & Creditors Ageing Analysis (0-30, 31-60, 61-90, 90+ days)",
          "Automated 1-Click WhatsApp Payment Due Reminders & direct wa.me links",
          "GSTR-1 Export-Ready Return (Table 4 B2B, Table 5 B2CL, Table 7 B2CS, Table 12 HSN)",
          "GST Portal Offline Tool JSON & Spreadsheet Return Downloads",
          "GSTR-3B Outward Liabilities vs Inward Input Tax Credit (ITC) Balance",
          "Government E-Invoicing (IRN Hash) & Official Signed QR Code Generation",
        ]}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Breadcrumbs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "4px" }}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span style={{ color: "#f8fafc", fontWeight: 500 }}>Outstanding & Compliance Center</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
            Outstanding & Compliance Reports
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "4px 0 0 0" }}>
            Debtors & Creditors Ageing Buckets, Automated Payment Reminders, GSTR-1, GSTR-3B, and E-Invoicing.
          </p>
        </div>

        {/* Global Controls & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={loadTabContent}
            className="btn btn-secondary"
            disabled={isLoading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="glass-panel" style={{ padding: "12px 16px", borderRadius: "8px", borderLeft: "4px solid #10b981", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", gap: "10px", color: "#10b981" }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="glass-panel" style={{ padding: "12px 16px", borderRadius: "8px", borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", gap: "10px", color: "#ef4444" }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionError}</span>
        </div>
      )}

      {/* 2. Top Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
        {[
          { id: "debtors", label: "Sundry Debtors Ageing", icon: Users },
          { id: "creditors", label: "Sundry Creditors Ageing", icon: Building },
          { id: "reminders", label: "Automated Reminders", icon: MessageSquare },
          { id: "gstr1", label: "GSTR-1 Outward Return", icon: FileText },
          { id: "gstr3b", label: "GSTR-3B Summary Return", icon: FileSpreadsheet },
          { id: "einvoice", label: "E-Invoicing & QR Code", icon: QrCode },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "0.9rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#ffffff" : "var(--text-muted)",
                background: isActive ? "rgba(37, 99, 235, 0.2)" : "transparent",
                borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <tab.icon size={16} color={isActive ? "#60a5fa" : "#94a3b8"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Global Filter Bar (Dates & Presets) */}
      <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <Calendar size={16} color="#60a5fa" />
            <span style={{ fontWeight: 600, color: "#f8fafc" }}>Period:</span>
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_quarter", label: "This Quarter" },
              { id: "this_fy", label: "This FY" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
              style={{ width: "140px", padding: "6px 10px", fontSize: "0.85rem" }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
              style={{ width: "140px", padding: "6px 10px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {/* Dynamic Action Buttons per Tab */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {activeTab === "debtors" && (
            <button
              onClick={handleDownloadDebtorsCSV}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
          )}

          {activeTab === "creditors" && (
            <button
              onClick={handleDownloadCreditorsCSV}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
          )}

          {activeTab === "gstr1" && (
            <>
              <button
                onClick={handleDownloadGSTR1JSON}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <Download size={14} />
                <span>GST Portal JSON</span>
              </button>
              <button
                onClick={handleDownloadGSTR1CSV}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </button>
            </>
          )}

          {activeTab === "gstr3b" && (
            <>
              <button
                onClick={handleDownloadGSTR3BJSON}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <Download size={14} />
                <span>GSTR-3B JSON</span>
              </button>
              <button
                onClick={handleDownloadGSTR3BCSV}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. Tab Contents */}

      {/* ========================================================================= */}
      {/* TAB 1: SUNDRY DEBTORS AGEING */}
      {/* ========================================================================= */}
      {activeTab === "debtors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Summary Metric Cards */}
          {debtorsData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #3b82f6" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Total Debtors Outstanding</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                  ₹{debtorsData.total_outstanding?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                  {debtorsData.total_debtors} Customer(s) with pending balances
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #10b981" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>0 – 30 Days (Current)</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#10b981", marginTop: "4px" }}>
                  ₹{debtorsData.bucket_0_30_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Healthy current debt</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>31 – 60 Days</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f59e0b", marginTop: "4px" }}>
                  ₹{debtorsData.bucket_31_60_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Moderate ageing</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #f97316" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>61 – 90 Days</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f97316", marginTop: "4px" }}>
                  ₹{debtorsData.bucket_61_90_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Follow-up recommended</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #ef4444" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>90+ Days (Critical)</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ef4444", marginTop: "4px" }}>
                  ₹{debtorsData.bucket_above_90_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px" }}>Overdue / High risk</div>
              </div>
            </div>
          )}

          {/* Search & Debtors Table */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ position: "relative", width: "300px" }}>
                <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "10px" }} />
                <input
                  type="text"
                  placeholder="Search customer, area, GSTIN..."
                  value={debtorsSearch}
                  onChange={(e) => setDebtorsSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: "36px", width: "100%", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Showing <strong>{debtorsData?.customers?.length || 0}</strong> debtor accounts as of {endDate}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "12px 8px" }}>Customer / Party</th>
                    <th style={{ padding: "12px 8px" }}>Area / Route</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>0 – 30 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>31 – 60 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>61 – 90 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>&gt; 90 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Total Balance</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorsData?.customers
                    ?.filter((c: any) =>
                      c.customer_name.toLowerCase().includes(debtorsSearch.toLowerCase()) ||
                      (c.area_name && c.area_name.toLowerCase().includes(debtorsSearch.toLowerCase())) ||
                      (c.gst_number && c.gst_number.toLowerCase().includes(debtorsSearch.toLowerCase()))
                    )
                    .map((c: any) => (
                      <tr key={c.customer_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ fontWeight: 600, color: "#f8fafc" }}>{c.customer_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {c.mobile || "No Mobile"} {c.gst_number ? `• GST: ${c.gst_number}` : ""}
                          </div>
                        </td>
                        <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {c.area_name || "General"}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: c.bucket_0_30 > 0 ? "#10b981" : "var(--text-muted)" }}>
                          ₹{c.bucket_0_30.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: c.bucket_31_60 > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                          ₹{c.bucket_31_60.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: c.bucket_61_90 > 0 ? "#f97316" : "var(--text-muted)" }}>
                          ₹{c.bucket_61_90.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: c.bucket_above_90 > 0 ? "#ef4444" : "var(--text-muted)", fontWeight: c.bucket_above_90 > 0 ? 600 : 400 }}>
                          ₹{c.bucket_above_90.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "#f8fafc" }}>
                          ₹{c.total_due.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            {c.mobile && (
                              <button
                                onClick={() => {
                                  const text = encodeURIComponent(
                                    `🔔 Payment Reminder from ${tenant?.business_name || "us"}: Dear ${c.customer_name}, you have an outstanding balance of Rs.${c.total_due.toFixed(2)}. Kindly clear at your earliest convenience. Thank you!`
                                  );
                                  const digits = c.mobile.replace(/\D/g, "");
                                  const clean = digits.length === 10 ? `91${digits}` : digits;
                                  window.open(`https://wa.me/${clean}?text=${text}`, "_blank");
                                }}
                                className="btn btn-secondary"
                                title="Send WhatsApp Reminder"
                                style={{ padding: "4px 8px", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}
                              >
                                <MessageSquare size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedDebtor(c)}
                              className="btn btn-secondary"
                              title="View Overdue Invoices Breakdown"
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                            >
                              Bills ({c.overdue_bills?.length || 0})
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {(!debtorsData?.customers || debtorsData.customers.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        No outstanding debtors found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUNDRY CREDITORS AGEING */}
      {/* ========================================================================= */}
      {activeTab === "creditors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {creditorsData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #8b5cf6" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Total Creditors Payables</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                  ₹{creditorsData.total_outstanding?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                  {creditorsData.total_creditors} Supplier(s) to pay
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #10b981" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>0 – 30 Days (Current)</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#10b981", marginTop: "4px" }}>
                  ₹{creditorsData.bucket_0_30_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Current billing cycle</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>31 – 60 Days</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f59e0b", marginTop: "4px" }}>
                  ₹{creditorsData.bucket_31_60_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Due shortly</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", borderLeft: "4px solid #ef4444" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>60+ Days Overdue</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ef4444", marginTop: "4px" }}>
                  ₹{(creditorsData.bucket_61_90_total + creditorsData.bucket_above_90_total)?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px" }}>Prioritize supplier payments</div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ position: "relative", width: "300px" }}>
                <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "10px" }} />
                <input
                  type="text"
                  placeholder="Search supplier, GSTIN..."
                  value={creditorsSearch}
                  onChange={(e) => setCreditorsSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: "36px", width: "100%", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Showing <strong>{creditorsData?.suppliers?.length || 0}</strong> supplier accounts as of {endDate}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "12px 8px" }}>Supplier / Party</th>
                    <th style={{ padding: "12px 8px" }}>GSTIN</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>0 – 30 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>31 – 60 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>61 – 90 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>&gt; 90 Days</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Total Payable</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {creditorsData?.suppliers
                    ?.filter((s: any) =>
                      s.supplier_name.toLowerCase().includes(creditorsSearch.toLowerCase()) ||
                      (s.gst_number && s.gst_number.toLowerCase().includes(creditorsSearch.toLowerCase()))
                    )
                    .map((s: any) => (
                      <tr key={s.supplier_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ fontWeight: 600, color: "#f8fafc" }}>{s.supplier_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.mobile || "No phone"}</div>
                        </td>
                        <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {s.gst_number || "Unregistered"}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: s.bucket_0_30 > 0 ? "#10b981" : "var(--text-muted)" }}>
                          ₹{s.bucket_0_30.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: s.bucket_31_60 > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                          ₹{s.bucket_31_60.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: s.bucket_61_90 > 0 ? "#f97316" : "var(--text-muted)" }}>
                          ₹{s.bucket_61_90.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", color: s.bucket_above_90 > 0 ? "#ef4444" : "var(--text-muted)" }}>
                          ₹{s.bucket_above_90.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "#f8fafc" }}>
                          ₹{s.total_due.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                          <button
                            onClick={() => setSelectedCreditor(s)}
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          >
                            Purchases ({s.overdue_bills?.length || 0})
                          </button>
                        </td>
                      </tr>
                    ))}
                  {(!creditorsData?.suppliers || creditorsData.suppliers.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        No outstanding supplier payables recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUTOMATED DUE-PAYMENT REMINDERS */}
      {/* ========================================================================= */}
      {activeTab === "reminders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Controls Bar */}
          <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Minimum Overdue Days:</span>
              <select
                value={minOverdueFilter}
                onChange={(e) => setMinOverdueFilter(Number(e.target.value))}
                className="input-field"
                style={{ width: "160px", padding: "6px 10px", fontSize: "0.85rem" }}
              >
                <option value={0}>All Overdue (&gt; 0 days)</option>
                <option value={7}>&gt; 7 Days Overdue</option>
                <option value={15}>&gt; 15 Days Overdue</option>
                <option value={30}>&gt; 30 Days Overdue</option>
                <option value={60}>&gt; 60 Days Overdue</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                placeholder="Custom polite note (optional)..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="input-field"
                style={{ width: "260px", padding: "6px 10px", fontSize: "0.85rem" }}
              >
              </input>
              <button
                onClick={handleGenerateCustomReminders}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                <RefreshCw size={14} />
                <span>Regenerate Reminders</span>
              </button>
            </div>
          </div>

          {/* Reminders List */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                Pending Due Payment Reminders ({remindersData?.total_customers || 0})
              </h3>
              <div style={{ color: "#10b981", fontWeight: 700 }}>
                Total Overdue: ₹{remindersData?.total_overdue_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {remindersData?.reminders?.map((rem: any) => (
                <div
                  key={rem.customer_id}
                  className="glass-panel"
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc" }}>
                          {rem.customer_name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          📞 {rem.mobile || "No Mobile Number"}
                        </div>
                      </div>
                      <span className="badge badge-amber" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                        {rem.max_overdue_days}d Overdue
                      </span>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Due Balance:</span>
                      <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ef4444" }}>
                        ₹{rem.total_due.toFixed(2)}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        background: "rgba(0, 0, 0, 0.3)",
                        padding: "10px",
                        borderRadius: "6px",
                        fontSize: "0.775rem",
                        color: "#cbd5e1",
                        whiteSpace: "pre-line",
                        maxHeight: "100px",
                        overflowY: "auto",
                      }}
                    >
                      {rem.message_text}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                    <a
                      href={rem.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        fontSize: "0.825rem",
                        background: "#10b981",
                        borderColor: "#10b981",
                      }}
                    >
                      <Share2 size={14} />
                      <span>Send WhatsApp</span>
                    </a>
                    <button
                      onClick={() => copyToClipboard(rem.sms_text, "SMS text")}
                      className="btn btn-secondary"
                      style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.825rem" }}
                      title="Copy SMS text"
                    >
                      <Copy size={14} />
                      <span>SMS</span>
                    </button>
                  </div>
                </div>
              ))}

              {(!remindersData?.reminders || remindersData.reminders.length === 0) && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No customer overdue reminders pending criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GSTR-1 OUTWARD SUPPLIES RETURN */}
      {/* ========================================================================= */}
      {activeTab === "gstr1" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* GSTR-1 Metrics */}
          {gstr1Data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Total Invoices</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                  {gstr1Data.summary.total_invoices}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>B2B: {gstr1Data.summary.b2b_invoices_count} | B2CS: {gstr1Data.summary.b2cs_groups_count}</div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Taxable Value</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#60a5fa", marginTop: "4px" }}>
                  ₹{gstr1Data.summary.total_taxable_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Integrated Tax (IGST)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#a78bfa", marginTop: "4px" }}>
                  ₹{gstr1Data.summary.total_igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Central Tax (CGST)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>
                  ₹{gstr1Data.summary.total_cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>State Tax (SGST)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>
                  ₹{gstr1Data.summary.total_sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* GSTR-1 Sub Tabs */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px", overflowX: "auto" }}>
              {[
                { id: "b2b", label: `Table 4: B2B Invoices (${gstr1Data?.b2b?.length || 0} Recipients)` },
                { id: "b2cl", label: `Table 5: B2CL Large (${gstr1Data?.b2cl?.length || 0})` },
                { id: "b2cs", label: `Table 7: B2CS Small (${gstr1Data?.b2cs?.length || 0})` },
                { id: "hsn", label: `Table 12: HSN Summary (${gstr1Data?.hsn_summary?.length || 0})` },
                { id: "docs", label: "Table 13: Documents Issued" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setGstr1SubTab(st.id as any)}
                  className={`btn ${gstr1SubTab === st.id ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* SubTab 1: B2B Table */}
            {gstr1SubTab === "b2b" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>Receiver GSTIN</th>
                      <th style={{ padding: "10px 8px" }}>Legal Name</th>
                      <th style={{ padding: "10px 8px" }}>Invoice No</th>
                      <th style={{ padding: "10px 8px" }}>Date</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Invoice Value</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Taxable Value</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>IGST</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>CGST</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data?.b2b?.map((r: any) =>
                      r.invoices.map((inv: any) => (
                        <tr key={inv.invoice_number} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <td style={{ padding: "10px 8px", fontWeight: 600, color: "#60a5fa" }}>{r.ctin}</td>
                          <td style={{ padding: "10px 8px", color: "#f8fafc" }}>{r.customer_name}</td>
                          <td style={{ padding: "10px 8px", fontWeight: 500 }}>{inv.invoice_number}</td>
                          <td style={{ padding: "10px 8px", color: "var(--text-muted)" }}>{inv.invoice_date}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>₹{inv.invoice_value.toFixed(2)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            ₹{inv.items.reduce((s: number, i: any) => s + i.taxable_value, 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            ₹{inv.items.reduce((s: number, i: any) => s + i.igst, 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            ₹{inv.items.reduce((s: number, i: any) => s + i.cgst, 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            ₹{inv.items.reduce((s: number, i: any) => s + i.sgst, 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                    {(!gstr1Data?.b2b || gstr1Data.b2b.length === 0) && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                          No B2B registered invoices in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SubTab 3: B2CS Table */}
            {gstr1SubTab === "b2cs" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>Place of Supply</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Rate (%)</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Taxable Value</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Integrated Tax</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Central Tax</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>State Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data?.b2cs?.map((row: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 600, color: "#f8fafc" }}>State Code {row.pos}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>{row.rate}%</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>₹{row.taxable_value.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{row.igst.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{row.cgst.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{row.sgst.toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!gstr1Data?.b2cs || gstr1Data.b2cs.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                          No B2C small supplies recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SubTab 4: HSN Summary Table */}
            {gstr1SubTab === "hsn" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>HSN Code</th>
                      <th style={{ padding: "10px 8px" }}>Description</th>
                      <th style={{ padding: "10px 8px" }}>UQC / Unit</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Total Qty</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Total Value</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Taxable Value</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>IGST</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>CGST</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data?.hsn_summary?.map((h: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: "#60a5fa" }}>{h.hsn_code}</td>
                        <td style={{ padding: "10px 8px", color: "#f8fafc" }}>{h.description}</td>
                        <td style={{ padding: "10px 8px", color: "var(--text-muted)" }}>{h.uqc}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>{h.total_quantity}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{h.total_value.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>₹{h.taxable_value.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{h.igst.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{h.cgst.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>₹{h.sgst.toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!gstr1Data?.hsn_summary || gstr1Data.hsn_summary.length === 0) && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                          No HSN outward summaries in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SubTab 5: Document Summary */}
            {gstr1SubTab === "docs" && gstr1Data?.doc_summary && (
              <div style={{ maxWidth: "600px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="glass-panel" style={{ padding: "16px", borderRadius: "8px" }}>
                  <div style={{ fontWeight: 600, color: "#f8fafc", marginBottom: "8px" }}>
                    {gstr1Data.doc_summary.doc_type}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.85rem" }}>
                    <div>From Serial: <strong>{gstr1Data.doc_summary.from_serial}</strong></div>
                    <div>To Serial: <strong>{gstr1Data.doc_summary.to_serial}</strong></div>
                    <div>Total Issued: <strong>{gstr1Data.doc_summary.total_count}</strong></div>
                    <div>Cancelled: <strong style={{ color: "#ef4444" }}>{gstr1Data.doc_summary.cancelled_count}</strong></div>
                    <div style={{ gridColumn: "1 / -1", color: "#10b981", fontWeight: 700, fontSize: "0.95rem" }}>
                      Net Valid Invoices: {gstr1Data.doc_summary.net_issued}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GSTR-3B SUMMARY RETURN */}
      {/* ========================================================================= */}
      {activeTab === "gstr3b" && gstr3bData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Net Cash Tax Liability Hero Card */}
          <div
            className="glass-panel"
            style={{
              padding: "24px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))",
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  GSTR-3B Net Cash Tax Payable (After ITC Offset)
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
                  ₹{gstr3bData.net_tax_payable.total_cash_tax_payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "4px" }}>
                  Period: {gstr3bData.period} ({gstr3bData.from_date} to {gstr3bData.to_date})
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CGST Cash Payable</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
                    ₹{gstr3bData.net_tax_payable.cgst_net_payable.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    (Out: ₹{gstr3bData.net_tax_payable.cgst_output.toFixed(2)} - ITC: ₹{gstr3bData.net_tax_payable.cgst_itc.toFixed(2)})
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>SGST Cash Payable</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
                    ₹{gstr3bData.net_tax_payable.sgst_net_payable.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    (Out: ₹{gstr3bData.net_tax_payable.sgst_output.toFixed(2)} - ITC: ₹{gstr3bData.net_tax_payable.sgst_itc.toFixed(2)})
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>IGST Cash Payable</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
                    ₹{gstr3bData.net_tax_payable.igst_net_payable.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    (Out: ₹{gstr3bData.net_tax_payable.igst_output.toFixed(2)} - ITC: ₹{gstr3bData.net_tax_payable.igst_itc.toFixed(2)})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table 3.1 & Table 4 Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Table 3.1 Outward Liability */}
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "12px" }}>
                Table 3.1: Outward Supplies & Tax Liability
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "8px 4px" }}>Nature of Supply</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Taxable</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>IGST</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>CGST</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "8px 4px", color: "#f8fafc" }}>(a) Outward Taxable Supplies</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{gstr3bData.outward_supplies.taxable_outward.taxable_value.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{gstr3bData.outward_supplies.taxable_outward.igst.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{gstr3bData.outward_supplies.taxable_outward.cgst.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{gstr3bData.outward_supplies.taxable_outward.sgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 4px", color: "#cbd5e1" }}>(c) Other Outward (Exempt/Nil)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{gstr3bData.outward_supplies.other_outward_exempt.taxable_value.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 4 Eligible ITC */}
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "12px" }}>
                Table 4: Eligible Input Tax Credit (ITC)
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "8px 4px" }}>Details</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>IGST</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>CGST</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "8px 4px", color: "#f8fafc" }}>(A)(5) All Other ITC (Purchase Bills)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#a78bfa" }}>₹{gstr3bData.eligible_itc.all_other_itc.igst.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#34d399" }}>₹{gstr3bData.eligible_itc.all_other_itc.cgst.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#34d399" }}>₹{gstr3bData.eligible_itc.all_other_itc.sgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 4px", color: "var(--text-muted)" }}>(D) Ineligible ITC</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>₹0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: E-INVOICING & DYNAMIC QR CODE */}
      {/* ========================================================================= */}
      {activeTab === "einvoice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* E-Invoice Eligibility Card */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", borderLeft: "4px solid #3b82f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                  GST E-Invoicing (IRN) & Dynamic QR Code Engine
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.825rem", margin: "4px 0 0 0" }}>
                  Compliant with NIC E-Invoice System (Schema INV-01), 64-char SHA256 IRN generation, and UPI Instant Payment QR codes.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <span className="badge badge-blue" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                  Seller GSTIN: {tenant?.gst_number || "27AAAAA0000A1Z5"}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Invoices List for E-Invoice Generation */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "14px" }}>
              Recent Sales Invoices
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "10px 8px" }}>Invoice No</th>
                    <th style={{ padding: "10px 8px" }}>Customer / Party</th>
                    <th style={{ padding: "10px 8px" }}>GSTIN</th>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "10px 8px", textAlign: "center" }}>E-Invoice / QR Action</th>
                  </tr>
                </thead>
                <tbody>
                  {salesBills.map((b) => {
                    const hasGSTIN = Boolean(b.party_gst && b.party_gst.length >= 15);
                    return (
                      <tr key={b.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 600, color: "#f8fafc" }}>
                          {b.bill_number}
                        </td>
                        <td style={{ padding: "10px 8px" }}>{b.party_name}</td>
                        <td style={{ padding: "10px 8px", color: hasGSTIN ? "#60a5fa" : "var(--text-muted)" }}>
                          {b.party_gst || "Unregistered (B2C)"}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          {hasGSTIN ? (
                            <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>B2B Eligible</span>
                          ) : (
                            <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>B2C QR</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>
                          ₹{b.total_amount.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <button
                            onClick={() => handleGenerateEinvoice(b.id)}
                            disabled={generatingEinvId === b.id}
                            className={`btn ${hasGSTIN ? "btn-primary" : "btn-secondary"}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", padding: "4px 10px" }}
                          >
                            <QrCode size={13} />
                            <span>{generatingEinvId === b.id ? "Generating..." : hasGSTIN ? "Generate IRN" : "View QR"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* E-Invoice Generated Result Preview */}
          {einvoiceData && (
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                    {einvoiceData.is_b2b ? "Official E-Invoice (IRN) Generated" : "Dynamic UPI Payment QR"}
                  </h3>
                </div>
                <button
                  onClick={() => setEinvoiceData(null)}
                  className="btn btn-secondary"
                  style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Left: IRN & Ack Metadata */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
                  {einvoiceData.irn && (
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        64-Character Invoice Reference Number (IRN):
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          background: "rgba(0,0,0,0.4)",
                          padding: "8px",
                          borderRadius: "6px",
                          color: "#60a5fa",
                          fontSize: "0.8rem",
                          wordBreak: "break-all",
                          marginTop: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span>{einvoiceData.irn}</span>
                        <button
                          onClick={() => copyToClipboard(einvoiceData.irn, "IRN Hash")}
                          className="btn btn-secondary"
                          style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {einvoiceData.ack_no && (
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Ack No:</div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{einvoiceData.ack_no}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Ack Date:</div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{einvoiceData.ack_date}</div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Buyer GSTIN:</div>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{einvoiceData.buyer_gstin || "Unregistered"}</div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Invoice Value:</div>
                    <div style={{ fontWeight: 700, color: "#10b981", fontSize: "1.1rem" }}>
                      ₹{einvoiceData.total_invoice_value.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Right: QR Code & UPI Link */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "10px" }}>
                  <QrCode size={120} color="#ffffff" />
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "8px", textAlign: "center" }}>
                    {einvoiceData.is_b2b ? "Signed B2B E-Invoice QR Payload" : "Scan with GPay / PhonePe / Paytm to Pay"}
                  </div>
                  {einvoiceData.upi_intent_url && (
                    <a
                      href={einvoiceData.upi_intent_url}
                      className="btn btn-secondary"
                      style={{ marginTop: "10px", fontSize: "0.75rem", padding: "4px 10px" }}
                    >
                      Open UPI Intent
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Modal: Overdue Bills Breakdown for selected Debtor/Creditor */}
      {selectedDebtor && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div className="glass-panel" style={{ width: "100%", maxWidth: "650px", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  {selectedDebtor.customer_name}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Total Balance: <strong>₹{selectedDebtor.total_due.toFixed(2)}</strong> • Area: {selectedDebtor.area_name || "General"}
                </div>
              </div>
              <button onClick={() => setSelectedDebtor(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "350px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "8px 4px" }}>Bill No</th>
                    <th style={{ padding: "8px 4px" }}>Date</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Age</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Bill Total</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Paid</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDebtor.overdue_bills?.map((b: any) => (
                    <tr key={b.bill_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "8px 4px", fontWeight: 600, color: "#60a5fa" }}>{b.bill_number}</td>
                      <td style={{ padding: "8px 4px", color: "var(--text-muted)" }}>{new Date(b.bill_date).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", color: b.age_days > 60 ? "#ef4444" : "#f59e0b" }}>{b.age_days}d</td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{b.total_amount.toFixed(2)}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{b.paid_amount.toFixed(2)}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>₹{b.due_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!selectedDebtor.overdue_bills || selectedDebtor.overdue_bills.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        No specific bill items. (Balance driven by Opening Balance).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedCreditor && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div className="glass-panel" style={{ width: "100%", maxWidth: "650px", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  {selectedCreditor.supplier_name}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Total Payable: <strong>₹{selectedCreditor.total_due.toFixed(2)}</strong> • GSTIN: {selectedCreditor.gst_number || "Unregistered"}
                </div>
              </div>
              <button onClick={() => setSelectedCreditor(null)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "350px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "8px 4px" }}>Purchase No</th>
                    <th style={{ padding: "8px 4px" }}>Date</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Age</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Paid</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCreditor.overdue_bills?.map((b: any) => (
                    <tr key={b.bill_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "8px 4px", fontWeight: 600, color: "#60a5fa" }}>{b.bill_number}</td>
                      <td style={{ padding: "8px 4px", color: "var(--text-muted)" }}>{new Date(b.bill_date).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", color: b.age_days > 60 ? "#ef4444" : "#f59e0b" }}>{b.age_days}d</td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{b.total_amount.toFixed(2)}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>₹{b.paid_amount.toFixed(2)}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>₹{b.due_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!selectedCreditor.overdue_bills || selectedCreditor.overdue_bills.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        No specific purchase bill items. (Balance driven by Opening Balance).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
