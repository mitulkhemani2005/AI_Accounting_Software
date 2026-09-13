"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  Layers,
  Clock,
  ChevronRight,
  RefreshCw,
  Loader2,
  Check,
  X,
  HelpCircle,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";

export default function SubscriptionPage() {
  const { user, tenant, isAdmin, refreshProfile } = useAuth();

  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plansRes, usageRes] = await Promise.all([
        api.get("/subscriptions/plans"),
        api.get("/subscriptions/usage"),
      ]);
      setPlans(plansRes.data.plans || []);
      setUsage(usageRes.data);
    } catch (err: any) {
      console.error("Failed to load subscription data:", err);
      setActionError(err.response?.data?.detail || "Failed to load subscription details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;
    setUpgradingPlanId(planId);
    setActionError(null);

    try {
      // 1. Create Razorpay Order
      const orderRes = await api.post("/subscriptions/create-order", {
        plan_id: planId,
        billing_cycle: billingCycle,
      });
      const orderData = orderRes.data;

      // 2. Mock / Production Razorpay Checkout Integration
      // If Razorpay SDK is not loaded in window, perform standard test/sandbox auto-verification
      if (typeof window !== "undefined" && !(window as any).Razorpay) {
        // Direct Sandbox Verification
        const verifyRes = await api.post("/subscriptions/verify-payment", {
          razorpay_order_id: orderData.order_id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: "test_sig",
          plan_id: planId,
          billing_cycle: billingCycle,
        });

        setActionSuccess(verifyRes.data.message);
        await loadData();
        if (refreshProfile) await refreshProfile();
      } else {
        // Live Razorpay Modal
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "AI Accounting Software",
          description: `Subscription: ${orderData.plan_name} (${billingCycle})`,
          order_id: orderData.order_id,
          handler: async function (response: any) {
            try {
              const verifyRes = await api.post("/subscriptions/verify-payment", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId,
                billing_cycle: billingCycle,
              });
              setActionSuccess(verifyRes.data.message);
              await loadData();
              if (refreshProfile) await refreshProfile();
            } catch (vErr: any) {
              setActionError(vErr.response?.data?.detail || "Payment verification failed");
            }
          },
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: user?.mobile_number || "",
          },
          theme: {
            color: "#2563eb",
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setActionError(err.response?.data?.detail || "Failed to initiate subscription order");
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const isCurrentPlan = (planId: string) => {
    return usage?.subscription_tier?.toLowerCase() === planId.toLowerCase();
  };

  const usagePercent =
    usage?.bills_limit && usage?.bills_this_month
      ? Math.min(100, Math.round((usage.bills_this_month / usage.bills_limit) * 100))
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Header & Breadcrumbs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "4px" }}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span style={{ color: "#0f172a", fontWeight: 500 }}>Subscription & Plans</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Subscription & Entitlements
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "4px 0 0 0" }}>
            Manage organization tier, monthly bill limits, module entitlements, and billing cycles.
          </p>
        </div>

        <button
          onClick={loadData}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="glass-panel" style={{ padding: "14px 18px", borderRadius: "10px", borderLeft: "4px solid #10b981", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", gap: "10px", color: "#10b981" }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="glass-panel" style={{ padding: "14px 18px", borderRadius: "10px", borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", gap: "10px", color: "#ef4444" }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionError}</span>
        </div>
      )}

      {/* 2. Current Plan Hero Card */}
      {usage && (
        <div
          className="glass-panel"
          style={{
            padding: "24px",
            borderRadius: "14px",
            background: "#f8fafc",
            border: "1px solid #bfdbfe",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="badge badge-purple" style={{ textTransform: "uppercase", fontSize: "0.75rem", padding: "4px 10px" }}>
                Current Active Plan
              </span>
              <span
                style={{
                  color: usage.is_active ? "#10b981" : "#ef4444",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ● {usage.is_active ? "Active" : "Suspended"}
              </span>
            </div>

            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "8px", textTransform: "capitalize" }}>
              {usage.subscription_tier.replace(/_/g, " ")} Plan
            </div>

            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              Organization: <strong>{usage.business_name}</strong> • Current Cycle: {usage.billing_cycle_start} to {usage.billing_cycle_end}
            </div>
          </div>

          {/* Usage Progress Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-muted)" }}>Monthly Bill Consumption:</span>
              <span style={{ fontWeight: 700, color: usage.is_limit_reached ? "#ef4444" : "#f8fafc" }}>
                {usage.bills_this_month} {usage.bills_limit ? `/ ${usage.bills_limit} Bills` : "Bills (Unlimited)"}
              </span>
            </div>

            {usage.bills_limit ? (
              <div>
                <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${usagePercent}%`,
                      height: "100%",
                      background: usagePercent >= 90 ? "#ef4444" : usagePercent >= 70 ? "#f59e0b" : "#3b82f6",
                      borderRadius: "999px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  {usage.is_limit_reached
                    ? "⚠️ Limit reached! Upgrade plan to continue issuing bills."
                    : `${usage.bills_limit - usage.bills_this_month} bill(s) remaining this month`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 600 }}>
                ✨ Unlimited Invoicing & POS Counter Billing Unlocked
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Billing Cycle Selector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            display: "inline-flex",
            background: "#f8fafc",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => setBillingCycle("monthly")}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: billingCycle === "monthly" ? 600 : 500,
              color: billingCycle === "monthly" ? "#ffffff" : "var(--text-muted)",
              background: billingCycle === "monthly" ? "#2563eb" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: billingCycle === "yearly" ? 600 : 500,
              color: billingCycle === "yearly" ? "#ffffff" : "var(--text-muted)",
              background: billingCycle === "yearly" ? "#2563eb" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>Annual Billing</span>
            <span style={{ fontSize: "0.7rem", background: "#10b981", color: "#000", padding: "1px 6px", borderRadius: "999px", fontWeight: 700 }}>
              SAVE ~17%
            </span>
          </button>
        </div>
      </div>

      {/* 4. Pricing Plans Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(plan.id);
          const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;

          return (
            <div
              key={plan.id}
              className="glass-panel"
              style={{
                padding: "28px",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "24px",
                position: "relative",
                border: plan.is_popular
                  ? "2px solid #3b82f6"
                  : isCurrent
                  ? "2px solid #10b981"
                  : "1px solid var(--border)",
                background: plan.is_popular
                  ? "linear-gradient(180deg, #eff6ff, #ffffff)"
                  : "#ffffff",
              }}
            >
              {plan.is_popular && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    right: "24px",
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "999px",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              {isCurrent && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "24px",
                    background: "#10b981",
                    color: "#000000",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "999px",
                  }}
                >
                  YOUR PLAN
                </div>
              )}

              <div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  {plan.name}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.825rem", margin: "6px 0 16px 0", minHeight: "36px" }}>
                  {plan.tagline}
                </p>

                {/* Price Display */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
                    ₹{price.toLocaleString("en-IN")}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    /{billingCycle === "yearly" ? "year" : "month"}
                  </span>
                </div>

                {/* Features List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                  {plan.features.map((f: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.85rem" }}>
                      {f.included ? (
                        <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                      ) : (
                        <X size={16} color="#64748b" style={{ flexShrink: 0, marginTop: "2px" }} />
                      )}
                      <span style={{ color: f.included ? "#1e293b" : "#94a3b8" }}>
                        {f.name}
                        {f.highlight && (
                          <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#2563eb", fontWeight: 600 }}>
                            ({f.highlight})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isCurrent ? (
                  <button
                    disabled
                    className="btn btn-secondary"
                    style={{ width: "100%", cursor: "default", opacity: 0.8 }}
                  >
                    Current Active Plan
                  </button>
                ) : plan.id === "free" ? (
                  <button
                    disabled
                    className="btn btn-secondary"
                    style={{ width: "100%", opacity: 0.6 }}
                  >
                    Default Free Tier
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgradingPlanId === plan.id}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "12px",
                      fontSize: "0.95rem",
                    }}
                  >
                    {upgradingPlanId === plan.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span>Upgrade with Razorpay</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
