"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Printer,
  X,
  Search,
  RefreshCw,
  Filter,
  Download,
  Building2,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { FundSafeStatusBar } from "@/components/FundSafeStatusBar";

interface LedgerBalanceRow {
  id: string;
  name: string;
  address: string;
  place: string;
  opBalD?: number;
  opBalC?: number;
  debitTotal?: number;
  creditTotal?: number;
  clBalD?: number;
  clBalC?: number;
}

export default function LedgersBalanceReportPage() {
  const { tenant } = useAuth();
  const router = useRouter();

  const [ledgerRows, setLedgerRows] = useState<LedgerBalanceRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      const [custRes, suppRes] = await Promise.all([
        api.get("/parties/customers"),
        api.get("/parties/suppliers"),
      ]);

      const customers = Array.isArray(custRes.data) ? custRes.data : [];
      const suppliers = Array.isArray(suppRes.data) ? suppRes.data : [];

      const liveRows: LedgerBalanceRow[] = [];

      customers.forEach((c) => {
        const bal = Number(c.current_balance) || 0;
        const opBal = Number(c.opening_balance) || 0;
        liveRows.push({
          id: c.id,
          name: c.name,
          address: c.address || c.area_name || "LOCAL",
          place: c.state || "UJJAIN",
          opBalD: opBal > 0 ? opBal : undefined,
          opBalC: opBal < 0 ? Math.abs(opBal) : undefined,
          debitTotal: bal > opBal ? bal - opBal : undefined,
          creditTotal: bal < opBal ? opBal - bal : undefined,
          clBalD: bal > 0 ? bal : undefined,
          clBalC: bal < 0 ? Math.abs(bal) : undefined,
        });
      });

      suppliers.forEach((s) => {
        const bal = Number(s.current_balance) || 0;
        const opBal = Number(s.opening_balance) || 0;
        liveRows.push({
          id: s.id,
          name: s.name,
          address: s.address || s.area_name || "LOCAL",
          place: s.state || "INDORE",
          opBalC: opBal > 0 ? opBal : undefined,
          opBalD: opBal < 0 ? Math.abs(opBal) : undefined,
          clBalC: bal > 0 ? bal : undefined,
          clBalD: bal < 0 ? Math.abs(bal) : undefined,
        });
      });

      setLedgerRows(liveRows);
    } catch (err) {
      console.error("Error loading ledger balances", err);
      setLedgerRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  const filteredRows = React.useMemo(() => {
    if (!searchQuery) return ledgerRows;
    const q = searchQuery.toLowerCase();
    return ledgerRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        r.place.toLowerCase().includes(q)
    );
  }, [ledgerRows, searchQuery]);

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
      {/* 1. Header Bar matching Image 2 */}
      <div
        style={{
          background: "#ffffff",
          padding: "10px 18px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Left: FO LEDGERS BALANCE REPORT */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "4px",
              background: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: "1.1rem",
              letterSpacing: "-0.05em",
            }}
          >
            FO
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e1b4b", letterSpacing: "0.03em" }}>
            LEDGERS BALANCE REPORT
          </h1>
        </div>

        {/* Right: Search + Print + Close */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Quick Search */}
          <div style={{ position: "relative", width: "220px" }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#64748b" }} />
            <input
              type="text"
              placeholder="Search Ledger / Place..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 8px 4px 28px",
                fontSize: "0.78rem",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                outline: "none",
              }}
            />
          </div>

          {/* (🖨️) Print Button */}
          <button
            onClick={() => window.print()}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Print Ledgers Balance Report"
          >
            <Printer size={18} strokeWidth={2} />
          </button>

          {/* (✖) Close Button */}
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Close (Exit to Dashboard)"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 2. Main Data Table matching Image 2 */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.78rem",
            textAlign: "left",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#16082f",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.75rem",
                letterSpacing: "0.03em",
                height: "34px",
                position: "sticky",
                top: 0,
                zIndex: 20,
              }}
            >
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "260px" }}>Name</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "200px" }}>Address</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "110px" }}>Place</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "110px" }}>OpBal(D)</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "110px" }}>OpBal(C)</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "120px" }}>Debit Total</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "120px" }}>Credit Total</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "110px" }}>ClBal(D)</th>
              <th style={{ padding: "6px 10px", textAlign: "right", width: "110px" }}>ClBal(C)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Loading ledgers balance report...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No ledger balances found.
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => {
                const isSelected = selectedRowId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRowId(r.id)}
                    style={{
                      background: isSelected ? "#c7d2fe" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      cursor: "pointer",
                      height: "26px",
                      color: isSelected ? "#1e1b4b" : "#0f172a",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0" }}>{r.address}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0" }}>{r.place}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace" }}>
                      {r.opBalD !== undefined ? r.opBalD.toFixed(2) : ""}
                    </td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace" }}>
                      {r.opBalC !== undefined ? r.opBalC.toFixed(2) : ""}
                    </td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace" }}>
                      {r.debitTotal !== undefined ? r.debitTotal.toFixed(2) : ""}
                    </td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace" }}>
                      {r.creditTotal !== undefined ? r.creditTotal.toFixed(2) : ""}
                    </td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      {r.clBalD !== undefined ? r.clBalD.toFixed(2) : ""}
                    </td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      {r.clBalC !== undefined ? r.clBalC.toFixed(2) : ""}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Docked Classic Status Bar */}
      <FundSafeStatusBar moduleName="Ledgers Balance Report" recordCount={filteredRows.length} />
    </div>
  );
}
