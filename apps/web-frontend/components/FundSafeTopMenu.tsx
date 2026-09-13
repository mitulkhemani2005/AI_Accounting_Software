"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronDown,
  Layers,
  BookOpen,
  FileSpreadsheet,
  Receipt,
  FileText,
  Sliders,
  Eye,
  AppWindow,
  CreditCard,
  Sparkles,
  Users,
  Shield,
  HelpCircle,
  LogOut,
} from "lucide-react";

interface MenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  divider?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function FundSafeTopMenu() {
  const { user, tenant, logout, isAdmin } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuSections: MenuSection[] = [
    {
      title: "MASTER SETUP",
      items: [
        { label: "Accounts / Parties Master (Ctrl+L)", href: "/dashboard/parties" },
        { label: "Customer Master", href: "/dashboard/parties?tab=customers" },
        { label: "Supplier Master", href: "/dashboard/parties?tab=suppliers" },
        { label: "Trade Area / Routes", href: "/dashboard/parties?tab=areas" },
        { label: "Divider", divider: true },
        { label: "Item Master & Control (Alt+I)", href: "/dashboard/inventory" },
        { label: "Staff & Sub-user Accounts", href: "/dashboard/staff" },
        { label: "Company Profile & Business Details", href: "/dashboard" },
      ],
    },
    {
      title: "INVENTORY",
      items: [
        { label: "Products & Stock Register", href: "/dashboard/inventory" },
        { label: "Low Stock Alert Queue", href: "/dashboard/inventory" },
        { label: "Divider", divider: true },
        { label: "Purchase Book (Inward Stock)", href: "/dashboard/inventory?tab=purchases" },
      ],
    },
    {
      title: "F.A. SYSTEM",
      items: [
        { label: "Payment Voucher (Payments Out)", href: "/dashboard/accounting/payments" },
        { label: "Receipt Voucher (Payments In)", href: "/dashboard/accounting/receipts" },
        { label: "Divider", divider: true },
        { label: "Accounts Voucher (Journal Entry F10)", href: "/dashboard/accounting?tab=new-voucher" },
        { label: "Voucher List (Day Book F9)", href: "/dashboard/accounting?tab=daybook" },
        { label: "Cash & Bank Book", href: "/dashboard/accounting?tab=cashbank" },
        { label: "General Ledger Statement", href: "/dashboard/accounting?tab=ledger" },
        { label: "Chart of Accounts (COA)", href: "/dashboard/accounting?tab=coa" },
      ],
    },
    {
      title: "ACCOUNTS REPORTS",
      items: [
        { label: "Ledgers Balance Report", href: "/dashboard/reports/ledger-balances", badge: "NEW" },
        { label: "Trial Balance (Gross / Net)", href: "/dashboard/accounting?tab=trialbalance" },
        { label: "Profit & Loss Account", href: "/dashboard/accounting?tab=pl" },
        { label: "Balance Sheet Statement", href: "/dashboard/accounting?tab=balancesheet" },
        { label: "Day Book Register", href: "/dashboard/accounting?tab=daybook" },
      ],
    },
    {
      title: "REPORTS",
      items: [
        { label: "List of Bills (Sales Register F11)", href: "/dashboard/sales" },
        { label: "Sundry Debtors Ageing (0-90+ Days)", href: "/dashboard/reports?tab=debtors" },
        { label: "Sundry Creditors Ageing", href: "/dashboard/reports?tab=creditors" },
        { label: "Automated WhatsApp Reminders", href: "/dashboard/reports?tab=reminders" },
        { label: "Stock Summary Report", href: "/dashboard/inventory" },
      ],
    },
    {
      title: "SUB REPORTS",
      items: [
        { label: "GSTR-1 Outward Supplies", href: "/dashboard/reports?tab=gstr1" },
        { label: "GSTR-3B Tax Summary", href: "/dashboard/reports?tab=gstr3b" },
        { label: "System Audit Trail & Log", href: "/dashboard/audit" },
      ],
    },
    {
      title: "TOOLS",
      items: [
        { label: "AI Suggestions & Intelligence Hub", href: "/dashboard/ai", badge: "AI" },
        { label: "Subscription & License Entitlements", href: "/dashboard/subscription" },
        { label: "System Audit Trail & Logs", href: "/dashboard/audit" },
      ],
    },
    {
      title: "VIEW",
      items: [
        { label: "POS Counter Billing (F12)", href: "/dashboard/pos", badge: "POS" },
        { label: "Staff Bills Review Queue", href: "/dashboard/staff-bills" },
        { label: "All Sales Invoices", href: "/dashboard/sales" },
      ],
    },
    {
      title: "WINDOWS",
      items: [
        { label: "FundSafe Gateway Hub", href: "/dashboard" },
        { label: "Refresh Current View", onClick: () => window.location.reload() },
      ],
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #cbd5e1",
        color: "#0f172a",
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        height: "28px",
        userSelect: "none",
        position: "relative",
        zIndex: 40,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Link
          href="/dashboard"
          style={{
            background: "#dc2626",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: "0.8rem",
            width: "20px",
            height: "20px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "6px",
            textDecoration: "none",
          }}
          title="FundSafe Gateway Hub"
        >
          F
        </Link>
        {menuSections.map((sec) => {
          const isOpen = openMenu === sec.title;
          return (
            <div key={sec.title} style={{ position: "relative", height: "100%" }}>
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : sec.title)}
                onMouseEnter={() => {
                  if (openMenu !== null) setOpenMenu(sec.title);
                }}
                style={{
                  height: "100%",
                  padding: "0 10px",
                  background: isOpen ? "#1e1b4b" : "transparent",
                  color: isOpen ? "#ffffff" : "#1e293b",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                {sec.title}
              </button>

              {isOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    minWidth: "250px",
                    background: "#ffffff",
                    border: "1px solid #94a3b8",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    borderRadius: "0 0 6px 6px",
                    padding: "4px 0",
                    zIndex: 60,
                  }}
                >
                  {sec.items.map((it, idx) => {
                    if (it.divider) {
                      return (
                        <div
                          key={`div-${idx}`}
                          style={{
                            height: "1px",
                            background: "#e2e8f0",
                            margin: "4px 0",
                          }}
                        />
                      );
                    }

                    return (
                      <div key={it.label}>
                        {it.href ? (
                          <Link
                            href={it.href}
                            onClick={() => setOpenMenu(null)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 14px",
                              color: "#1e293b",
                              textDecoration: "none",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "#eff6ff";
                              (e.currentTarget as HTMLElement).style.color = "#1d4ed8";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#1e293b";
                            }}
                          >
                            <span>{it.label}</span>
                            {it.badge && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background: "#3b82f6",
                                  color: "#ffffff",
                                }}
                              >
                                {it.badge}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              it.onClick?.();
                              setOpenMenu(null);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: "none",
                              border: "none",
                              padding: "6px 14px",
                              color: "#1e293b",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "#eff6ff";
                              (e.currentTarget as HTMLElement).style.color = "#1d4ed8";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#1e293b";
                            }}
                          >
                            <span>{it.label}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", color: "#334155", fontSize: "0.74rem" }}>
        <span style={{ fontWeight: 700, color: "#0f172a" }}>
          {tenant?.business_name || ""}
        </span>
        {tenant?.business_name && (
          <>
            <span style={{ color: "#94a3b8" }}>&bull;</span>
          </>
        )}
        <span style={{ fontWeight: 600, color: "#1e293b" }}>
          {user?.name || ""}{isAdmin ? " (Admin)" : ""}
        </span>
        <button
          onClick={logout}
          title="Log out of FundSafe"
          style={{
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: "3px",
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginLeft: "4px",
          }}
        >
          <LogOut size={12} /> Logout
        </button>
      </div>
    </div>
  );
}
