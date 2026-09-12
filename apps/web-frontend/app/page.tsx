"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Receipt,
  Package,
  BookOpen,
  FileText,
  Sparkles,
  ShieldCheck,
  Activity,
  Server,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string>("Checking...");
  const [aiStatus, setAiStatus] = useState<string>("Checking...");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const aiUrl = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001";

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status === "healthy" ? "Healthy (ap-south-1)" : "Degraded"))
      .catch(() => setBackendStatus("Offline / Starting"));

    fetch(`${aiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setAiStatus(data.status === "healthy" ? "Healthy" : "Degraded"))
      .catch(() => setAiStatus("Offline / Starting"));
  }, [apiUrl, aiUrl]);

  const modules = [
    { name: "Billing & POS", icon: Receipt, price: "₹300/mo", desc: "Quick counter sale, GST invoices, barcode scanning, hold/resume bills" },
    { name: "Inventory Management", icon: Package, price: "₹400/mo", desc: "Multi-godown, batch & expiry tracking, low-stock automated alerts" },
    { name: "Double-Entry Accounting", icon: BookOpen, price: "₹600/mo", desc: "Auto journal entries, Day/Cash Book, Trial Balance, P&L, Balance Sheet" },
    { name: "Outstanding Reports", icon: FileText, price: "₹250/mo", desc: "Sundry debtors/creditors ageing (0-90+ days), WhatsApp due reminders" },
    { name: "AI Intelligence Layer", icon: Sparkles, price: "₹400/mo", desc: "Customer basket recommendations, restock velocity forecasting, NL queries" },
  ];

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Building2 color="#3b82f6" size={32} />
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              AI Accounting Software
            </h1>
            <span className="badge badge-blue">India Edition</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Modular Multi-Tenant SaaS &bull; GST-Compliant &bull; Double-Entry Backbone &bull; AI Forecasting
          </p>
        </div>

        {/* Auth CTA & Health Indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div className="glass-panel" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={16} color="#60a5fa" />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Backend:</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#34d399" }}>{backendStatus}</span>
          </div>
          <div className="glass-panel" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="#a855f7" />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>AI Service:</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#34d399" }}>{aiStatus}</span>
          </div>
          <Link href="/login" className="btn-secondary">
            Sign In
          </Link>
          <Link href="/signup" className="btn-primary">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Hero Architecture Card */}
      <div
        className="glass-panel"
        style={{
          padding: "36px",
          marginBottom: "36px",
          borderRadius: "16px",
          borderLeft: "5px solid #3b82f6",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "24px",
          }}
        >
          <div style={{ maxWidth: "680px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <span className="badge badge-success"><ShieldCheck size={14} /> Server-Side RBAC (Admin & Sub-user)</span>
              <span className="badge badge-blue"><Activity size={14} /> India Data Region (ap-south-1)</span>
            </div>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "12px", lineHeight: 1.3 }}>
              Enterprise-Grade Accounting & POS for Indian Small Businesses
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "20px" }}>
              Built from day one with strict tenant isolation, immutable audit logging, staff PIN logins with add-only billing restrictions, and full double-entry ledger architecture.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link href="/signup" className="btn-primary">
                Register Business <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn-secondary">
                Staff Quick POS Login
              </Link>
            </div>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "20px",
              borderRadius: "12px",
              minWidth: "260px",
              background: "rgba(15, 23, 42, 0.8)",
            }}
          >
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "12px", color: "#38bdf8" }}>
              Security & RBAC Rules
            </h4>
            <ul style={{ listStyle: "none", fontSize: "0.825rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} color="#34d399" /> Multi-tenant row scoping
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} color="#34d399" /> Sub-user add-only billing
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} color="#34d399" /> Edit/Delete 403 API blocking
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} color="#34d399" /> Immutable audit logging
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "18px" }}>
        Sellable Platform Modules
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {modules.map((m) => (
          <div
            key={m.name}
            className="glass-panel"
            style={{
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "rgba(37, 99, 235, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                <m.icon size={22} color="#60a5fa" />
              </div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "6px" }}>{m.name}</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.825rem", lineHeight: "1.4" }}>
                {m.desc}
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
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8" }}>{m.price}</span>
              <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>
                Entitlement Gated
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
