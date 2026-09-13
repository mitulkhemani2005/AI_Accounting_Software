"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  Receipt,
  BookOpen,
  Boxes,
  FileText,
  CreditCard,
  Building2,
  Users,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Printer,
  Barcode,
  Layers,
  FileSpreadsheet,
  IndianRupee,
  ShieldCheck,
  Package,
} from "lucide-react";
import { FundSafeStatusBar } from "@/components/FundSafeStatusBar";

export default function DashboardPage() {
  const { user, tenant, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Stats State
  const [salesSummary, setSalesSummary] = useState({
    totalSales: 0,
    monthSales: 0,
    todaySales: 0,
    cashSales: 0,
    cardSales: 0,
    chequeSales: 0,
    creditSales: 0,
  });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch live metrics
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.get("/bills?bill_type=sale");
        const bills = Array.isArray(res.data) ? res.data : [];

        setRecentBills(bills.slice(0, 10));

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split("T")[0];

        let total = 0;
        let month = 0;
        let today = 0;
        let cash = 0;
        let card = 0;
        let cheque = 0;
        let credit = 0;

        for (const b of bills) {
          const amt = Number(b.total_amount) || 0;
          total += amt;

          const billDate = new Date(b.created_at || b.bill_date);
          if (
            billDate.getMonth() === currentMonth &&
            billDate.getFullYear() === currentYear
          ) {
            month += amt;
          }
          if (b.created_at?.startsWith(todayStr)) {
            today += amt;
          }

          const mode = (b.payment_mode || "cash").toLowerCase();
          if (mode === "cash") cash += amt;
          else if (mode === "card" || mode === "upi") card += amt;
          else if (mode === "cheque") cheque += amt;
          else credit += amt;
        }

        setSalesSummary({
          totalSales: total,
          monthSales: month,
          todaySales: today,
          cashSales: cash,
          cardSales: card,
          chequeSales: cheque,
          creditSales: credit,
        });
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Keyboard Hotkey Navigation (Matches Reference Image Hotkeys)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // F12 -> POS Counter Sale (Sales Voucher)
      if (e.key === "F12") {
        e.preventDefault();
        router.push("/dashboard/pos");
      }
      // F11 -> Sales Voucher List
      else if (e.key === "F11") {
        e.preventDefault();
        router.push("/dashboard/sales");
      }
      // F10 -> Accounts Voucher
      else if (e.key === "F10") {
        e.preventDefault();
        router.push("/dashboard/accounting?tab=new-voucher");
      }
      // F9 -> Voucher List / Day Book
      else if (e.key === "F9") {
        e.preventDefault();
        router.push("/dashboard/accounting?tab=daybook");
      }
      // Ctrl+L -> Accounts / Parties
      else if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        router.push("/dashboard/parties");
      }
      // Alt+I -> Item Master / Control Panel
      else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        router.push("/dashboard/inventory");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const businessName = (tenant?.business_name || "").toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 32px)",
        background: "#ffffff",
        color: "#0f172a",
        overflow: "hidden",
      }}
    >
      {/* 1. Classic Windows Window Title Bar */}
      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          padding: "6px 14px",
          fontSize: "0.85rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          borderBottom: "1px solid #cbd5e1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              background: "#dc2626",
              color: "#ffffff",
              padding: "1px 6px",
              borderRadius: "3px",
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            FUNDSAFE
          </span>
          <span style={{ color: "#0f172a", fontWeight: 700 }}>
            FundSafe{businessName ? ` — ${businessName}` : ""}
          </span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "#475569" }}>
          Press [F12] for Sales &bull; [F11] for Bill List &bull; [F10] for Accounts Voucher &bull; [Ctrl+L] for Ledger
        </div>
      </div>

      {/* 2. Main Gateway Body */}
      <div
        style={{
          display: "flex",
          flex: 1,
          background: "#ffffff",
          position: "relative",
          minHeight: "560px",
        }}
      >
        {/* LEFT PANEL: Sales & Ticker */}
        <aside
          style={{
            width: isLeftPanelOpen ? "220px" : "36px",
            transition: "width 0.2s ease-in-out",
            background: "#ffffff",
            borderRight: "1px solid #cbd5e1",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            style={{
              position: "absolute",
              top: "8px",
              right: "4px",
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              background: "#1e1b4b",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
            title={isLeftPanelOpen ? "Collapse Sales Panel" : "Expand Sales Panel"}
          >
            {isLeftPanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {isLeftPanelOpen && (
            <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "14px", height: "100%", overflowY: "auto" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "4px",
                    marginBottom: "8px",
                    letterSpacing: "0.05em",
                  }}
                >
                  - SALES -
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Sales</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                  ₹ {salesSummary.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "8px" }}>Month Sales</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", fontFamily: "monospace" }}>
                  ₹ {salesSummary.monthSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "8px" }}>Today Sales</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#047857", fontFamily: "monospace" }}>
                  ₹ {salesSummary.todaySales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Mode breakdown */}
              <div
                style={{
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: "10px",
                  fontSize: "0.725rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  color: "#334155",
                  fontFamily: "monospace",
                }}
              >
                <div>Cash Sales : ₹ {salesSummary.cashSales.toFixed(2)}</div>
                <div>Card Sales : ₹ {salesSummary.cardSales.toFixed(2)}</div>
                <div>Cheque Sales : ₹ {salesSummary.chequeSales.toFixed(2)}</div>
                <div>Credit Sales : ₹ {salesSummary.creditSales.toFixed(2)}</div>
              </div>

              {/* Live recent bills stream */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", flex: 1 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                  Recent Invoices
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {recentBills.length > 0 ? (
                    recentBills.slice(0, 5).map((b) => (
                      <Link
                        key={b.id}
                        href="/dashboard/sales"
                        style={{
                          fontSize: "0.7rem",
                          color: "#1e40af",
                          textDecoration: "none",
                          lineHeight: 1.3,
                          padding: "4px",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                        }}
                      >
                        <strong style={{ color: "#0f172a" }}>Bill No. {b.bill_number}</strong> &bull; ₹{b.total_amount}
                        <div style={{ color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.party_name || "Cash Customer"}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      No recent sales
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Left Links */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <Link
                  href="/dashboard/sales"
                  style={{ fontSize: "0.75rem", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                >
                  &rsaquo; Sale By Users
                </Link>
                <Link
                  href="/dashboard/accounting/receipts"
                  style={{ fontSize: "0.75rem", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                >
                  &rsaquo; Receipts (Inward)
                </Link>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER PANEL: Metro Tile Matrix (Matches Image 3) */}
        <div
          style={{
            flex: 1,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflowX: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: "860px" }}>
            {/* Metro Tiles 5-Column Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.2fr 1.3fr 1.1fr 1.2fr",
                gridTemplateRows: "115px 115px",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              {/* Col 1, Row 1: ACCOUNT (Ctrl+L) [Olive Green] */}
              <Link
                href="/dashboard/parties"
                style={{
                  background: "#708238",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  transition: "transform 0.1s, opacity 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.04em" }}>
                    ACCOUNT
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 700,
                    }}
                  >
                    Ctrl+L
                  </span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <Users size={32} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  Party Master
                </div>
              </Link>

              {/* Col 2, Row 1: VOUCHER LIST (F9) [Cream Yellow] */}
              <Link
                href="/dashboard/accounting?tab=daybook"
                style={{
                  background: "#fef08a",
                  color: "#1e293b",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  transition: "transform 0.1s, opacity 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    VOUCHER LIST
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.1)",
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 700,
                    }}
                  >
                    F9
                  </span>
                </div>
                <div style={{ alignSelf: "center", color: "#854d0e" }}>
                  <BookOpen size={30} />
                </div>
                <div style={{ fontSize: "0.65rem", color: "#475569", textAlign: "right" }}>
                  Day Book Register
                </div>
              </Link>

              {/* Col 3, Row 1: SALES VOUCHER (F12) [Vibrant Red] */}
              <Link
                href="/dashboard/pos"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  transition: "transform 0.1s, opacity 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    SALES VOUCHER
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 700,
                    }}
                  >
                    F12
                  </span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <ShoppingCart size={34} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  POS Billing Counter
                </div>
              </Link>

              {/* Col 4, Row 1: RECEIPTS [Gold / Yellow-Brown] */}
              <Link
                href="/dashboard/accounting/receipts"
                style={{
                  background: "#ca8a04",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  transition: "transform 0.1s, opacity 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                  RECEIPTS
                </div>
                <div style={{ alignSelf: "center" }}>
                  <Receipt size={32} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  Payments In
                </div>
              </Link>

              {/* Col 5, Row 1 & 2: LEDGER (Spanning tall tile) [Deep Navy Blue] */}
              <Link
                href="/dashboard/accounting?tab=ledger"
                style={{
                  gridRow: "span 2",
                  background: "#1e1b4b",
                  color: "#ffffff",
                  padding: "16px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transition: "transform 0.1s, opacity 0.1s",
                  border: "1px solid #312e81",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 900, fontSize: "1.05rem", letterSpacing: "0.06em" }}>
                    LEDGER
                  </span>
                  <FileText size={20} color="#93c5fd" />
                </div>
                <div style={{ alignSelf: "center", margin: "16px 0" }}>
                  <FileSpreadsheet size={48} color="#60a5fa" />
                </div>
                <div style={{ fontSize: "0.725rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                  General Ledger Statements &bull; Party Accounts &bull; Running Balances
                </div>
              </Link>

              {/* Col 1, Row 2: ITEMS [Orange] */}
              <Link
                href="/dashboard/inventory"
                style={{
                  background: "#ea580c",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                  ITEMS
                </div>
                <div style={{ alignSelf: "center" }}>
                  <Boxes size={30} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  Product Catalog
                </div>
              </Link>

              {/* Col 2, Row 2: ACCOUNTS VOUCHER (F10) [Terracotta Red-Brown] */}
              <Link
                href="/dashboard/accounting?tab=new-voucher"
                style={{
                  background: "#c2410c",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.82rem" }}>
                    ACCOUNTS VOUCHER
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 700,
                    }}
                  >
                    F10
                  </span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <IndianRupee size={28} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  Journal Voucher
                </div>
              </Link>

              {/* Col 3, Row 2: SALES VOUCHER LIST (F11) [Teal / Slate Cyan] */}
              <Link
                href="/dashboard/sales"
                style={{
                  background: "#0891b2",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.8rem" }}>
                    SALES VOUCHER LIST
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 700,
                    }}
                  >
                    F11
                  </span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <FileText size={28} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  List of Bills
                </div>
              </Link>

              {/* Col 4, Row 2: PAYMENTS [Orange] */}
              <Link
                href="/dashboard/accounting/payments"
                style={{
                  background: "#f97316",
                  color: "#ffffff",
                  padding: "12px",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                  PAYMENTS
                </div>
                <div style={{ alignSelf: "center" }}>
                  <CreditCard size={28} />
                </div>
                <div style={{ fontSize: "0.65rem", opacity: 0.9, textAlign: "right" }}>
                  Payments Out
                </div>
              </Link>
            </div>

            {/* Bottom Row 3: Item Control Panel Small strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 4.8fr", gap: "8px", marginBottom: "12px" }}>
              <Link
                href="/dashboard/inventory"
                style={{
                  background: "#fef08a",
                  color: "#854d0e",
                  padding: "8px 10px",
                  borderRadius: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <span>ITEM CONTROL PANEL</span>
                <span
                  style={{
                    background: "rgba(0,0,0,0.1)",
                    fontSize: "0.65rem",
                    padding: "1px 4px",
                    borderRadius: "2px",
                  }}
                >
                  ALT+I
                </span>
              </Link>
              <div
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: "2px",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "0.75rem",
                  color: "#475569",
                }}
              >
                <span>Fast Counter POS &bull; Full Stock Engine &bull; Automated GST & WhatsApp Reminders</span>
              </div>
            </div>

            {/* Strip 1: Core Functional Modules (Only Actual Existing Features) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              {[
                { label: "PURCHASE BOOK", href: "/dashboard/inventory?tab=purchases" },
                { label: "STAFF BILLS REVIEW", href: "/dashboard/staff-bills" },
                { label: "OUTSTANDING AGEING", href: "/dashboard/reports?tab=debtors" },
                { label: "GST RETURNS", href: "/dashboard/reports?tab=gstr1" },
                { label: "AI INTELLIGENCE", href: "/dashboard/ai" },
              ].map((b) => (
                <Link
                  key={b.label}
                  href={b.href}
                  style={{
                    background: "#1e1b4b",
                    color: "#ffffff",
                    textAlign: "center",
                    padding: "8px 4px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    borderRadius: "2px",
                    letterSpacing: "0.03em",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#312e81")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1e1b4b")}
                >
                  {b.label}
                </Link>
              ))}
            </div>

            {/* Strip 2: Quick Access to All Existing Modules */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: "4px",
              }}
            >
              {[
                { label: "GSTR-1", bg: "#eab308", color: "#1e293b", href: "/dashboard/reports?tab=gstr1" },
                { label: "GSTR-3B", bg: "#16a34a", color: "#ffffff", href: "/dashboard/reports?tab=gstr3b" },
                { label: "DEBTORS", bg: "#1e3a8a", color: "#ffffff", href: "/dashboard/reports?tab=debtors" },
                { label: "CREDITORS", bg: "#0f172a", color: "#ffffff", href: "/dashboard/reports?tab=creditors" },
                { label: "LOW STOCK", bg: "#ea580c", color: "#ffffff", href: "/dashboard/inventory" },
                { label: "STAFF / RBAC", bg: "#7c3aed", color: "#ffffff", href: "/dashboard/staff" },
                { label: "AUDIT LOGS", bg: "#0891b2", color: "#ffffff", href: "/dashboard/audit" },
                { label: "PLANS & BILLING", bg: "#475569", color: "#ffffff", href: "/dashboard/subscription" },
              ].map((p) => (
                <Link
                  key={p.label}
                  href={p.href}
                  style={{
                    background: p.bg,
                    color: p.color,
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    textAlign: "center",
                    padding: "7px 2px",
                    borderRadius: "2px",
                    textDecoration: "none",
                    lineHeight: 1.15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: FUNDSAFE GATEWAY (Matches Image 3) */}
        <aside
          style={{
            width: "220px",
            background: "#ffffff",
            borderLeft: "1px solid #cbd5e1",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: "#1e1b4b",
              color: "#ffffff",
              padding: "10px 14px",
              fontSize: "0.85rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              textAlign: "center",
            }}
          >
            FUNDSAFE GATEWAY
          </div>

          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {[
              { label: "MASTER SETUP", href: "/dashboard/parties" },
              { label: "INVENTORY & STOCK", href: "/dashboard/inventory" },
              { label: "PURCHASE BOOK", href: "/dashboard/inventory?tab=purchases" },
              { label: "POS COUNTER SALE", href: "/dashboard/pos" },
              { label: "SALES REGISTER", href: "/dashboard/sales" },
              { label: "STAFF BILLS REVIEW", href: "/dashboard/staff-bills" },
              { label: "F.A. ACCOUNTING", href: "/dashboard/accounting" },
              { label: "PAYMENT VOUCHERS", href: "/dashboard/accounting/payments" },
              { label: "RECEIPT VOUCHERS", href: "/dashboard/accounting/receipts" },
              { label: "LEDGERS BALANCE", href: "/dashboard/reports/ledger-balances" },
              { label: "OUTSTANDING AGEING", href: "/dashboard/reports?tab=debtors" },
              { label: "GST RETURNS", href: "/dashboard/reports?tab=gstr1" },
              { label: "AI INTELLIGENCE", href: "/dashboard/ai" },
              { label: "STAFF MANAGEMENT", href: "/dashboard/staff" },
              { label: "AUDIT LOGS", href: "/dashboard/audit" },
              { label: "QUIT / LOGOUT", onClick: logout, isDanger: true },
            ].map((m) =>
              m.href ? (
                <Link
                  key={m.label}
                  href={m.href}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "2px",
                    color: "#1e293b",
                    textDecoration: "none",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    background: "#f8fafc",
                    display: "block",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#1e1b4b";
                    (e.currentTarget as HTMLElement).style.color = "#ffffff";
                    (e.currentTarget as HTMLElement).style.borderColor = "#1e1b4b";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                    (e.currentTarget as HTMLElement).style.color = "#1e293b";
                    (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
                  }}
                >
                  {m.label}
                </Link>
              ) : (
                <button
                  key={m.label}
                  type="button"
                  onClick={m.onClick}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #fecaca",
                    borderRadius: "2px",
                    color: "#dc2626",
                    background: "#fef2f2",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#dc2626";
                    (e.currentTarget as HTMLElement).style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#fef2f2";
                    (e.currentTarget as HTMLElement).style.color = "#dc2626";
                  }}
                >
                  {m.label}
                </button>
              )
            )}
          </div>

          <div
            style={{
              marginTop: "auto",
              padding: "12px",
              background: "#f1f5f9",
              borderTop: "1px solid #e2e8f0",
              fontSize: "0.725rem",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            <div>FundSafe ERP v2.4</div>
            <div style={{ marginTop: "2px", fontWeight: 600, color: "#047857" }}>
              Active Multi-Tenant License
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Docked Classic Status Bar */}
      <FundSafeStatusBar moduleName="Gateway Hub" recordCount={recentBills.length} />
    </div>
  );
}
