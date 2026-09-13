"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function ERPHeader() {
  const { user, tenant, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Keyboard Shortcuts (F12 = POS, F11 = Bills, F10 = Voucher, F9 = Daybook, Ctrl+L = Ledger, Esc = Close Menu)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null);
      } else if (e.key === "F12") {
        e.preventDefault();
        router.push("/dashboard/pos");
      } else if (e.key === "F11") {
        e.preventDefault();
        router.push("/dashboard/bills");
      } else if (e.key === "F10") {
        e.preventDefault();
        router.push("/dashboard/accounting?tab=vouchers");
      } else if (e.key === "F9") {
        e.preventDefault();
        router.push("/dashboard/accounting?tab=daybook");
      } else if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        router.push("/dashboard/accounting?tab=ledger");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const toggleMenu = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleNavigate = (path: string) => {
    setActiveMenu(null);
    router.push(path);
  };

  const firmTitle = tenant?.business_name
    ? tenant.business_name.toUpperCase()
    : "KHEMANI BROTHERS";

  const getScreenTitle = () => {
    if (pathname.includes("/dashboard/pos")) return "INVOICE GENERATION";
    if (pathname.includes("/dashboard/bills")) return "LIST OF BILLS";
    if (pathname.includes("/dashboard/vouchers")) return "RECEIPT / PAYMENT VOUCHER";
    if (pathname.includes("/dashboard/accounting")) return "FINANCIAL ACCOUNTING & REPORTS";
    if (pathname.includes("/dashboard/items")) return "ITEM MASTER & BARCODE SETUP";
    if (pathname.includes("/dashboard/parties")) return "PARTY MASTER & AREA SETUP";
    if (pathname.includes("/dashboard/inventory")) return "INVENTORY & GODOWN MANAGEMENT";
    return "[Select Option]";
  };

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 100 }} ref={menuRef}>
      {/* Windows 11 / Windows Classic Title Bar */}
      <div className="erp-titlebar">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#b91c1c", fontWeight: 800, fontSize: "0.85rem" }}>F</span>
          <span style={{ color: "#1d4ed8", fontWeight: 800, fontSize: "0.85rem" }}>O</span>
          <span style={{ color: "#120a42", marginLeft: "4px" }}>
            FundCare for {firmTitle} For A/C Year 2026-2027 - {getScreenTitle()}
          </span>
        </div>
        <div className="erp-window-controls">
          <span style={{ fontSize: "0.75rem", color: "#64748b", marginRight: "8px" }}>
            User: <strong>{user?.name || "ADMIN"}</strong>
          </span>
          <button className="erp-win-btn" title="Minimize" onClick={() => router.push("/dashboard")}>
            &minus;
          </button>
          <button
            className="erp-win-btn"
            title="Maximize / Refresh"
            onClick={() => window.location.reload()}
          >
            &#9633;
          </button>
          <button
            className="erp-win-btn erp-win-btn-close"
            title="Logout / Exit"
            onClick={logout}
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* Main ERP Dropdown Menu Bar */}
      <div className="erp-menubar">
        {/* 1. MASTER SETUP */}
        <div
          className={`erp-menu-item ${activeMenu === "master" ? "active" : ""}`}
          onClick={() => toggleMenu("master")}
        >
          MASTER SETUP
          {activeMenu === "master" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/items")}>
                <span>Item Master & Pricing</span>
                <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>Alt+I</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/parties")}>
                <span>Party Master (Debtors / Creditors)</span>
                <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>Alt+P</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/parties")}>
                <span>Area Master Setup</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Godown / Location Master</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=coa")}>
                <span>Chart of Accounts (COA)</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/staff")}>
                <span>Sub-Users & Permissions</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. INVENTORY */}
        <div
          className={`erp-menu-item ${activeMenu === "inventory" ? "active" : ""}`}
          onClick={() => toggleMenu("inventory")}
        >
          INVENTORY
          {activeMenu === "inventory" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Stock In / Goods Purchase Book</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Inter-Godown Stock Transfer</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Stock Valuation & Low Stock Alerts</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/items")}>
                <span>Barcode Add / Print Labels</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. F.A. SYSTEM */}
        <div
          className={`erp-menu-item ${activeMenu === "fa" ? "active" : ""}`}
          onClick={() => toggleMenu("fa")}
        >
          F.A. SYSTEM
          {activeMenu === "fa" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/pos")}>
                <span>Sales Invoice Generation</span>
                <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "0.75rem" }}>F12</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/bills")}>
                <span>List of Bills / Sales Register</span>
                <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "0.75rem" }}>F11</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/vouchers?type=receipt")}>
                <span>Receipt Voucher</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/vouchers?type=payment")}>
                <span>Payment Voucher</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=vouchers")}>
                <span>Accounts Journal Voucher</span>
                <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "0.75rem" }}>F10</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=daybook")}>
                <span>Voucher List</span>
                <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "0.75rem" }}>F9</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. ACCOUNTS REPORTS */}
        <div
          className={`erp-menu-item ${activeMenu === "accounts_reports" ? "active" : ""}`}
          onClick={() => toggleMenu("accounts_reports")}
        >
          ACCOUNTS REPORTS
          {activeMenu === "accounts_reports" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=daybook")}>
                <span>Day Book Report</span>
                <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>F9</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=cashbank")}>
                <span>Cash Book & Bank Book</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=ledger")}>
                <span>Ledgers Balance Report</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=ledger")}>
                <span>Statement of Account (General Ledger)</span>
                <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>Ctrl+L</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=trial_balance")}>
                <span>Trial Balance (2-Column Balanced)</span>
              </div>
            </div>
          )}
        </div>

        {/* 5. REPORTS */}
        <div
          className={`erp-menu-item ${activeMenu === "reports" ? "active" : ""}`}
          onClick={() => toggleMenu("reports")}
        >
          REPORTS
          {activeMenu === "reports" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=pl")}>
                <span>Profit & Loss Statement (Trading + P&L)</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=balance_sheet")}>
                <span>Balance Sheet</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/bills")}>
                <span>Sales Summary & Register</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Purchase Register</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/inventory")}>
                <span>Stock Valuation Report</span>
              </div>
            </div>
          )}
        </div>

        {/* 6. SUB REPORTS */}
        <div
          className={`erp-menu-item ${activeMenu === "sub_reports" ? "active" : ""}`}
          onClick={() => toggleMenu("sub_reports")}
        >
          SUB REPORTS
          {activeMenu === "sub_reports" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/parties")}>
                <span>Sundry Debtors Outstanding (Receivables)</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/parties")}>
                <span>Sundry Creditors Outstanding (Payables)</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=gst")}>
                <span>GSTR-1 Tax Filing Summary (3.1.3, 3.2.2)</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting?tab=gst")}>
                <span>GSTR-3B Monthly Return Summary</span>
              </div>
            </div>
          )}
        </div>

        {/* 7. TOOLS */}
        <div
          className={`erp-menu-item ${activeMenu === "tools" ? "active" : ""}`}
          onClick={() => toggleMenu("tools")}
        >
          TOOLS
          {activeMenu === "tools" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard")}>
                <span>Gateway Dashboard</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/pos")}>
                <span>Thermal POS Counter</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => window.location.reload()}>
                <span>Refresh Application State</span>
              </div>
            </div>
          )}
        </div>

        {/* 8. VIEW */}
        <div
          className={`erp-menu-item ${activeMenu === "view" ? "active" : ""}`}
          onClick={() => toggleMenu("view")}
        >
          VIEW
          {activeMenu === "view" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard")}>
                <span>FundCare Gateway View</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/bills")}>
                <span>List of Bills</span>
              </div>
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard/accounting")}>
                <span>Accounting & Financial Statements</span>
              </div>
            </div>
          )}
        </div>

        {/* 9. WINDOWS */}
        <div
          className={`erp-menu-item ${activeMenu === "windows" ? "active" : ""}`}
          onClick={() => toggleMenu("windows")}
        >
          WINDOWS
          {activeMenu === "windows" && (
            <div className="erp-dropdown">
              <div className="erp-dropdown-item" onClick={() => handleNavigate("/dashboard")}>
                <span>Close to Gateway</span>
              </div>
              <div className="erp-dropdown-divider" />
              <div className="erp-dropdown-item" onClick={logout} style={{ color: "#dc2626" }}>
                <span>Log Out / Exit Session</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
