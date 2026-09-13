"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Sparkles,
  Bot,
  TrendingUp,
  Package,
  Layers,
  Send,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Zap,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Flame,
  Info,
  Sliders,
  DollarSign,
  BarChart3,
  Calendar,
  Warehouse,
} from "lucide-react";
import { UpgradePaywall } from "@/components/UpgradePaywall";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  intent?: string;
  dataSummary?: Record<string, any>;
  suggestedActions?: string[];
  confidence?: number;
  timestamp: string;
}

interface RestockItem {
  item_id: string;
  item_name: string;
  category?: string;
  current_stock: number;
  avg_daily_sales: number;
  days_left: number;
  reorder_point: number;
  suggested_quantity: number;
  urgency: "CRITICAL" | "WARNING" | "HEALTHY";
  estimated_cost: number;
}

interface AssociationRule {
  antecedent_id: string;
  antecedent_name: string;
  consequent_id: string;
  consequent_name: string;
  support: number;
  confidence: number;
  lift: number;
  co_count?: number;
}

export default function AIDashboardPage() {
  const { tenant, isAdmin, entitlements } = useAuth();
  const isFreePlan = (tenant?.subscription_tier || "free").toLowerCase() === "free";
  const isLocked = isFreePlan && !entitlements.includes("ai_suggestions");

  const [activeTab, setActiveTab] = useState<"assistant" | "restock" | "basket">("assistant");

  // Chat Assistant State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      sender: "ai",
      text: "👋 **Hello! I'm your AI Business & Financial Intelligence Assistant.**\n\nI analyze your live transactions, catalog sales velocity, outstandings, and double-entry ledgers in real-time. Ask me anything about your revenue, GST liabilities, debtors, or restocking needs!",
      intent: "general_greeting",
      suggestedActions: [
        "What is our total sales revenue this month?",
        "Who are our top overdue debtors?",
        "Which items need urgent restocking?",
        "What is our net GST tax liability?",
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Restock State
  const [restockData, setRestockData] = useState<{
    total_items_analyzed: number;
    critical_count: number;
    warning_count: number;
    healthy_count: number;
    estimated_total_reorder_cost: number;
    suggestions: RestockItem[];
  } | null>(null);
  const [restockFilter, setRestockFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "HEALTHY">("ALL");
  const [isLoadingRestock, setIsLoadingRestock] = useState(false);

  // Basket Association Rules State
  const [rulesData, setRulesData] = useState<{
    total_rules: number;
    rules: AssociationRule[];
  } | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.1);
  const [isLoadingRules, setIsLoadingRules] = useState(false);

  // Batch Recompute State
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeNotice, setRecomputeNotice] = useState<string | null>(null);

  // Stock-In Quick Modal State
  const [quickStockItem, setQuickStockItem] = useState<RestockItem | null>(null);
  const [quickStockQty, setQuickStockQty] = useState<number>(0);
  const [isSubmittingStockIn, setIsSubmittingStockIn] = useState(false);
  const [stockInSuccess, setStockInSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAsking]);

  useEffect(() => {
    if (!isLocked) {
      if (activeTab === "restock") {
        fetchRestockForecast();
      } else if (activeTab === "basket") {
        fetchAssociationRules();
      }
    }
  }, [activeTab, isLocked, restockFilter, minConfidence]);

  const fetchRestockForecast = async () => {
    setIsLoadingRestock(true);
    try {
      const url =
        restockFilter === "ALL"
          ? "/api/v1/ai/restock-suggestions"
          : `/api/v1/ai/restock-suggestions?urgency=${restockFilter}`;
      const res = await api.get(url);
      setRestockData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch restock suggestions", err);
    } finally {
      setIsLoadingRestock(false);
    }
  };

  const fetchAssociationRules = async () => {
    setIsLoadingRules(true);
    try {
      const res = await api.get(`/api/v1/ai/association-rules?min_confidence=${minConfidence}`);
      setRulesData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch association rules", err);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const handleSendQuery = async (queryTextOverride?: string) => {
    const q = (queryTextOverride || inputQuery).trim();
    if (!q || isAsking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsAsking(true);

    try {
      const res = await api.post("/api/v1/ai/ask", { query: q });
      const aiResponse = res.data;

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiResponse.answer,
        intent: aiResponse.intent,
        dataSummary: aiResponse.data_summary,
        suggestedActions: aiResponse.suggested_actions || [],
        confidence: aiResponse.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ **Unable to process query:** ${err?.response?.data?.detail || "An error occurred while analyzing data."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleBatchRecompute = async () => {
    setIsRecomputing(true);
    setRecomputeNotice(null);
    try {
      const res = await api.post("/api/v1/ai/recompute-batch", {});
      setRecomputeNotice(`✨ ${res.data.message}`);
      if (activeTab === "restock") fetchRestockForecast();
      if (activeTab === "basket") fetchAssociationRules();
    } catch (err: any) {
      setRecomputeNotice(`⚠️ Recompute error: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsRecomputing(false);
      setTimeout(() => setRecomputeNotice(null), 7000);
    }
  };

  const handleQuickStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStockItem || quickStockQty <= 0) return;

    setIsSubmittingStockIn(true);
    setStockInSuccess(null);
    try {
      await api.post("/api/v1/inventory/stock-in", {
        items: [
          {
            item_id: quickStockItem.item_id,
            quantity: quickStockQty,
            purchase_price: quickStockItem.estimated_cost / (quickStockItem.suggested_quantity || 1),
          },
        ],
        notes: `AI Restock Automated Replenishment for ${quickStockItem.item_name}`,
      });
      setStockInSuccess(`✅ Successfully restocked ${quickStockQty} units of ${quickStockItem.item_name}!`);
      setTimeout(() => {
        setQuickStockItem(null);
        setStockInSuccess(null);
        fetchRestockForecast();
      }, 1500);
    } catch (err: any) {
      alert(`Failed to stock in: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmittingStockIn(false);
    }
  };

  if (isLocked) {
    return (
      <UpgradePaywall
        moduleName="AI Suggestions & Forecasting"
        title="Unlock Enterprise AI Intelligence Engine"
        subtitle="Upgrade to Enterprise Pro to access real-time market basket association rules, POS counter up-sells, predictive inventory restocking, and our Natural Language Financial Assistant."
        requiredPlan="Enterprise Pro"
        priceMonthly="₹999 / mo"
        features={[
          "Live POS Cross-Sell & Association Rule Chips with 1-click cart addition",
          "Automated Inventory Safety Stock & Daily Sales Velocity Forecasting",
          "Predictive Runout Alerts (Critical vs Warning vs Healthy)",
          "Conversational AI Financial Assistant (Sales, Debtors, GST, Cash & Bank)",
          "Nightly Automated Market Basket Rule Mining (Apriori Engine)",
        ]}
      />
    );
  }

  return (
    <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
              }}
            >
              <Sparkles size={22} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
              AI Intelligence Hub
            </h1>
            <span
              className="badge badge-purple"
              style={{
                fontSize: "0.7rem",
                padding: "3px 8px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Zap size={12} /> ENTERPRISE AI
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Real-time Apriori basket mining, predictive runout forecasting, and natural language business analytics.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleBatchRecompute}
            disabled={isRecomputing}
            className="btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              fontSize: "0.85rem",
              background: "rgba(139, 92, 246, 0.15)",
              borderColor: "rgba(139, 92, 246, 0.4)",
              color: "#c084fc",
            }}
          >
            <RefreshCw size={15} className={isRecomputing ? "spin" : ""} />
            <span>{isRecomputing ? "Training Models..." : "Train / Recompute Batch"}</span>
          </button>
        </div>
      </div>

      {/* Recompute Alert Banner */}
      {recomputeNotice && (
        <div
          className="glass-panel"
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            marginBottom: "20px",
            borderLeft: "4px solid #8b5cf6",
            background: "rgba(139, 92, 246, 0.1)",
            fontSize: "0.875rem",
            color: "#e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{recomputeNotice}</span>
          <button
            onClick={() => setRecomputeNotice(null)}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "12px",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("assistant")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: activeTab === "assistant" ? 700 : 500,
            background:
              activeTab === "assistant"
                ? "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.2))"
                : "transparent",
            color: activeTab === "assistant" ? "#ffffff" : "var(--text-muted)",
            border: activeTab === "assistant" ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Bot size={18} color={activeTab === "assistant" ? "#c084fc" : "#94a3b8"} />
          <span>AI Financial Assistant</span>
        </button>

        <button
          onClick={() => setActiveTab("restock")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: activeTab === "restock" ? 700 : 500,
            background:
              activeTab === "restock"
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.2))"
                : "transparent",
            color: activeTab === "restock" ? "#ffffff" : "var(--text-muted)",
            border: activeTab === "restock" ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={18} color={activeTab === "restock" ? "#fbbf24" : "#94a3b8"} />
          <span>Predictive Restock Forecast</span>
          {restockData?.critical_count ? (
            <span
              style={{
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "0.7rem",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              {restockData.critical_count}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("basket")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: activeTab === "basket" ? 700 : 500,
            background:
              activeTab === "basket"
                ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.2))"
                : "transparent",
            color: activeTab === "basket" ? "#ffffff" : "var(--text-muted)",
            border: activeTab === "basket" ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ShoppingBag size={18} color={activeTab === "basket" ? "#60a5fa" : "#94a3b8"} />
          <span>Market Basket & Co-Purchases</span>
          {rulesData?.total_rules ? (
            <span
              style={{
                background: "rgba(59, 130, 246, 0.3)",
                color: "#93c5fd",
                fontSize: "0.7rem",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              {rulesData.total_rules}
            </span>
          ) : null}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: AI FINANCIAL ASSISTANT (CONVERSATIONAL CHAT) */}
      {/* ===================================================================== */}
      {activeTab === "assistant" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
          {/* Main Chat Interface */}
          <div
            className="glass-panel"
            style={{
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              height: "640px",
              overflow: "hidden",
              border: "1px solid rgba(139, 92, 246, 0.25)",
            }}
          >
            {/* Chat Messages Log */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: m.sender === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "14px 18px",
                      borderRadius: m.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      background:
                        m.sender === "user"
                          ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                          : "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))",
                      border:
                        m.sender === "user"
                          ? "1px solid rgba(59, 130, 246, 0.5)"
                          : "1px solid rgba(139, 92, 246, 0.3)",
                      color: "#f8fafc",
                      fontSize: "0.925rem",
                      lineHeight: 1.6,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                  >
                    {/* Header with intent and confidence if AI */}
                    {m.sender === "ai" && m.intent && m.intent !== "general_greeting" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                          paddingBottom: "6px",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          fontSize: "0.75rem",
                        }}
                      >
                        <span style={{ color: "#c084fc", fontWeight: 700, textTransform: "uppercase" }}>
                          🧠 Intent: {m.intent.replace(/_/g, " ")}
                        </span>
                        {m.confidence && (
                          <span style={{ color: "#34d399", fontWeight: 600 }}>
                            {Math.round(m.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    )}

                    {/* Formatted Text */}
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {m.text.split("\n").map((line, i) => {
                        if (line.startsWith("### ")) {
                          return (
                            <h3 key={i} style={{ fontSize: "1.1rem", fontWeight: 700, margin: "8px 0 6px 0", color: "#60a5fa" }}>
                              {line.replace("### ", "")}
                            </h3>
                          );
                        }
                        if (line.startsWith("- ")) {
                          return (
                            <div key={i} style={{ paddingLeft: "8px", margin: "3px 0" }}>
                              • {line.substring(2)}
                            </div>
                          );
                        }
                        if (line.startsWith("> ")) {
                          return (
                            <blockquote
                              key={i}
                              style={{
                                borderLeft: "3px solid #8b5cf6",
                                paddingLeft: "10px",
                                margin: "8px 0",
                                color: "#cbd5e1",
                                fontStyle: "italic",
                                background: "rgba(139, 92, 246, 0.08)",
                                padding: "6px 10px",
                                borderRadius: "4px",
                              }}
                            >
                              {line.replace("> ", "")}
                            </blockquote>
                          );
                        }
                        return <p key={i} style={{ margin: "4px 0" }}>{line}</p>;
                      })}
                    </div>

                    {/* Suggested Action Chips */}
                    {m.suggestedActions && m.suggestedActions.length > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "10px",
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        {m.suggestedActions.map((action, actIdx) => (
                          <button
                            key={actIdx}
                            onClick={() => handleSendQuery(action)}
                            style={{
                              background: "rgba(139, 92, 246, 0.15)",
                              border: "1px solid rgba(139, 92, 246, 0.4)",
                              color: "#e2e8f0",
                              fontSize: "0.75rem",
                              padding: "4px 10px",
                              borderRadius: "14px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(139, 92, 246, 0.35)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
                            }}
                          >
                            <span>{action}</span>
                            <ChevronRight size={12} color="#c084fc" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                      marginRight: m.sender === "user" ? "4px" : "0",
                      marginLeft: m.sender === "ai" ? "4px" : "0",
                    }}
                  >
                    {m.timestamp}
                  </span>
                </div>
              ))}

              {isAsking && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", color: "#c084fc" }}>
                  <Loader2 size={18} className="spin" />
                  <span style={{ fontSize: "0.85rem" }}>Querying financial database & computing aggregates...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: "16px 20px",
                background: "rgba(15, 23, 42, 0.95)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Ask any financial, sales, inventory or GST question..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendQuery();
                }}
                disabled={isAsking}
                style={{
                  flex: 1,
                  background: "rgba(30, 41, 59, 0.7)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  color: "#ffffff",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
              <button
                onClick={() => handleSendQuery()}
                disabled={!inputQuery.trim() || isAsking}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 20px",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: inputQuery.trim() && !isAsking ? "pointer" : "not-allowed",
                  opacity: inputQuery.trim() && !isAsking ? 1 : 0.6,
                  boxShadow: "0 0 15px rgba(139, 92, 246, 0.3)",
                }}
              >
                <span>Ask</span>
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Right Sidebar: Sample Prompts & Capabilities */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#c084fc",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={14} /> Quick Financial Queries
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { text: "What is our total sales revenue this month?", label: "📊 Sales Summary" },
                  { text: "Who owes us money and has overdue debt?", label: "👥 Debtors Outstandings" },
                  { text: "Which items are running out of stock?", label: "📦 Inventory Runouts" },
                  { text: "What is our net GST tax liability?", label: "🏛️ GST Compliance" },
                  { text: "What is our cash and bank balance liquidity?", label: "💵 Liquid Capital" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendQuery(item.text)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(30, 41, 59, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      color: "#e2e8f0",
                      fontSize: "0.825rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                      e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.background = "rgba(30, 41, 59, 0.4)";
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#93c5fd", marginBottom: "2px" }}>{item.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>&ldquo;{item.text}&rdquo;</div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 27, 75, 0.4))",
                borderLeft: "3px solid #8b5cf6",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f8fafc", marginBottom: "4px" }}>
                🔒 Zero Data Hallucination Guarantee
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                Queries execute deterministic SQL aggregations across your isolated PostgreSQL tenant partition. No third-party training.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PREDICTIVE RESTOCK & RUNOUT FORECAST */}
      {/* ===================================================================== */}
      {activeTab === "restock" && (
        <div>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              className="glass-panel"
              style={{
                padding: "20px",
                borderRadius: "14px",
                borderLeft: "4px solid #ef4444",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(15, 23, 42, 0.6))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "#f87171" }}>
                  🚨 Critical Stockouts
                </span>
                <Flame size={18} color="#ef4444" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff" }}>
                {restockData?.critical_count ?? 0} items
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Stock &le; 0 or &le; 3 runout days
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: "20px",
                borderRadius: "14px",
                borderLeft: "4px solid #f59e0b",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(15, 23, 42, 0.6))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "#fbbf24" }}>
                  ⚠️ Low Stock Warnings
                </span>
                <AlertTriangle size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff" }}>
                {restockData?.warning_count ?? 0} items
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Stock below dynamic Reorder Point
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: "20px",
                borderRadius: "14px",
                borderLeft: "4px solid #10b981",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.6))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "#34d399" }}>
                  ✅ Healthy Stock
                </span>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff" }}>
                {restockData?.healthy_count ?? 0} items
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Adequate cover for &gt; 21 days
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: "20px",
                borderRadius: "14px",
                borderLeft: "4px solid #8b5cf6",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(15, 23, 42, 0.6))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "#c084fc" }}>
                  💰 Est. Reorder Investment
                </span>
                <DollarSign size={18} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff" }}>
                ₹{(restockData?.estimated_total_reorder_cost ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Recommended purchase order budget
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              {(["ALL", "CRITICAL", "WARNING", "HEALTHY"] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setRestockFilter(filterOpt)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "0.8rem",
                    fontWeight: restockFilter === filterOpt ? 700 : 500,
                    background:
                      restockFilter === filterOpt
                        ? filterOpt === "CRITICAL"
                          ? "rgba(239, 68, 68, 0.25)"
                          : filterOpt === "WARNING"
                          ? "rgba(245, 158, 11, 0.25)"
                          : filterOpt === "HEALTHY"
                          ? "rgba(16, 185, 129, 0.25)"
                          : "rgba(139, 92, 246, 0.25)"
                        : "rgba(30, 41, 59, 0.4)",
                    color:
                      restockFilter === filterOpt
                        ? filterOpt === "CRITICAL"
                          ? "#f87171"
                          : filterOpt === "WARNING"
                          ? "#fbbf24"
                          : filterOpt === "HEALTHY"
                          ? "#34d399"
                          : "#c084fc"
                        : "var(--text-muted)",
                    border:
                      restockFilter === filterOpt
                        ? "1px solid currentColor"
                        : "1px solid rgba(255, 255, 255, 0.05)",
                    cursor: "pointer",
                  }}
                >
                  {filterOpt === "ALL" ? "All Items" : filterOpt}
                </button>
              ))}
            </div>

            <button
              onClick={fetchRestockForecast}
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", padding: "6px 12px" }}
            >
              <RefreshCw size={13} className={isLoadingRestock ? "spin" : ""} /> Refresh Forecast
            </button>
          </div>

          {/* Restock Forecast Table */}
          <div className="glass-panel" style={{ borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(15, 23, 42, 0.8)",
                      borderBottom: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "14px 18px" }}>Item Name</th>
                    <th style={{ padding: "14px 18px" }}>Category</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Current Stock</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Daily Sales Velocity</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Runout Days</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Reorder Point</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Suggested Reorder</th>
                    <th style={{ padding: "14px 18px", textAlign: "center" }}>Urgency</th>
                    <th style={{ padding: "14px 18px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRestock ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                        <Loader2 size={24} className="spin" style={{ margin: "0 auto 10px auto" }} />
                        Analyzing inventory velocity and safety stocks...
                      </td>
                    </tr>
                  ) : !restockData || restockData.suggestions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                        🎉 No restock suggestions found for this filter.
                      </td>
                    </tr>
                  ) : (
                    restockData.suggestions.map((item) => (
                      <tr
                        key={item.item_id}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30, 41, 59, 0.3)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "14px 18px", fontWeight: 600, color: "#f8fafc" }}>
                          {item.item_name}
                        </td>
                        <td style={{ padding: "14px 18px", color: "var(--text-muted)" }}>
                          {item.category || "General"}
                        </td>
                        <td
                          style={{
                            padding: "14px 18px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: item.current_stock <= 0 ? "#ef4444" : "#f8fafc",
                          }}
                        >
                          {item.current_stock}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", color: "var(--text-muted)" }}>
                          {item.avg_daily_sales.toFixed(2)} units/day
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>
                          {item.days_left >= 999 ? (
                            <span style={{ color: "#34d399" }}>&gt; 90 days</span>
                          ) : (
                            <span
                              style={{
                                color: item.days_left <= 3 ? "#ef4444" : item.days_left <= 7 ? "#fbbf24" : "#34d399",
                              }}
                            >
                              {item.days_left.toFixed(1)} days
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", color: "var(--text-muted)" }}>
                          {item.reorder_point}
                        </td>
                        <td
                          style={{
                            padding: "14px 18px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: item.suggested_quantity > 0 ? "#60a5fa" : "var(--text-muted)",
                          }}
                        >
                          {item.suggested_quantity > 0 ? `+${item.suggested_quantity}` : "—"}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span
                            className={
                              item.urgency === "CRITICAL"
                                ? "badge badge-error"
                                : item.urgency === "WARNING"
                                ? "badge badge-warning"
                                : "badge badge-success"
                            }
                            style={{ fontSize: "0.7rem", padding: "2px 8px", fontWeight: 700 }}
                          >
                            {item.urgency}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          {item.suggested_quantity > 0 ? (
                            <button
                              onClick={() => {
                                setQuickStockItem(item);
                                setQuickStockQty(item.suggested_quantity);
                              }}
                              className="btn-primary"
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                borderRadius: "6px",
                                background: "linear-gradient(135deg, #10b981, #059669)",
                              }}
                            >
                              + Stock In
                            </button>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Optimal</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: MARKET BASKET ASSOCIATION RULES */}
      {/* ===================================================================== */}
      {activeTab === "basket" && (
        <div>
          {/* Controls Bar */}
          <div
            className="glass-panel"
            style={{
              padding: "18px 24px",
              borderRadius: "14px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8fafc", marginBottom: "4px" }}>
                🛒 Apriori Cross-Sell Engine
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Pairwise customer transaction co-occurrences. Higher lift ($&gt; 1.0$) indicates strong cross-selling affinity.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Min Confidence:</span>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  style={{ width: "100px", accentColor: "#8b5cf6" }}
                />
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#c084fc", minWidth: "36px" }}>
                  {Math.round(minConfidence * 100)}%
                </span>
              </div>

              <button
                onClick={fetchAssociationRules}
                className="btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", padding: "6px 12px" }}
              >
                <RefreshCw size={13} className={isLoadingRules ? "spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {/* Rules Grid */}
          {isLoadingRules ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
              <Loader2 size={28} className="spin" style={{ margin: "0 auto 12px auto" }} />
              Mining association rules from sales transaction baskets...
            </div>
          ) : !rulesData || rulesData.rules.length === 0 ? (
            <div className="glass-panel" style={{ padding: "50px", textAlign: "center", borderRadius: "14px" }}>
              <ShoppingBag size={40} color="#64748b" style={{ margin: "0 auto 12px auto" }} />
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "6px" }}>
                No Frequent Item Associations Found
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", maxWidth: "450px", margin: "0 auto 16px auto" }}>
                As customers purchase multiple items together on the POS screen, the Apriori engine automatically mines cross-sell patterns.
              </p>
              <button onClick={() => setMinConfidence(0.05)} className="btn-secondary" style={{ fontSize: "0.85rem" }}>
                Lower Confidence Threshold
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "16px",
              }}
            >
              {rulesData.rules.map((rule, rIdx) => (
                <div
                  key={rIdx}
                  className="glass-panel"
                  style={{
                    padding: "18px",
                    borderRadius: "14px",
                    border: "1px solid rgba(139, 92, 246, 0.2)",
                    background: "linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span className="badge badge-purple" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                        RULE #{rIdx + 1}
                      </span>
                      {rule.lift > 1.5 && (
                        <span className="badge badge-success" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                          🔥 High Affinity
                        </span>
                      )}
                    </div>

                    {/* Antecedent -> Consequent Flow */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "16px",
                        background: "rgba(15, 23, 42, 0.5)",
                        padding: "12px",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                          If customer buys
                        </div>
                        <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>
                          {rule.antecedent_name}
                        </div>
                      </div>

                      <ArrowRight size={18} color="#c084fc" style={{ flexShrink: 0 }} />

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Recommend
                        </div>
                        <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: "0.9rem" }}>
                          {rule.consequent_name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      paddingTop: "12px",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Confidence</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399" }}>
                        {Math.round(rule.confidence * 100)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Lift Factor</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#60a5fa" }}>
                        {rule.lift.toFixed(2)}x
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Support</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
                        {Math.round(rule.support * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* QUICK STOCK-IN MODAL */}
      {/* ===================================================================== */}
      {quickStockItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "480px",
              width: "100%",
              borderRadius: "16px",
              padding: "28px",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Package size={20} color="#34d399" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                  Quick Stock-In Order
                </h3>
              </div>
              <button
                onClick={() => setQuickStockItem(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            {stockInSuccess ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#34d399", fontSize: "0.95rem" }}>
                {stockInSuccess}
              </div>
            ) : (
              <form onSubmit={handleQuickStockInSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Selected Product:</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", marginTop: "2px" }}>
                    {quickStockItem.item_name}
                  </div>
                  <div style={{ display: "flex", gap: "14px", marginTop: "8px", fontSize: "0.775rem", color: "#94a3b8" }}>
                    <span>Current Stock: <strong>{quickStockItem.current_stock}</strong></span>
                    <span>Daily Velocity: <strong>{quickStockItem.avg_daily_sales}</strong></span>
                    <span>Reorder Point: <strong>{quickStockItem.reorder_point}</strong></span>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "6px" }}>
                    Restock Quantity to Add:
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quickStockQty}
                    onChange={(e) => setQuickStockQty(parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                      fontSize: "1rem",
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "#34d399", marginTop: "4px" }}>
                    AI Recommended Quantity: +{quickStockItem.suggested_quantity} units
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setQuickStockItem(null)}
                    className="btn-secondary"
                    style={{ padding: "8px 16px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStockIn || quickStockQty <= 0}
                    className="btn-primary"
                    style={{
                      padding: "8px 20px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {isSubmittingStockIn ? <Loader2 size={16} className="spin" /> : null}
                    <span>Confirm Stock-In</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
