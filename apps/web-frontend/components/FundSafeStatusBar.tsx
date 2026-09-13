"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

interface FundSafeStatusBarProps {
  moduleName?: string;
  recordCount?: number;
}

export function FundSafeStatusBar({ moduleName, recordCount }: FundSafeStatusBarProps) {
  const { tenant, user } = useAuth();
  const businessName = (tenant?.business_name || "").toUpperCase();

  return (
    <footer
      style={{
        height: "24px",
        background: "#e2e8f0",
        borderTop: "1px solid #cbd5e1",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: "0.725rem",
        color: "#1e293b",
        fontFamily: "monospace",
        userSelect: "none",
        width: "100%",
        position: "sticky",
        bottom: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {businessName && <span style={{ fontWeight: 700, color: "#1e40af" }}>{businessName}</span>}

        {moduleName && (
          <span style={{ color: "#475569", fontWeight: 600 }}>
            | Module: {moduleName}
          </span>
        )}
        {typeof recordCount === "number" && (
          <span style={{ color: "#047857", fontWeight: 600 }}>
            | Records: {recordCount}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#64748b" }}>
        {user?.name && <span>User: {user.name}</span>}
      </div>
    </footer>
  );
}
