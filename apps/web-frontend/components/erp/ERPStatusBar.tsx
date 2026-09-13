"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

export function ERPStatusBar() {
  const { user, tenant, isAdmin } = useAuth();

  const firmName = tenant?.business_name ? tenant.business_name.toUpperCase() : "KHEMANI BROTHERS";
  const tenantKey = tenant?.id ? `KEY : ${tenant.id.slice(0, 4)}--150` : "KEY : 0386--150";

  return (
    <div className="erp-statusbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontWeight: 700, color: "#120a42" }}>{firmName}</span>
        <span className="erp-statusbar-left">
          {tenantKey} ( DataPath : C:\FUNDWIN-KB\DATA\1001\20262027.MDB )
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "0.75rem", color: "#475569" }}>
          Active User: <strong>{user?.name || "ADMIN"}</strong> ({isAdmin ? "Store Admin" : "Counter Billing"})
        </span>
        <span className="erp-statusbar-right">This is a non-commercial session.</span>
      </div>
    </div>
  );
}
