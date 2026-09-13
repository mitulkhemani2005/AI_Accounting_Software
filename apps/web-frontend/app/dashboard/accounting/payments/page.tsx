"use client";

import React, { useState, useEffect, useMemo } from "react";
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

interface PaymentVoucher {
  id: string;
  vouNo: string;
  vouType: string;
  date: string;
  accountName: string;
  place: string;
  amount: number;
  recNo: string;
  grAmount: number;
  totalAmount: number;
  narration?: string;
}

export default function PaymentVoucherPage() {
  const { tenant } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [voucherFilter, setVoucherFilter] = useState("Payment");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    accountType: "supplier", // supplier or expense
    supplierId: "",
    expenseAccount: "WAGES",
    creditAccount: "cash",
    place: "INDORE",
    amount: "",
    recNo: "",
    date: new Date().toISOString().split("T")[0],
    narration: "",
  });

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const [payRes, suppRes, accRes] = await Promise.all([
        api.get("/parties/payments?payment_type=payment_out"),
        api.get("/parties/suppliers"),
        api.get("/accounting/accounts?nature=expense"),
      ]);

      setSuppliers(Array.isArray(suppRes.data) ? suppRes.data : []);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);

      const liveList = Array.isArray(payRes.data) ? payRes.data : [];

      const formatted: PaymentVoucher[] = liveList.map((p: any, idx: number) => ({
        id: p.id,
        vouNo: p.reference_number || String(idx + 1),
        vouType: "Payment",
        date: new Date(p.payment_date || p.created_at).toLocaleDateString("en-GB"),
        accountName: p.party_name || "GENERAL EXPENSE",
        place: "INDORE",
        amount: Number(p.amount) || 0,
        recNo: p.reference_number || "",
        grAmount: 0,
        totalAmount: Number(p.amount) || 0,
      }));
      setVouchers(formatted);
    } catch (err) {
      console.error("Error loading payment vouchers:", err);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = parseFloat(formData.amount);
    if (!amt || amt <= 0) {
      setFormError("Please enter a valid payment amount");
      return;
    }

    try {
      setSaving(true);
      const isSupplier = formData.accountType === "supplier";
      const payload: any = {
        party_type: isSupplier ? "supplier" : "customer",
        payment_type: "payment_out",
        amount: amt,
        payment_mode: formData.creditAccount,
        reference_number: formData.recNo || undefined,
        notes: formData.narration || `Payment voucher (${formData.accountType === "supplier" ? "Supplier" : formData.expenseAccount})`,
      };

      if (isSupplier) {
        if (!formData.supplierId) {
          setFormError("Please select a supplier account");
          return;
        }
        payload.party_id = formData.supplierId;
      }

      await api.post("/parties/payments", payload);

      setShowAddModal(false);
      setFormData({
        accountType: "supplier",
        supplierId: "",
        expenseAccount: "WAGES",
        creditAccount: "cash",
        place: "INDORE",
        amount: "",
        recNo: "",
        date: new Date().toISOString().split("T")[0],
        narration: "",
      });
      await fetchVouchers();
    } catch (err: any) {
      console.error("Failed to record payment voucher", err);
      setFormError(err.response?.data?.detail || "Failed to record payment voucher");
    } finally {
      setSaving(false);
    }
  };

  const filteredVouchers = useMemo(() => {
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
      {/* 1. Header Bar matching Image 1 */}
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
        {/* Left: EA PAYMENT VOUCHER Logo + Filter */}
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
              PAYMENT VOUCHER
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e1b4b" }}>
              PAYMENT VOUCHER
            </span>
            <select
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
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
              <option value="Payment">Payment</option>
              <option value="Bank Payment">Bank Payment</option>
              <option value="Cash Payment">Cash Payment</option>
            </select>
          </div>
        </div>

        {/* Right: Circular Icon Action Buttons matching Image 1 */}
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
            title="Add Payment Voucher (+)"
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
                if (confirm(`Are you sure you want to remove voucher ${selectedVoucherId}?`)) {
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
            title="Print Voucher Register"
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

      {/* 2. Main Data Table matching Image 1 */}
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
              <th style={{ padding: "6px 10px", borderRight: "1px solid #2d1854" }}>SUPPLIER / ACCOUNT NAME</th>
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
                  Loading payment vouchers...
                </td>
              </tr>
            ) : filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No payment vouchers found.
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
                      {v.narration || "Payment Out"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Modal: Add New Payment Voucher */}
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
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>New Payment Voucher</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {formError && (
                <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "8px 12px", borderRadius: "4px", fontSize: "0.8rem" }}>
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Account Type
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  >
                    <option value="supplier">Trade Supplier (Creditor)</option>
                    <option value="expense">Direct Expense Account</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Date
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
              </div>

              {formData.accountType === "supplier" ? (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Select Supplier / Account Name *
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Balance: ₹{s.current_balance})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Expense Account
                  </label>
                  <select
                    value={formData.expenseAccount}
                    onChange={(e) => setFormData({ ...formData, expenseAccount: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.825rem",
                    }}
                  >
                    <option value="WAGES">WAGES A/C</option>
                    <option value="SALARY A/C">SALARY A/C</option>
                    <option value="ELECTRIC EXP.">ELECTRIC EXP.</option>
                    <option value="PETROL&DISEL A/C">PETROL&DISEL A/C</option>
                    <option value="REPAIR EXP.">REPAIR EXP.</option>
                    <option value="RENT EXP.">RENT EXP.</option>
                    <option value="TEA & REFRESHMENT">TEA & REFRESHMENT</option>
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Place / City
                  </label>
                  <input
                    type="text"
                    value={formData.place}
                    onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                    placeholder="e.g. INDORE, UJJAIN"
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
                    Amount (₹) *
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Credit Account (Mode)
                  </label>
                  <select
                    value={formData.creditAccount}
                    onChange={(e) => setFormData({ ...formData, creditAccount: e.target.value })}
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
                    <option value="cheque">Cheque Settlement</option>
                    <option value="upi">UPI / Online</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Reference / Cheque No.
                  </label>
                  <input
                    type="text"
                    value={formData.recNo}
                    onChange={(e) => setFormData({ ...formData, recNo: e.target.value })}
                    placeholder="UTR / Chq #"
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
                  Narration / Notes
                </label>
                <input
                  type="text"
                  value={formData.narration}
                  onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                  placeholder="e.g. Paid in full against bill #1092"
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
                  Save Payment Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Docked Classic Status Bar */}
      <FundSafeStatusBar moduleName="Payment Voucher" recordCount={filteredVouchers.length} />
    </div>
  );
}
