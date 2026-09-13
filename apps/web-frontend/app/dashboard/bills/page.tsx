"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface BillItem {
  id?: string;
  item_id?: string;
  item_name: string;
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
  party_id?: string;
  party_name: string;
  party_place?: string;
  party_mobile?: string;
  party_gst?: string;
  party_address?: string;
  terms_conditions?: string;
  is_interstate: boolean;
  creator_name?: string;
  total_amount: number;
  payment_mode: string;
  payment_status: string;
  status: string;
  notes?: string;
  created_at: string;
  items: BillItem[];
}

export default function ListOfBillsPage() {
  const { user, tenant, isAdmin } = useAuth();
  const router = useRouter();

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [docCodeFilter, setDocCodeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bills/?limit=100");
      const list = res.data || [];
      setBills(list);
      if (list.length > 0 && !selectedBillId) {
        setSelectedBillId(list[0].id);
        setSelectedBill(list[0]);
      }
    } catch (err) {
      console.error("Failed to load bills:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRow = (b: Bill) => {
    setSelectedBillId(b.id);
    setSelectedBill(b);
  };

  const handleVoidBill = async (billId: string) => {
    if (!isAdmin) {
      alert("Only Store Owner / Admin has permission to void/delete bills.");
      return;
    }
    const reason = prompt("Enter reason for voiding/deleting bill:");
    if (!reason) return;

    try {
      await api.delete(`/bills/${billId}?reason=${encodeURIComponent(reason)}`);
      alert("Bill successfully voided and reversed in inventory & accounts.");
      loadBills();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to void bill.");
    }
  };

  const handlePrint = () => {
    if (!selectedBill) {
      alert("Please select a bill from the list first.");
      return;
    }
    setShowPrintModal(true);
  };

  const filteredBills = bills.filter((b) => {
    if (docCodeFilter !== "ALL" && docCodeFilter === "CASH" && b.payment_mode !== "cash") return false;
    if (docCodeFilter !== "ALL" && docCodeFilter === "CREDIT" && b.payment_mode !== "credit") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNo = (b.bill_number || "").toLowerCase().includes(q);
      const matchParty = (b.party_name || "").toLowerCase().includes(q);
      if (!matchNo && !matchParty) return false;
    }
    return true;
  });

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "14/09/2026";
    try {
      const d = new Date(isoStr);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#ffffff" }}>
      {/* Top Title Bar & Circular Action Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #cbd5e1",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "#120a42",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
          >
            <TrendingUp size={18} />
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#120a42", letterSpacing: "0.03em" }}>
            LIST OF BILLS
          </h2>
        </div>

        {/* Circular Action Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button className="erp-circle-btn" title="Search / Filter" onClick={() => {}}>
            <Search size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="+ Add New Bill (F12)"
            onClick={() => router.push("/dashboard/pos")}
          >
            <Plus size={18} />
          </button>
          <button
            className="erp-circle-btn"
            title="Edit Selected Bill"
            onClick={() => {
              if (selectedBill) router.push("/dashboard/pos");
            }}
          >
            <FileText size={16} />
          </button>
          <button
            className="erp-circle-btn erp-circle-btn-danger"
            title="Delete / Void Bill (Admin Only)"
            onClick={() => selectedBillId && handleVoidBill(selectedBillId)}
          >
            <Trash2 size={16} />
          </button>
          <button className="erp-circle-btn" title="Print Bill" onClick={handlePrint}>
            <Printer size={16} />
          </button>
          <button className="erp-circle-btn" title="Refresh List" onClick={loadBills}>
            <RefreshCw size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="Close"
            onClick={() => router.push("/dashboard")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sub-Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          padding: "6px 14px",
          background: "#120a42",
          color: "#ffffff",
          fontSize: "0.775rem",
        }}
      >
        <button
          onClick={() => router.push("/dashboard/pos")}
          style={{
            background: "#ffffff",
            color: "#120a42",
            border: "none",
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: "2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          + ADD
        </button>
        <button
          onClick={() => {
            if (selectedBill) setShowPrintModal(true);
          }}
          style={{
            background: "#ffffff",
            color: "#120a42",
            border: "none",
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: "2px",
          }}
        >
          VIEW / EDIT
        </button>
        <button
          onClick={() => selectedBillId && handleVoidBill(selectedBillId)}
          style={{
            background: "#dc2626",
            color: "#ffffff",
            border: "none",
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: "2px",
          }}
        >
          REMOVE
        </button>
        <button
          onClick={loadBills}
          style={{
            background: "#ffffff",
            color: "#120a42",
            border: "none",
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: "2px",
          }}
        >
          REFRESH
        </button>
        <button
          onClick={() => router.push("/dashboard/vouchers?type=receipt")}
          style={{
            background: "#ffffff",
            color: "#120a42",
            border: "none",
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: "2px",
          }}
        >
          PAYMENT DETAIL
        </button>

        <select
          value={docCodeFilter}
          onChange={(e) => setDocCodeFilter(e.target.value)}
          style={{
            padding: "3px 8px",
            fontSize: "0.75rem",
            fontWeight: 700,
            borderRadius: "2px",
            border: "none",
            background: "#ffffff",
            color: "#120a42",
          }}
        >
          <option value="ALL">All Series (Cash-KHP / CR)</option>
          <option value="CASH">Cash-KHP Series</option>
          <option value="CREDIT">Credit Series</option>
        </select>

        <input
          type="text"
          placeholder="Filter Bill# or Party..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "3px 8px",
            fontSize: "0.75rem",
            borderRadius: "2px",
            border: "none",
            background: "#ffffff",
            color: "#0f172a",
            width: "180px",
          }}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          <button
            onClick={() => window.print()}
            style={{
              background: "#3b82f6",
              color: "#ffffff",
              border: "none",
              padding: "3px 10px",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            PRINT LIST
          </button>
          <button
            onClick={() => router.push("/dashboard/accounting?tab=gst")}
            style={{
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              padding: "3px 10px",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            Generate Einvoice / GST
          </button>
        </div>
      </div>

      {/* 13-Column High Density Accounting Data Table */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <table className="erp-table">
          <thead>
            <tr>
              <th style={{ width: "90px" }}>BILL NO.</th>
              <th style={{ width: "100px" }}>DOC. TYPE</th>
              <th style={{ width: "95px" }}>DATE</th>
              <th style={{ minWidth: "220px" }}>ACCOUNT NAME</th>
              <th style={{ width: "110px" }}>PLACE</th>
              <th style={{ width: "110px", textAlign: "right" }}>BILL AMOUNT</th>
              <th style={{ width: "80px" }}>TERM</th>
              <th style={{ width: "120px" }}>TRACK</th>
              <th style={{ width: "110px" }}>SLMAN</th>
              <th style={{ width: "90px" }}>USER</th>
              <th style={{ width: "100px" }}>CR.ACC.</th>
              <th style={{ width: "100px" }}>ackno</th>
              <th style={{ width: "120px" }}>gstin</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", padding: "24px" }}>
                  Loading sales registers...
                </td>
              </tr>
            ) : filteredBills.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No bills found matching current filter. Press (+ ADD) to create a bill.
                </td>
              </tr>
            ) : (
              filteredBills.map((b) => {
                const isSelected = selectedBillId === b.id;
                return (
                  <tr
                    key={b.id}
                    className={isSelected ? "selected" : ""}
                    onClick={() => handleSelectRow(b)}
                    onDoubleClick={() => setShowPrintModal(true)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 800, color: isSelected ? "#ffffff" : "#1e1b4b" }}>
                      {b.bill_number}
                    </td>
                    <td>{b.payment_mode === "credit" ? "CR-SALES" : "Cash-KHP"}</td>
                    <td>{formatDate(b.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{b.party_name || "CASH IN HAND"}</td>
                    <td>{b.party_place || "UJJAIN"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      ₹{formatINR(b.total_amount)}
                    </td>
                    <td>{b.payment_mode === "credit" ? "Credit" : "Cash"}</td>
                    <td>DEWAS GATE</td>
                    <td>KHEMANI JEE</td>
                    <td>{b.creator_name || "ADMIN"}</td>
                    <td>SALES A/C</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>—</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {b.party_gst || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bill View / Print Preview Modal */}
      {showPrintModal && selectedBill && (
        <div className="modal-overlay">
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "4px",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              border: "2px solid #120a42",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "2px solid #120a42", paddingBottom: "8px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#120a42" }}>
                TAX INVOICE - {selectedBill.bill_number}
              </h3>
              <button
                onClick={() => setShowPrintModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
              <div><strong>Party:</strong> {selectedBill.party_name}</div>
              <div><strong>Date:</strong> {formatDate(selectedBill.created_at)}</div>
              <div><strong>Payment Mode:</strong> {selectedBill.payment_mode.toUpperCase()}</div>
              <div><strong>GSTIN:</strong> {selectedBill.party_gst || "Unregistered"}</div>
            </div>

            <table className="erp-table" style={{ marginBottom: "16px" }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBill.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.item_name}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>₹{item.rate}</td>
                    <td style={{ textAlign: "right" }}>₹{item.total_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: "right", fontSize: "1.1rem", fontWeight: 800, color: "#120a42", marginBottom: "16px" }}>
              Grand Total: ₹{formatINR(selectedBill.total_amount)}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="erp-btn" onClick={() => window.print()}>
                <Printer size={16} /> Print Tax Invoice
              </button>
              <button
                className="erp-btn"
                style={{ background: "#64748b" }}
                onClick={() => setShowPrintModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
