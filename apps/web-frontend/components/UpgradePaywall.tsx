"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
  CreditCard,
} from "lucide-react";

interface UpgradePaywallProps {
  moduleName?: string;
  title: string;
  subtitle?: string;
  requiredPlan?: "Standard Business" | "Enterprise Pro";
  priceMonthly?: string;
  features?: string[];
}

export function UpgradePaywall({
  moduleName = "Accounting Books",
  title,
  subtitle,
  requiredPlan = "Enterprise Pro",
  priceMonthly = "₹999 / mo",
  features = [
    "Full Double-Entry Chart of Accounts & Journal Vouchers",
    "Automated Trial Balance, Profit & Loss & Balance Sheet",
    "GSTR-1 & GSTR-3B Export-Ready Returns & E-Invoicing (IRN)",
    "WhatsApp Automated Payment Reminders & Multi-Godown Transfers",
    "Multi-User Staff Role Management & PIN Auth",
  ],
}: UpgradePaywallProps) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        minHeight: "70vh",
        background: "#ffffff",
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "680px",
          width: "100%",
          padding: "40px",
          borderRadius: "16px",
          border: "2px solid #fcd34d",
          background: "#ffffff",
          boxShadow: "0 4px 24px rgba(245, 158, 11, 0.12), 0 1px 4px rgba(0,0,0,0.06)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #f59e0b, #d97706)",
          }}
        />

        {/* Lock Icon Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#fef3c7",
            border: "2px solid #fcd34d",
            marginBottom: "20px",
          }}
        >
          <Lock size={30} color="#d97706" />
        </div>

        {/* Plan Level Badge */}
        <div style={{ marginBottom: "12px" }}>
          <span
            className="badge badge-warning"
            style={{
              fontSize: "0.8rem",
              padding: "4px 12px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            🔒 {requiredPlan} Required
          </span>
        </div>

        {/* Heading */}
        <h2
          style={{
            fontSize: "1.85rem",
            fontWeight: 800,
            color: "#0f172a",
            marginBottom: "10px",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            color: "#64748b",
            fontSize: "0.95rem",
            maxWidth: "520px",
            margin: "0 auto 24px auto",
            lineHeight: 1.5,
          }}
        >
          {subtitle ||
            `This module is restricted on your current Free Tier. Upgrade to the ${requiredPlan} to unlock full access instantly.`}
        </p>

        {/* Feature List Card */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "left",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#d97706",
              letterSpacing: "0.05em",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={14} color="#d97706" /> What you unlock:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {features.map((feat, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  fontSize: "0.875rem",
                  color: "#1e293b",
                }}
              >
                <CheckCircle2 size={16} color="#059669" style={{ marginTop: "2px", flexShrink: 0 }} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing & CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {priceMonthly}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              (Billed Monthly or Annually with ~17% OFF)
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => router.push("/dashboard/subscription")}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                fontSize: "1rem",
                fontWeight: 700,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)",
              }}
            >
              <Zap size={18} fill="#ffffff" />
              <span>Upgrade Plan & Unlock Now</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => router.push("/dashboard/subscription")}
              className="btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                fontSize: "0.9rem",
              }}
            >
              <CreditCard size={16} />
              <span>View All Plans</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
