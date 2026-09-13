"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Zap,
  CreditCard,
  Building,
  TrendingUp,
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
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "680px",
          width: "100%",
          padding: "40px",
          borderRadius: "16px",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          background: "linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.8) 100%)",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.15)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow Top Accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            height: "4px",
            background: "linear-gradient(90deg, transparent, #f59e0b, #ec4899, transparent)",
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
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            marginBottom: "20px",
            boxShadow: "0 0 20px rgba(245, 158, 11, 0.3)",
          }}
        >
          <Lock size={30} color="#fbbf24" />
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
            color: "#f8fafc",
            marginBottom: "10px",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            color: "#94a3b8",
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
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
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
              color: "#fbbf24",
              letterSpacing: "0.05em",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={14} color="#fbbf24" /> What you unlock:
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
                  color: "#e2e8f0",
                }}
              >
                <CheckCircle2 size={16} color="#34d399" style={{ marginTop: "2px", flexShrink: 0 }} />
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
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#f8fafc" }}>
              {priceMonthly}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
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
                boxShadow: "0 4px 15px rgba(245, 158, 11, 0.4)",
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
