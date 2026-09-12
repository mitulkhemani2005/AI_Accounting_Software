"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  ClipboardCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Printer,
  Share2,
  Eye,
  Trash2,
  Lock,
  RefreshCw,
  IndianRupee,
  Calendar,
  User,
  Phone,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface BillItem {
  id: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  gst_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

interface Bill {
  id: string;
  bill_number: string;
  type: string;
  party_name: string;
  party_mobile?: string;
  party_gst?: string;
  is_interstate: boolean;
  created_by_user_id: string;
  creator_name?: string;
  creator_role?: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  round_off: number;
  total_amount: number;
  payment_mode: string;
  payment_status: string;
  paid_amount: number;
  status: string;
  is_reviewed_by_admin: boolean;
  notes?: string;
  created_at: string;
  items: BillItem[];
}

export default function StaffBillsReviewPage() {
  const { user, isAdmin } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"pending" | "all">("pending");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("paid");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchBills = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (filterMode === "pending") {
        const res = await api.get<Bill[]>("/bills/staff/review");
        setBills(res.data);
      } else {
        const res = await api.get<Bill[]>("/bills");
        setBills(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load staff bills:", err);
      setErrorMsg(err.response?.data?.detail || "Could not load staff bills queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBills();
    }
  }, [isAdmin, filterMode]);

  const openBillDetail = (bill: Bill) => {
    setSelectedBill(bill);
    setEditNotes(bill.notes || "");
    setEditPaymentStatus(bill.payment_status);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleApproveBill = async (billId: string) => {
    setActionLoading(true);
    try {
      await api.put(`/bills/${billId}`, {
        notes: editNotes,
        payment_status: editPaymentStatus,
      });
      setSuccessMsg("Bill reviewed and updated successfully!");
      fetchBills();
      setTimeout(() => setSelectedBill(null), 1200);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to update bill review status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidBill = async (billId: string) => {
    if (!confirm("Are you sure you want to void this bill? This action will mark it as void in audit logs.")) {
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(`/bills/${billId}`);
      setSuccessMsg("Bill voided successfully!");
      fetchBills();
      setTimeout(() => setSelectedBill(null), 1200);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to void bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async (billId: string, billNumber: string) => {
    try {
      const res = await api.get(`/bills/${billId}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${billNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download PDF invoice");
    }
  };

  const handleWhatsAppShare = async (billId: string) => {
    try {
      const res = await api.post(`/bills/${billId}/share-whatsapp`);
      if (res.data?.whatsapp_url) {
        window.open(res.data.whatsapp_url, "_blank");
      }
    } catch (err) {
      alert("Could not generate WhatsApp share link");
    }
  };

  // Filter bills
  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.party_mobile && b.party_mobile.includes(searchQuery)) ||
      (b.creator_name && b.creator_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || b.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = bills.filter((b) => !b.is_reviewed_by_admin).length;
  const totalAmount = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalOutstanding = bills.reduce(
    (sum, b) => sum + (b.total_amount - (b.paid_amount || 0)),
    0
  );

  if (!isAdmin) {
    return (
      <div>
        <div
          className="glass-panel"
          style={{
            padding: "36px",
            textAlign: "center",
            maxWidth: "600px",
            margin: "60px auto",
            borderLeft: "4px solid #ef4444",
          }}
        >
          <Lock size={48} color="#ef4444" style={{ margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>
            Admin Authorization Required
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            Under Indian SaaS Compliance and Store Security Rules, staff sub-users are restricted to bill creation only.
            Reviewing, editing, and voiding sales invoices is strictly reserved for store Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="badge badge-purple">Admin Control Panel</span>
            <span className="badge badge-blue">POS Counter Audit</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Staff Bills Review & Audit</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Inspect, approve, and verify bills created by store operators and counter staff.
          </p>
        </div>

        <button
          onClick={fetchBills}
          className="btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh Queue
        </button>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div className="glass-panel" style={{ padding: "18px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Pending Review</span>
            <Clock size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Sub-user bills awaiting sign-off
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Queue Bills</span>
            <FileText size={20} color="#3b82f6" />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{bills.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {filterMode === "pending" ? "In unreviewed queue" : "All tenant bills"}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px", borderLeft: "4px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Value</span>
            <IndianRupee size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#10b981" }}>
            ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Gross sale value
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Credit / Unpaid</span>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ef4444" }}>
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Khata outstanding balance
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "16px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: "1 1 300px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by Bill #, Customer name, Staff name or Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "rgba(30, 41, 59, 0.6)", borderRadius: "8px", padding: "3px" }}>
            <button
              onClick={() => setFilterMode("pending")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.825rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: filterMode === "pending" ? "#f59e0b" : "transparent",
                color: filterMode === "pending" ? "#000" : "var(--text-muted)",
              }}
            >
              Pending Review ({pendingCount})
            </button>
            <button
              onClick={() => setFilterMode("all")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.825rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: filterMode === "all" ? "var(--primary)" : "transparent",
                color: filterMode === "all" ? "#fff" : "var(--text-muted)",
              }}
            >
              All Bills
            </button>
          </div>

          {/* Payment filter */}
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "auto", fontSize: "0.85rem", padding: "8px 12px" }}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid / Credit</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="glass-panel" style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spin" style={{ display: "inline-block", marginBottom: "8px" }}>⏳</div>
            <div>Loading staff bills queue...</div>
          </div>
        ) : filteredBills.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>
              Queue is Clear!
            </h3>
            <p style={{ fontSize: "0.875rem" }}>
              {filterMode === "pending"
                ? "No unreviewed staff bills in queue. All counter sales are verified."
                : "No bills found matching current filter."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                <th style={{ padding: "14px 16px" }}>Bill No & Time</th>
                <th style={{ padding: "14px 16px" }}>Customer / Party</th>
                <th style={{ padding: "14px 16px" }}>Billed By</th>
                <th style={{ padding: "14px 16px" }}>Amount & Mode</th>
                <th style={{ padding: "14px 16px" }}>Payment</th>
                <th style={{ padding: "14px 16px" }}>Review Status</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => (
                <tr
                  key={bill.id}
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    transition: "background 0.15s ease",
                  }}
                  className="hover-row"
                >
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#f8fafc" }}>{bill.bill_number}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {new Date(bill.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{bill.party_name}</div>
                    {bill.party_mobile && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Phone size={12} /> {bill.party_mobile}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={14} color="#60a5fa" />
                      <span>{bill.creator_name || "Counter Staff"}</span>
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: "0.65rem", marginTop: "4px" }}>
                      {bill.creator_role || "sub_user"}
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#34d399", fontSize: "0.95rem" }}>
                      ₹{bill.total_amount.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {bill.payment_mode} &bull; GST ₹{bill.gst_amount.toFixed(2)}
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <span
                      className={`badge ${
                        bill.payment_status === "paid"
                          ? "badge-success"
                          : bill.payment_status === "partial"
                          ? "badge-purple"
                          : "badge-blue"
                      }`}
                      style={{ textTransform: "capitalize" }}
                    >
                      {bill.payment_status}
                    </span>
                    {bill.status === "void" && (
                      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", marginLeft: "4px" }}>
                        Voided
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    {bill.is_reviewed_by_admin ? (
                      <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={12} /> Approved
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> Pending Review
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openBillDetail(bill)}
                        className="btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                        title="Inspect & Review"
                      >
                        <Eye size={14} /> Review
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(bill.id, bill.bill_number)}
                        className="btn-secondary"
                        style={{ padding: "6px 8px" }}
                        title="Download Tax Invoice PDF"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => handleWhatsAppShare(bill.id)}
                        className="btn-secondary"
                        style={{ padding: "6px 8px" }}
                        title="WhatsApp Share"
                      >
                        <Share2 size={14} color="#25D366" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bill Review & Detail Modal */}
      {selectedBill && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              borderRadius: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="badge badge-blue">Tax Invoice Review</span>
                  <span className="badge badge-purple">{selectedBill.type.toUpperCase()}</span>
                </div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                  Invoice: {selectedBill.bill_number}
                </h2>
                <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                  Created on {new Date(selectedBill.created_at).toLocaleString("en-IN")} by{" "}
                  <strong>{selectedBill.creator_name || "Counter Staff"}</strong> ({selectedBill.creator_role || "sub_user"})
                </div>
              </div>

              <button
                onClick={() => setSelectedBill(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Alert messages */}
            {successMsg && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  marginBottom: "16px",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}
            {errorMsg && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  marginBottom: "16px",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            {/* Customer & Taxes Summary Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                background: "rgba(30, 41, 59, 0.4)",
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "20px",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Billed Customer
                </div>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc", marginTop: "2px" }}>
                  {selectedBill.party_name}
                </div>
                {selectedBill.party_mobile && <div>Phone: {selectedBill.party_mobile}</div>}
                {selectedBill.party_gst && <div>GSTIN: {selectedBill.party_gst}</div>}
              </div>

              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Tax Classification
                </div>
                <div style={{ fontWeight: 600, marginTop: "2px" }}>
                  {selectedBill.is_interstate ? "Inter-State (IGST Applied)" : "Intra-State (CGST + SGST Split)"}
                </div>
                <div>Mode: <strong style={{ textTransform: "uppercase" }}>{selectedBill.payment_mode}</strong></div>
                <div>Status: <strong style={{ textTransform: "capitalize" }}>{selectedBill.payment_status}</strong> (Paid ₹{selectedBill.paid_amount.toFixed(2)})</div>
              </div>
            </div>

            {/* Line Items Table */}
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "8px" }}>Line Items Breakdown</h4>
            <div style={{ overflowX: "auto", marginBottom: "20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.6)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px" }}>Item Description</th>
                    <th style={{ padding: "10px" }}>HSN</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Qty</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>GST %</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Taxable</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Tax Amt</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "10px", fontWeight: 500 }}>{item.item_name}</td>
                      <td style={{ padding: "10px", color: "var(--text-muted)" }}>{item.hsn_code || "—"}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {item.quantity} {item.unit}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{item.gst_rate}%</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>₹{item.taxable_amount.toFixed(2)}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        ₹{(item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>
                        ₹{item.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "320px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.85rem",
                  background: "rgba(30, 41, 59, 0.3)",
                  padding: "14px",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Subtotal:</span>
                  <span>₹{selectedBill.subtotal.toFixed(2)}</span>
                </div>
                {selectedBill.discount_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#34d399" }}>
                    <span>Discount:</span>
                    <span>-₹{selectedBill.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Taxable Amount:</span>
                  <span>₹{selectedBill.taxable_amount.toFixed(2)}</span>
                </div>
                {selectedBill.cgst_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>CGST:</span>
                    <span>₹{selectedBill.cgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedBill.sgst_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>SGST:</span>
                    <span>₹{selectedBill.sgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedBill.igst_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>IGST:</span>
                    <span>₹{selectedBill.igst_amount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "6px",
                    borderTop: "1px solid var(--border)",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "#f8fafc",
                  }}
                >
                  <span>Grand Total:</span>
                  <span style={{ color: "#34d399" }}>₹{selectedBill.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Admin Verification Controls */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h4 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={18} color="#34d399" /> Admin Audit & Correction
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Payment Status
                  </label>
                  <select
                    className="input-field"
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value)}
                  >
                    <option value="paid">Paid (Full Settlement)</option>
                    <option value="partial">Partial Payment</option>
                    <option value="unpaid">Unpaid / Khata Credit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Admin Review Note
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Verified counter sale / cash received..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleVoidBill(selectedBill.id)}
                  disabled={actionLoading || selectedBill.status === "void"}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    padding: "10px 18px",
                    fontWeight: 600,
                    cursor: selectedBill.status === "void" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={16} /> {selectedBill.status === "void" ? "Already Voided" : "Void Invoice"}
                </button>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number)}
                    className="btn-secondary"
                  >
                    <Printer size={16} /> Print Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveBill(selectedBill.id)}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ background: "#10b981", borderColor: "#059669" }}
                  >
                    <CheckCircle2 size={16} /> {selectedBill.is_reviewed_by_admin ? "Save Review Updates" : "Approve & Mark Verified"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
