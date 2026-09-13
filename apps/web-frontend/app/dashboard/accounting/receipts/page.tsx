"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit2,
  Trash2,
  Printer,
  RefreshCw,
  X,
  Search,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Building2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { FundSafeStatusBar } from "@/components/FundSafeStatusBar";

interface ReceiptVoucher {
  id: string;
  vouNo: string;
  vouType: string;
  date: string;
  recNo: string;
  accountName: string;
  place: string;
  amount: number;
  grAmount: number;
  discRd: number;
  totalAmount: number;
  billAdjust: string;
  narration?: string;
}

export default function ReceiptVoucherPage() {
  const { tenant } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<ReceiptVoucher[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [seriesFilter, setSeriesFilter] = useState("RECEIPT");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: "",
    debitAccount: "cash",
    place: "UJJAIN",
    amount: "",
    discRd: "0",
    recNo: "0",
    date: new Date().toISOString().split("T")[0],
    billAdjust: "BILLBYBILL",
    notes: "",
  });

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const [payRes, custRes] = await Promise.all([
        api.get("/parties/payments?payment_type=payment_in"),
        api.get("/parties/customers"),
      ]);

      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);

      const liveList = Array.isArray(payRes.data) ? payRes.data : [];

      const formatted: ReceiptVoucher[] = liveList.map((p: any, idx: number) => ({
        id: p.id,
        vouNo: p.reference_number || String(idx + 1),
        vouType: "RECEIPT",
        date: new Date(p.payment_date || p.created_at).toLocaleDateString("en-GB"),
        recNo: p.reference_number || "0",
        accountName: p.party_name || "CUSTOMER RECEIPT",
        place: "UJJAIN",
        amount: Number(p.amount) || 0,
        grAmount: 0,
        discRd: 0,
        totalAmount: Number(p.amount) || 0,
        billAdjust: "BILLBYBILL",
      }));
      setVouchers(formatted);
    } catch (err) {
      console.error("Error loading receipt vouchers:", err);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = parseFloat(formData.amount);
    if (!amt || amt <= 0) {
      setFormError("Please enter a valid receipt amount");
      return;
    }
    if (!formData.customerId) {
      setFormError("Please select a customer account");
      return;
    }

    try {
      setSaving(true);
      await api.post("/parties/payments", {
        party_type: "customer",
        party_id: formData.customerId,
        payment_type: "payment_in",
        amount: amt,
        payment_mode: formData.debitAccount,
        reference_number: formData.recNo || undefined,
        notes: formData.notes || `Receipt (${formData.billAdjust})`,
      });

      setShowAddModal(false);
      setFormData({
        customerId: "",
        debitAccount: "cash",
        place: "UJJAIN",
        amount: "",
        discRd: "0",
        recNo: "0",
        date: new Date().toISOString().split("T")[0],
        billAdjust: "BILLBYBILL",
        notes: "",
      });
      await fetchVouchers();
    } catch (err: any) {
      console.error("Failed to record receipt voucher", err);
      setFormError(err.response?.data?.detail || "Failed to record receipt voucher");
    } finally {
      setSaving(false);
    }
  };

  const filteredVouchers = React.useMemo(() => {
    if (!searchQuery) return vouchers;
    const q = searchQuery.toLowerCase();
    return vouchers.filter(
      (v) =>
        v.accountName.toLowerCase().includes(q) ||
        v.vouNo.toLowerCase().includes(q) ||
        v.place.toLowerCase().includes(q)
    );
  }, [vouchers, searchQuery]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 32px)",
        background: "#ffffff",
        color: "#0f172a",
        overflow: "hidden",
      }}
    >
      {/* 1. Header Bar matching Image 4 */}
      <div
        style={{
          background: "#ffffff",
          padding: "10px 18px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Left: EA RECEIPT VOUCHER Logo + Series */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "4px",
                background: "#1e1b4b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "1.1rem",
                letterSpacing: "-0.05em",
              }}
            >
              EA
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e1b4b", letterSpacing: "0.03em" }}>
              RECEIPT VOUCHER
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e1b4b" }}>
              VOUCHER SERIES
            </span>
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              style={{
                background: "#1e1b4b",
                color: "#ffffff",
                border: "none",
                borderRadius: "3px",
                padding: "4px 10px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="RECEIPT">RECEIPT</option>
              <option value="BANK RECEIPT">BANK RECEIPT</option>
              <option value="ONLINE RECEIPT">ONLINE RECEIPT</option>
            </select>
          </div>
        </div>

        {/* Right: Circular Icon Action Buttons matching Image 4 */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Quick Search */}
          <div style={{ position: "relative", width: "180px" }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#64748b" }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 8px 4px 28px",
                fontSize: "0.78rem",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                outline: "none",
              }}
            />
          </div>

          {/* (+) Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Add Receipt Voucher (+)"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>

          {/* (✏️) Edit Button */}
          <button
            onClick={() => {
              if (selectedVoucherId) {
                alert(`Editing Voucher ${selectedVoucherId}`);
              } else {
                alert("Please select a voucher row to edit");
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Edit Voucher"
          >
            <Edit2 size={18} strokeWidth={2} />
          </button>

          {/* (🗑️) Delete Button */}
          <button
            onClick={() => {
              if (selectedVoucherId) {
                if (confirm(`Are you sure you want to delete voucher ${selectedVoucherId}?`)) {
                  setVouchers(vouchers.filter((v) => v.id !== selectedVoucherId));
                  setSelectedVoucherId(null);
                }
              } else {
                alert("Please select a voucher row to delete");
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Delete Voucher"
          >
            <Trash2 size={18} strokeWidth={2} />
          </button>

          {/* (🖨️) Print Button */}
          <button
            onClick={() => window.print()}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Print Receipt Register"
          >
            <Printer size={18} strokeWidth={2} />
          </button>

          {/* (🔄) Refresh Button */}
          <button
            onClick={fetchVouchers}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Refresh List"
          >
            <RefreshCw size={18} strokeWidth={2} />
          </button>

          {/* (✖) Close / Back Button */}
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #1e1b4b",
              background: "transparent",
              color: "#1e1b4b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Close (Exit to Dashboard)"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 2. Main Data Table matching Image 4 */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.78rem",
            textAlign: "left",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#16082f",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.75rem",
                letterSpacing: "0.03em",
                height: "34px",
                position: "sticky",
                top: 0,
                zIndex: 20,
              }}
            >
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "90px" }}>VOU NO.</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "100px" }}>VOU TYPE</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "100px" }}>DATE</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854" }}>CUSTOMER NAME</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "120px" }}>PLACE</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", width: "110px" }}>MODE</th>
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854", textAlign: "right", width: "120px" }}>AMOUNT</th>
              <th style={{ padding: "6px 10px", width: "160px" }}>NARRATION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Loading receipt vouchers...
                </td>
              </tr>
            ) : filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No receipt vouchers found.
                </td>
              </tr>
            ) : (
              filteredVouchers.map((v, idx) => {
                const isSelected = selectedVoucherId === v.id;
                return (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedVoucherId(v.id)}
                    style={{
                      background: isSelected ? "#c7d2fe" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      cursor: "pointer",
                      height: "26px",
                      color: isSelected ? "#1e1b4b" : "#0f172a",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 700 }}>{v.vouNo}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0" }}>{v.vouType}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0" }}>{v.date}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>{v.accountName}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0" }}>{v.place || "—"}</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: "0.74rem" }}>Cash / Bank</td>
                    <td style={{ padding: "4px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      ₹{v.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: "4px 10px", fontSize: "0.74rem", color: "#64748b" }}>
                      {v.narration || "Customer Receipt In"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Modal: Add New Receipt Voucher */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#16082f",
                color: "#ffffff",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>New Receipt Voucher</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {formError && (
                <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "8px 12px", borderRadius: "4px", fontSize: "0.8rem" }}>
                  {formError}
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Customer / Debtor Account *
                </label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.825rem",
                  }}
                >
                  <option value="">-- Select Customer Account --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.area_name ? `(${c.area_name})` : ""} - Current Balance: ₹{c.current_balance}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Debit Account (Received Into)
                  </label>
                  <select
                    value={formData.debitAccount}
                    onChange={(e) => setFormData({ ...formData, debitAccount: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  >
                    <option value="cash">Cash In Hand (1001)</option>
                    <option value="bank_transfer">HDFC Bank (1002)</option>
                    <option value="upi">UPI / Scanner</option>
                    <option value="cheque">Cheque In Hand</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Receipt Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Discount / RD (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discRd}
                    onChange={(e) => setFormData({ ...formData, discRd: e.target.value })}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Bill Adjustment Mode
                  </label>
                  <select
                    value={formData.billAdjust}
                    onChange={(e) => setFormData({ ...formData, billAdjust: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  >
                    <option value="BILLBYBILL">BILLBYBILL (Specific Bill)</option>
                    <option value="ON ACCOUNT">ON ACCOUNT (FIFO Balance)</option>
                    <option value="ADVANCE">ADVANCE (Pre-payment)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Place / Branch
                  </label>
                  <input
                    type="text"
                    value={formData.place}
                    onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                    placeholder="e.g. UJJAIN, INDORE"
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Notes / Reference Number
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Receipt Remarks or UTR Number"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.825rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "4px",
                    border: "none",
                    background: "#1e1b4b",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Receipt Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Docked Classic Status Bar */}
      <FundSafeStatusBar moduleName="Receipt Voucher" recordCount={filteredVouchers.length} />
    </div>
  );
}
