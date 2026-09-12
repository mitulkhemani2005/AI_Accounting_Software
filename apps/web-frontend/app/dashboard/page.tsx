"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  Package,
  BookOpen,
  FileText,
  Sparkles,
  Lock,
  ArrowRight,
  Plus,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, tenant, isAdmin, permissions, entitlements } = useAuth();
  const [tenantData, setTenantData] = useState<any>(null);

  useEffect(() => {
    if (isAdmin) {
      api.get("/tenants/me").then((res) => setTenantData(res.data)).catch(console.error);
    }
  }, [isAdmin]);

  const moduleCards = [
    {
      id: "billing_pos",
      name: "Billing & Point of Sale (POS)",
      icon: Receipt,
      desc: "Quick counter sale, barcode scanning, thermal print & GST invoices.",
      price: "₹300/mo",
      phase: "Phase 2",
    },
    {
      id: "inventory",
      name: "Inventory Management",
      icon: Package,
      desc: "Stock in/out, batch & expiry tracking, multi-godown, low stock alerts.",
      price: "₹400/mo",
      phase: "Phase 3",
    },
    {
      id: "accounting",
      name: "Double-Entry Accounting Engine",
      icon: BookOpen,
      desc: "Automatic journal entries, Day Book, Trial Balance, P&L, and Balance Sheet.",
      price: "₹600/mo",
      phase: "Phase 4",
    },
    {
      id: "outstanding_reports",
      name: "Outstanding & Ageing Reports",
      icon: FileText,
      desc: "Sundry Debtors & Creditors (0-90+ days ageing) & automated WhatsApp reminders.",
      price: "₹250/mo",
      phase: "Phase 5",
    },
    {
      id: "ai_suggestions",
      name: "AI Intelligence Layer",
      icon: Sparkles,
      desc: "Customer basket recommendations, restock velocity forecasting & NL queries.",
      price: "₹400/mo",
      phase: "Phase 7",
    },
  ];

  return (
    <div>
      {/* Welcome Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "28px",
          marginBottom: "32px",
          borderRadius: "14px",
          borderLeft: "4px solid #3b82f6",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="badge badge-blue">Multi-Tenant Cloud</span>
              <span className="badge badge-success">India (ap-south-1)</span>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
              Welcome back, {user?.name}!
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "650px", lineHeight: 1.5 }}>
              Business: <strong style={{ color: "#f8fafc" }}>{tenant?.business_name}</strong> &bull;{" "}
              Role:{" "}
              <span style={{ color: isAdmin ? "#34d399" : "#60a5fa", fontWeight: 600 }}>
                {isAdmin ? "Admin (Store Owner)" : "Sub-user (Staff Counter Billing)"}
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/dashboard/pos" className="btn-primary" style={{ background: "#10b981", borderColor: "#059669" }}>
              <Receipt size={16} /> Open POS Counter
            </Link>
            {isAdmin && (
              <>
                <Link href="/dashboard/items" className="btn-secondary">
                  <Package size={16} /> Product Master
                </Link>
                <Link href="/dashboard/staff" className="btn-secondary">
                  <Plus size={16} /> Manage Staff
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Security & Access Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "36px",
        }}
      >
        {/* Role & Permissions Card */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <ShieldCheck size={22} color="#38bdf8" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Active Role & Permissions</h3>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
            Server-side enforced permissions for current user session:
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {permissions.map((p) => (
              <span key={p} className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Tenant Details Card */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <Building2 size={22} color="#34d399" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Business Profile</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Tenant ID:</span>
              <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{tenant?.id?.slice(0, 12)}...</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>GST Number:</span>
              <span>{tenant?.gst_number || "Not Registered"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Subscription:</span>
              <span className="badge badge-success" style={{ textTransform: "capitalize" }}>
                {tenant?.subscription_tier?.replace("_", " ") || "Trial"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modular Platform Entitlements */}
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px" }}>
        Purchased & Active Modules
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {moduleCards.map((mod) => {
          const isEntitled = entitlements.includes(mod.id);

          return (
            <div
              key={mod.id}
              className="glass-panel"
              style={{
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderTop: isEntitled ? "3px solid #3b82f6" : "3px solid #64748b",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "8px",
                      background: isEntitled ? "rgba(37, 99, 235, 0.2)" : "rgba(100, 116, 139, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <mod.icon size={20} color={isEntitled ? "#60a5fa" : "#94a3b8"} />
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>
                    {mod.phase}
                  </span>
                </div>

                <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "6px" }}>
                  {mod.name}
                </h4>
                <p style={{ color: "var(--text-muted)", fontSize: "0.825rem", lineHeight: 1.4 }}>
                  {mod.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#38bdf8" }}>
                  {mod.price}
                </span>
                <span className="badge badge-success">
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
