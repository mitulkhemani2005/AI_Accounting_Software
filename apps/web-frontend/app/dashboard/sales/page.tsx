"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ShoppingBag,
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
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
  Plus,
  FileText,
  Clock,
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  Loader2,
  X,
} from "lucide-react";

interface BillItem {
  id: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  rate: number;
  purchase_price?: number;
  discount_amount: number;
  gst_rate: number;
  is_tax_inclusive?: boolean;
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

export default function SalesPage() {
  const { user, tenant, isAdmin } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchBills = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.get<Bill[]>("/bills", {
        params: {
          bill_type: "sale",
          payment_status: paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
          search: searchQuery.trim() || undefined,
        },
      });
      setBills(res.data);
    } catch (err: any) {
      console.error("Failed to load sales bills:", err);
      setErrorMsg(err.response?.data?.detail || "Could not load sales bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [paymentStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  const handleDownloadPdf = async (billId: string, billNumber: string) => {
    setIsDownloadingPdf(true);
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
    } finally {
      setIsDownloadingPdf(false);
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

  const handlePrintReceipt = (bill: Bill) => {
    setSelectedBill(bill);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleVoidBill = async (billId: string) => {
    if (!confirm("Are you sure you want to void this sales bill? This action will mark it as void in audit logs.")) {
      return;
    }
    setIsVoiding(true);
    try {
      await api.delete(`/bills/${billId}`);
      setSuccessMsg("Bill voided successfully!");
      fetchBills();
      if (selectedBill?.id === billId) {
        setSelectedBill(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to void bill");
    } finally {
      setIsVoiding(false);
    }
  };

  // Filter bills
  const filteredBills = bills.filter((b) => {
    const matchesMode = paymentModeFilter === "all" || b.payment_mode === paymentModeFilter;
    const matchesSearch =
      !searchQuery ||
      b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.party_mobile && b.party_mobile.includes(searchQuery)) ||
      (b.creator_name && b.creator_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesMode && matchesSearch;
  });

  // Calculate Metrics
  const totalSalesRevenue = bills.filter((b) => b.status !== "void").reduce((sum, b) => sum + b.total_amount, 0);
  const totalGstCollected = bills.filter((b) => b.status !== "void").reduce((sum, b) => sum + b.gst_amount, 0);
  const cashSales = bills.filter((b) => b.status !== "void" && b.payment_mode === "cash").reduce((sum, b) => sum + b.total_amount, 0);
  const upiSales = bills.filter((b) => b.status !== "void" && b.payment_mode === "upi").reduce((sum, b) => sum + b.total_amount, 0);
  const creditOutstanding = bills
    .filter((b) => b.status !== "void" && (b.payment_mode === "credit" || b.payment_status in ["unpaid", "partial"]))
    .reduce((sum, b) => sum + (b.total_amount - b.paid_amount), 0);

  return (
    <>
      <div className="no-print">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="badge badge-blue">Sales Register</span>
              <span className="badge badge-success">All Store Invoices</span>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Sales & Invoices Directory</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Comprehensive real-time register of all counter sales and customer tax invoices.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={fetchBills}
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
            </button>
            <Link href="/dashboard/pos" className="btn-primary" style={{ background: "#10b981", borderColor: "#059669" }}>
              <Plus size={16} /> New Counter Sale (POS)
            </Link>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {successMsg && (
          <div className="badge badge-success" style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", display: "block" }}>
            {successMsg}
          </div>
        )}

        {/* KPI Metrics Summary Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #10b981" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Sales (Active)</span>
              <IndianRupee size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#10b981" }}>
              ₹{totalSalesRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              {bills.filter((b) => b.status !== "void").length} completed sales bills
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #3b82f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total GST Collected</span>
              <FileText size={18} color="#3b82f6" />
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8" }}>
              ₹{totalGstCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              CGST + SGST + IGST
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #8b5cf6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Cash vs UPI Split</span>
              <QrCode size={18} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Cash: ₹{cashSales.toFixed(0)} | UPI: ₹{upiSales.toFixed(0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Immediate settlements
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #ef4444" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Khata / Udhaar Due</span>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444" }}>
              ₹{creditOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Customer credit balance
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          className="glass-panel"
          style={{
            padding: "16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px", flex: "1 1 320px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={18}
                color="var(--text-muted)"
                style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Search by Bill #, Customer Name, Phone, or Staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "38px" }}
              />
            </div>
            <button type="submit" className="btn-secondary">
              Search
            </button>
          </form>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Payment Status Filter */}
            <select
              className="input-field"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.85rem", padding: "8px 12px" }}
            >
              <option value="all">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid / Khata Credit</option>
            </select>

            {/* Payment Mode Filter */}
            <select
              className="input-field"
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.85rem", padding: "8px 12px" }}
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI / QR</option>
              <option value="card">Card</option>
              <option value="credit">Khata (Credit)</option>
            </select>
          </div>
        </div>

        {/* Bills Table */}
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
              <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
              <div>Loading sales invoices register...</div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
              <Receipt size={42} color="#64748b" style={{ margin: "0 auto 12px auto" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>
                No Sales Bills Found
              </h3>
              <p style={{ fontSize: "0.875rem", marginBottom: "16px" }}>
                Create your first counter sale using the button below.
              </p>
              <Link href="/dashboard/pos" className="btn-primary">
                <Plus size={16} /> Create Sale Bill (POS)
              </Link>
            </div>
          ) : (
            <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Invoice No & Date</th>
                  <th>Customer / Party</th>
                  <th>Billed By</th>
                  <th>Mode & Status</th>
                  <th>Taxable Base</th>
                  <th>GST Amount</th>
                  <th>Grand Total</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr key={bill.id} style={{ opacity: bill.status === "void" ? 0.6 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Receipt size={14} color="#38bdf8" />
                        <span>{bill.bill_number}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Calendar size={12} />
                        {new Date(bill.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{bill.party_name}</div>
                      {bill.party_mobile && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={12} /> {bill.party_mobile}
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={13} color="#60a5fa" />
                        <span>{bill.creator_name || "Counter Staff"}</span>
                      </div>
                      <span className="badge badge-blue" style={{ fontSize: "0.65rem", marginTop: "2px" }}>
                        {bill.creator_role || "staff"}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="badge" style={{ background: "rgba(30, 41, 59, 0.7)", textTransform: "uppercase", fontSize: "0.7rem" }}>
                          {bill.payment_mode}
                        </span>
                        <span
                          className={`badge ${
                            bill.payment_status === "paid"
                              ? "badge-success"
                              : bill.payment_status === "partial"
                              ? "badge-purple"
                              : "badge-danger"
                          }`}
                          style={{ textTransform: "capitalize", fontSize: "0.7rem" }}
                        >
                          {bill.payment_status}
                        </span>
                      </div>
                      {bill.status === "void" && (
                        <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", fontSize: "0.65rem", marginTop: "2px", display: "inline-block" }}>
                          Voided
                        </span>
                      )}
                    </td>

                    <td style={{ color: "var(--text-muted)" }}>
                      ₹{bill.taxable_amount.toFixed(2)}
                    </td>

                    <td style={{ color: "#38bdf8" }}>
                      ₹{bill.gst_amount.toFixed(2)}
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {bill.is_interstate ? "IGST" : "CGST+SGST"}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#34d399" }}>
                        ₹{bill.total_amount.toFixed(2)}
                      </div>
                      {bill.discount_amount > 0 && (
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          Disc: -₹{bill.discount_amount.toFixed(2)}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                          title="View Invoice Details"
                        >
                          <Eye size={14} /> View
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
                          title="Share on WhatsApp"
                        >
                          <Share2 size={14} color="#25D366" />
                        </button>
                        {isAdmin && bill.status !== "void" && (
                          <button
                            onClick={() => handleVoidBill(bill.id)}
                            className="btn-secondary"
                            style={{ padding: "6px 8px", color: "#ef4444" }}
                            title="Void Bill"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full Invoice Details Modal */}
      {selectedBill && (
        <div className="modal-overlay no-print" onClick={() => setSelectedBill(null)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", padding: "28px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="badge badge-blue">TAX INVOICE</span>
                  <span className="badge badge-purple">{selectedBill.type.toUpperCase()}</span>
                  {selectedBill.status === "void" && (
                    <span className="badge badge-danger">VOIDED</span>
                  )}
                </div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                  Invoice: {selectedBill.bill_number}
                </h2>
                <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                  Date: {new Date(selectedBill.created_at).toLocaleString("en-IN")} &bull; Billed by: <strong>{selectedBill.creator_name || "Counter Staff"}</strong>
                </div>
              </div>

              <button onClick={() => setSelectedBill(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Customer & Place of Supply */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", background: "rgba(30, 41, 59, 0.4)", padding: "14px", borderRadius: "8px", marginBottom: "18px", fontSize: "0.85rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Customer Details</div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#f8fafc", marginTop: "2px" }}>{selectedBill.party_name}</div>
                {selectedBill.party_mobile && <div>Phone: {selectedBill.party_mobile}</div>}
                {selectedBill.party_gst && <div>GSTIN: {selectedBill.party_gst}</div>}
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Payment & Tax Supply</div>
                <div>Payment Mode: <strong style={{ textTransform: "uppercase" }}>{selectedBill.payment_mode}</strong></div>
                <div>Payment Status: <strong style={{ textTransform: "capitalize" }}>{selectedBill.payment_status}</strong> (Paid ₹{selectedBill.paid_amount.toFixed(2)})</div>
                <div>Place of Supply: <strong>{selectedBill.is_interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong></div>
              </div>
            </div>

            {/* Line Items Table */}
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "8px" }}>Line Items Breakdown</h4>
            <div style={{ overflowX: "auto", marginBottom: "18px" }}>
              <table className="custom-table" style={{ fontSize: "0.825rem" }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>HSN</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Selling Price</th>
                    {isAdmin && <th style={{ textAlign: "right" }}>Cost Price</th>}
                    <th style={{ textAlign: "right" }}>GST %</th>
                    <th style={{ textAlign: "right" }}>Taxable</th>
                    <th style={{ textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items?.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>
                        {item.item_name}
                        {item.is_tax_inclusive && (
                          <span style={{ fontSize: "0.7rem", color: "#60a5fa", marginLeft: "6px" }}>(Tax Incl.)</span>
                        )}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{item.hsn_code || "—"}</td>
                      <td style={{ textAlign: "right" }}>{item.quantity} {item.unit}</td>
                      <td style={{ textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                      {isAdmin && (
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                          ₹{(item.purchase_price || 0).toFixed(2)}
                        </td>
                      )}
                      <td style={{ textAlign: "right" }}>{item.gst_rate}%</td>
                      <td style={{ textAlign: "right" }}>₹{item.taxable_amount.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#34d399" }}>₹{item.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
              <div style={{ width: "300px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", background: "rgba(30, 41, 59, 0.4)", padding: "12px", borderRadius: "8px" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid var(--border)", fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
                  <span>Grand Total:</span>
                  <span style={{ color: "#34d399" }}>₹{selectedBill.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                {isAdmin && selectedBill.status !== "void" && (
                  <button
                    onClick={() => handleVoidBill(selectedBill.id)}
                    disabled={isVoiding}
                    className="btn-danger"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Trash2 size={16} /> Void Invoice
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(selectedBill)}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Printer size={16} /> Print Thermal Receipt
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number)}
                  disabled={isDownloadingPdf}
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {isDownloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />} Download A4 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE THERMAL RECEIPT CONTAINER (Activated only on window.print) */}
      {selectedBill && (
        <div className="print-only" style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px", width: "300px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
            <h3 style={{ fontSize: "16px", margin: 0 }}>{tenant?.business_name || "RETAIL STORE"}</h3>
            {tenant?.gst_number && <div>GSTIN: {tenant.gst_number}</div>}
            <div>TAX INVOICE</div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
            <div>Inv #: {selectedBill.bill_number}</div>
            <div>Date: {new Date(selectedBill.created_at).toLocaleString("en-IN")}</div>
            <div>Cust: {selectedBill.party_name}</div>
            {selectedBill.party_mobile && <div>Phone: {selectedBill.party_mobile}</div>}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000", textAlign: "left" }}>
                <th>Item</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Rate</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(selectedBill.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.item_name}</td>
                  <td style={{ textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                  <td style={{ textAlign: "right" }}>₹{item.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal:</span>
              <span>₹{selectedBill.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>GST Total:</span>
              <span>₹{selectedBill.gst_amount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", borderTop: "1px solid #000", paddingTop: "4px" }}>
              <span>Grand Total:</span>
              <span>₹{selectedBill.total_amount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Payment Mode:</span>
              <span style={{ textTransform: "uppercase" }}>{selectedBill.payment_mode}</span>
            </div>
          </div>

          <div style={{ textAlign: "center", borderTop: "1px dashed #000", marginTop: "10px", paddingTop: "8px" }}>
            Thank you for shopping with us!
          </div>
        </div>
      )}
    </>
  );
}
