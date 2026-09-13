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
  Edit2,
  X,
  Plus,
  Loader2,
  MapPin,
  Save,
} from "lucide-react";

interface BillItem {
  id?: string;
  item_id?: string;
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
  party_id?: string;
  party_name: string;
  party_mobile?: string;
  party_gst?: string;
  party_address?: string;
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
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

  // Edit Bill Modal State
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editPartyId, setEditPartyId] = useState("");
  const [editPartyName, setEditPartyName] = useState("");
  const [editPartyMobile, setEditPartyMobile] = useState("");
  const [editPartyGst, setEditPartyGst] = useState("");
  const [editPartyAddress, setEditPartyAddress] = useState("");
  const [editIsInterstate, setEditIsInterstate] = useState(false);
  const [editPaymentMode, setEditPaymentMode] = useState<"cash" | "credit">("cash");
  const [editModalPaymentStatus, setEditModalPaymentStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editModalNotes, setEditModalNotes] = useState("");
  const [editItems, setEditItems] = useState<BillItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedCatalogItemToAdd, setSelectedCatalogItemToAdd] = useState("");

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

  const fetchAuxData = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        api.get("/parties/customers"),
        api.get("/items"),
      ]);
      setCustomers(custRes.data);
      setCatalog(itemRes.data);
    } catch (e) {
      console.error("Failed to load auxiliary data:", e);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBills();
      fetchAuxData();
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
      // First save notes/payment status if updated
      await api.put(`/bills/${billId}`, {
        notes: editNotes.trim() || undefined,
        payment_status: editPaymentStatus,
      });
      // Then confirm & deduct stock
      await api.post(`/bills/${billId}/confirm`);
      setSuccessMsg("Order confirmed and finalized successfully! Stock deducted & official Sales invoice generated.");
      fetchBills();
      setTimeout(() => setSelectedBill(null), 1200);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to confirm bill");
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

  const handleDownloadPdf = async (billId: string, billNumber: string, format: "a4" | "a5" = "a4") => {
    try {
      const res = await api.get(`/bills/${billId}/pdf?format=${format}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${billNumber}_${format.toUpperCase()}${format === "a5" ? "_HalfSheet" : ""}.pdf`;
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

  // --- Line Item Calculations for Editing ---
  const calculateEditLineItem = (
    item: {
      rate: number;
      quantity: number;
      discount_amount?: number;
      gst_rate: number;
      is_tax_inclusive?: boolean;
    },
    interstate: boolean
  ) => {
    const raw = item.quantity * item.rate;
    const netAmount = Math.max(0, raw - (item.discount_amount || 0));
    const gstRate = item.gst_rate || 0;
    let taxable = 0,
      cgst = 0,
      sgst = 0,
      igst = 0,
      total = 0;

    if (item.is_tax_inclusive && gstRate > 0) {
      taxable = Math.round((netAmount / (1 + gstRate / 100)) * 100) / 100;
      const totalGst = Math.round((netAmount - taxable) * 100) / 100;
      total = netAmount;

      if (interstate) {
        igst = totalGst;
      } else {
        cgst = Math.round((totalGst / 2) * 100) / 100;
        sgst = Math.round((totalGst - cgst) * 100) / 100;
      }
    } else {
      taxable = netAmount;
      if (interstate) {
        igst = Math.round(taxable * (gstRate / 100) * 100) / 100;
      } else {
        const halfRate = gstRate / 2;
        cgst = Math.round(taxable * (halfRate / 100) * 100) / 100;
        sgst = Math.round(taxable * (halfRate / 100) * 100) / 100;
      }
      total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;
    }

    return { taxable, cgst, sgst, igst, total };
  };

  const openEditModal = (bill: Bill) => {
    setEditingBill(bill);
    setEditPartyId(bill.party_id || "");
    setEditPartyName(bill.party_name);
    setEditPartyMobile(bill.party_mobile || "");
    setEditPartyGst(bill.party_gst || "");
    setEditPartyAddress(bill.party_address || "");
    setEditIsInterstate(bill.is_interstate);
    const mode = bill.payment_mode === "credit" ? "credit" : "cash";
    setEditPaymentMode(mode);
    setEditModalPaymentStatus(bill.payment_status as any);
    setEditPaidAmount(bill.paid_amount);
    setEditDiscount(bill.discount_amount);
    setEditModalNotes(bill.notes || "");
    setEditItems(
      (bill.items || []).map((i) => ({
        ...i,
        purchase_price: i.purchase_price || 0,
        is_tax_inclusive: i.is_tax_inclusive || false,
      }))
    );
  };

  const updateEditItemQty = (idx: number, newQty: number) => {
    if (newQty <= 0) return;
    setEditItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const calc = calculateEditLineItem(
        {
          rate: item.rate,
          quantity: newQty,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: item.is_tax_inclusive,
        },
        editIsInterstate
      );
      updated[idx] = {
        ...item,
        quantity: newQty,
        taxable_amount: calc.taxable,
        cgst_amount: calc.cgst,
        sgst_amount: calc.sgst,
        igst_amount: calc.igst,
        total_amount: calc.total,
      };
      return updated;
    });
  };

  const updateEditItemRate = (idx: number, newRate: number) => {
    setEditItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const calc = calculateEditLineItem(
        {
          rate: newRate,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: item.is_tax_inclusive,
        },
        editIsInterstate
      );
      updated[idx] = {
        ...item,
        rate: newRate,
        taxable_amount: calc.taxable,
        cgst_amount: calc.cgst,
        sgst_amount: calc.sgst,
        igst_amount: calc.igst,
        total_amount: calc.total,
      };
      return updated;
    });
  };

  const updateEditItemPurchasePrice = (idx: number, newCost: number) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        purchase_price: newCost,
      };
      return updated;
    });
  };

  const updateEditItemGst = (idx: number, newGst: number) => {
    setEditItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const calc = calculateEditLineItem(
        {
          rate: item.rate,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
          gst_rate: newGst,
          is_tax_inclusive: item.is_tax_inclusive,
        },
        editIsInterstate
      );
      updated[idx] = {
        ...item,
        gst_rate: newGst,
        taxable_amount: calc.taxable,
        cgst_amount: calc.cgst,
        sgst_amount: calc.sgst,
        igst_amount: calc.igst,
        total_amount: calc.total,
      };
      return updated;
    });
  };

  const toggleEditItemTaxInclusive = (idx: number) => {
    setEditItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const newInc = !item.is_tax_inclusive;
      const calc = calculateEditLineItem(
        {
          rate: item.rate,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: newInc,
        },
        editIsInterstate
      );
      updated[idx] = {
        ...item,
        is_tax_inclusive: newInc,
        taxable_amount: calc.taxable,
        cgst_amount: calc.cgst,
        sgst_amount: calc.sgst,
        igst_amount: calc.igst,
        total_amount: calc.total,
      };
      return updated;
    });
  };

  const removeEditItem = (idx: number) => {
    if (editItems.length === 1) {
      alert("A bill must have at least one item.");
      return;
    }
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addProductToEditBill = (productId: string) => {
    if (!productId) return;
    const product = catalog.find((c) => c.id === productId);
    if (!product) return;

    const isTaxInc = product.is_tax_inclusive || false;
    const calc = calculateEditLineItem(
      {
        rate: product.sale_price,
        quantity: 1,
        discount_amount: 0,
        gst_rate: product.gst_rate,
        is_tax_inclusive: isTaxInc,
      },
      editIsInterstate
    );

    const newItem: BillItem = {
      item_id: product.id,
      item_name: product.name,
      hsn_code: product.hsn_code,
      quantity: 1,
      unit: product.unit || "PCS",
      rate: product.sale_price,
      purchase_price: product.purchase_price || 0,
      discount_amount: 0,
      gst_rate: product.gst_rate,
      is_tax_inclusive: isTaxInc,
      taxable_amount: calc.taxable,
      cgst_amount: calc.cgst,
      sgst_amount: calc.sgst,
      igst_amount: calc.igst,
      total_amount: calc.total,
    };

    setEditItems((prev) => [...prev, newItem]);
    setSelectedCatalogItemToAdd("");
  };

  // Edit Form Totals
  const editSubtotal = editItems.reduce((sum, i) => sum + i.taxable_amount, 0);
  const editTaxable = Math.max(0, editSubtotal - (editDiscount || 0));
  const editCgst = editItems.reduce((sum, i) => sum + i.cgst_amount, 0);
  const editSgst = editItems.reduce((sum, i) => sum + i.sgst_amount, 0);
  const editIgst = editItems.reduce((sum, i) => sum + i.igst_amount, 0);
  const editTotalGst = editCgst + editSgst + editIgst;
  const editRawTotal = editTaxable + editTotalGst;
  const editGrandTotal = Math.round(editRawTotal);
  const editRoundOff = Math.round((editGrandTotal - editRawTotal) * 100) / 100;

  const handleSaveEdit = async () => {
    if (!editingBill) return;
    if (editItems.length === 0) {
      alert("At least one item is required.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const payload = {
        party_id: editPartyId ? editPartyId : "",
        party_name: editPartyName.trim() || "Cash Customer",
        party_mobile: editPartyMobile.trim() || undefined,
        party_gst: editPartyGst.trim() || undefined,
        party_address: editPartyAddress.trim() || undefined,
        is_interstate: editIsInterstate,
        payment_mode: editPaymentMode,
        payment_status: editModalPaymentStatus,
        paid_amount: editPaymentMode === "cash" && editModalPaymentStatus === "paid" ? editGrandTotal : editPaidAmount,
        discount_amount: editDiscount || 0,
        notes: editModalNotes.trim() || undefined,
        items: editItems.map((i) => ({
          item_id: i.item_id ? i.item_id : undefined,
          item_name: i.item_name,
          hsn_code: i.hsn_code || undefined,
          quantity: Number(i.quantity),
          unit: i.unit || "PCS",
          rate: Number(i.rate),
          purchase_price: Number(i.purchase_price || 0),
          discount_amount: Number(i.discount_amount || 0),
          gst_rate: Number(i.gst_rate),
          is_tax_inclusive: Boolean(i.is_tax_inclusive),
        })),
      };

      const res = await api.put(`/bills/${editingBill.id}`, payload);
      setSuccessMsg(`Bill #${editingBill.bill_number} updated successfully!`);
      setEditingBill(null);
      if (selectedBill?.id === editingBill.id) {
        setSelectedBill(res.data);
      }
      fetchBills();
    } catch (err: any) {
      console.error("Failed to update bill:", err);
      const detail = err.response?.data?.detail;
      const errorText =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => `${d.loc ? d.loc.filter((x: any) => x !== 'body').join(' > ') : ''}: ${d.msg}`).join('\n')
          : "Failed to update bill. Please check values.";
      alert(errorText);
    } finally {
      setIsSavingEdit(false);
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
            Inspect, edit, approve, and verify bills created by store operators and counter staff.
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
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Pending Orders</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Awaiting Admin Confirmation
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Value</span>
            <IndianRupee size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#10b981" }}>
            ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Across {bills.length} bills in view
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Unpaid Balance</span>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444" }}>
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Credit / Partial due
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
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
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setFilterMode("pending")}
            className={filterMode === "pending" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={filterMode === "all" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            All Staff Invoices
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", flex: 1, maxWidth: "400px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by Bill #, Customer, Phone, or Staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px" }}
            />
          </div>
        </div>

        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", fontSize: "0.85rem" }}
        >
          <option value="all">All Payment Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid / Credit</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
            <div>Loading staff bills queue...</div>
          </div>
        ) : filteredBills.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle2 size={42} color="#10b981" style={{ margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>
              Queue is Clear
            </h3>
            <p style={{ fontSize: "0.875rem" }}>
              No staff bills requiring review match your current filter.
            </p>
          </div>
        ) : (
          <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                <th style={{ padding: "14px 16px" }}>Bill Number</th>
                <th style={{ padding: "14px 16px" }}>Created At</th>
                <th style={{ padding: "14px 16px" }}>Staff Member</th>
                <th style={{ padding: "14px 16px" }}>Customer</th>
                <th style={{ padding: "14px 16px" }}>Items</th>
                <th style={{ padding: "14px 16px" }}>Grand Total</th>
                <th style={{ padding: "14px 16px" }}>Payment</th>
                <th style={{ padding: "14px 16px" }}>Status</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => (
                <tr key={bill.id} style={{ opacity: bill.status === "void" ? 0.6 : 1 }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <FileText size={15} color="#38bdf8" />
                      <span>{bill.bill_number}</span>
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={13} />
                      {new Date(bill.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={13} color="#60a5fa" />
                      <span style={{ fontWeight: 500 }}>{bill.creator_name || "Staff"}</span>
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: "0.65rem", marginTop: "2px" }}>
                      {bill.creator_role || "sub_user"}
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 500 }}>{bill.party_name}</div>
                    {bill.party_address && (
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "3px" }}>
                        <MapPin size={11} /> {bill.party_address}
                      </div>
                    )}
                    {bill.party_mobile && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        📱 {bill.party_mobile}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <span className="badge badge-blue">
                      {bill.items ? bill.items.length : 0} items
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#34d399" }}>
                    ₹{bill.total_amount.toFixed(2)}
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
                      {/* Confirm button */}
                      {!bill.is_reviewed_by_admin && bill.status !== "void" && (
                        <button
                          onClick={() => handleApproveBill(bill.id)}
                          className="btn-primary"
                          style={{ padding: "5px 10px", fontSize: "0.75rem", background: "#10b981", borderColor: "#059669", display: "flex", alignItems: "center", gap: "4px" }}
                          title="Confirm & Finalize Invoice"
                        >
                          <CheckCircle2 size={13} /> Confirm
                        </button>
                      )}

                      {/* Edit Button */}
                      {bill.status !== "void" && (
                        <button
                          onClick={() => openEditModal(bill)}
                          className="btn-secondary"
                          style={{ padding: "6px 8px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                          title="Edit Bill Items / Rates / Party"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => openBillDetail(bill)}
                        className="btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                        title="Inspect & Review"
                      >
                        <Eye size={14} /> Review
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(bill.id, bill.bill_number, "a5")}
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
                {selectedBill.party_address && <div style={{ color: "#cbd5e1", marginTop: "2px" }}>📍 {selectedBill.party_address}</div>}
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
                  {selectedBill.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
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
                    <option value="unpaid">Unpaid / Credit</option>
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleVoidBill(selectedBill.id)}
                    disabled={actionLoading || selectedBill.status === "void"}
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "8px",
                      padding: "10px 16px",
                      fontWeight: 600,
                      cursor: selectedBill.status === "void" ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Trash2 size={16} /> {selectedBill.status === "void" ? "Already Voided" : "Void Invoice"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openEditModal(selectedBill);
                      setSelectedBill(null);
                    }}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "6px", background: "#3b82f6" }}
                  >
                    <Edit2 size={16} /> Edit Order / Items
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number, "a5")}
                    className="btn-secondary"
                    title="Download Half-A4 (A5) Tax Invoice"
                  >
                    <Printer size={16} /> Half-A4 PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number, "a4")}
                    className="btn-secondary"
                    title="Download Full A4 Tax Invoice"
                  >
                    <Printer size={16} /> Full A4 PDF
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

      {/* --- ADMIN FULL BILL EDITOR MODAL --- */}
      {editingBill && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 150,
            padding: "20px",
          }}
          onClick={() => setEditingBill(null)}
        >
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "900px", maxHeight: "92vh", overflowY: "auto", padding: "24px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="badge badge-purple">ADMIN BILL OVERRIDE</span>
                  <span className="badge badge-blue">EDITING MODE</span>
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                  Edit Order / Bill: {editingBill.bill_number}
                </h2>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Originally created by <strong>{editingBill.creator_name || "Counter Staff"}</strong> &bull; Changes will recalculate totals and update party balances automatically.
                </div>
              </div>

              <button onClick={() => setEditingBill(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Form Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              {/* Customer Selector */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Customer / Party
                </label>
                <select
                  className="input-field"
                  value={editPartyId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setEditPartyId(cid);
                    if (!cid) {
                      setEditPartyName("Walk-in Cash Customer");
                      setEditPartyMobile("");
                      setEditPartyGst("");
                    } else {
                      const cust = customers.find((c) => c.id === cid);
                      if (cust) {
                        setEditPartyName(cust.name);
                        setEditPartyMobile(cust.mobile || "");
                        setEditPartyGst(cust.gst_number || "");
                      }
                    }
                  }}
                  style={{ fontSize: "0.85rem" }}
                >
                  <option value="">👤 Walk-in Cash Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.area_name ? `• 📍 [${c.area_name}]` : ""} {c.mobile ? `• 📱 ${c.mobile}` : ""} {c.gst_number ? `• 🆔 GST: ${c.gst_number}` : ""} {c.billing_address ? `• 🏠 ${c.billing_address}` : ""} • 💰 Credit Due: ₹{c.current_balance?.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Mobile & GST */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editPartyMobile}
                    onChange={(e) => setEditPartyMobile(e.target.value)}
                    placeholder="Mobile..."
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    GST Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editPartyGst}
                    onChange={(e) => setEditPartyGst(e.target.value)}
                    placeholder="GSTIN..."
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Customer Billing Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editPartyAddress}
                  onChange={(e) => setEditPartyAddress(e.target.value)}
                  placeholder="Address, City, State..."
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Payment Mode (2 Options)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPaymentMode("cash");
                      setEditModalPaymentStatus("paid");
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      border: editPaymentMode === "cash" ? "2px solid #10b981" : "1px solid var(--border)",
                      background: editPaymentMode === "cash" ? "rgba(16, 185, 129, 0.25)" : "rgba(30, 41, 59, 0.4)",
                      color: editPaymentMode === "cash" ? "#34d399" : "var(--text-muted)",
                    }}
                  >
                    💵 CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPaymentMode("credit");
                      setEditModalPaymentStatus("unpaid");
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      border: editPaymentMode === "credit" ? "2px solid #f59e0b" : "1px solid var(--border)",
                      background: editPaymentMode === "credit" ? "rgba(245, 158, 11, 0.25)" : "rgba(30, 41, 59, 0.4)",
                      color: editPaymentMode === "credit" ? "#fbbf24" : "var(--text-muted)",
                    }}
                  >
                    📒 CREDIT
                  </button>
                </div>
              </div>

              {/* Payment Status & Paid Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    Payment Status
                  </label>
                  <select
                    className="input-field"
                    value={editModalPaymentStatus}
                    onChange={(e) => setEditModalPaymentStatus(e.target.value as any)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(parseFloat(e.target.value) || 0)}
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              </div>
            </div>

            {/* Add Product from Catalog row */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", background: "rgba(30, 41, 59, 0.3)", padding: "8px 12px", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>+ Add Product to Bill:</span>
              <select
                className="input-field"
                value={selectedCatalogItemToAdd}
                onChange={(e) => {
                  setSelectedCatalogItemToAdd(e.target.value);
                  addProductToEditBill(e.target.value);
                }}
                style={{ flex: 1, fontSize: "0.85rem" }}
              >
                <option value="">Select an item from catalog to add...</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — ₹{c.sale_price} ({c.gst_rate}% GST)
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Items Table */}
            <div style={{ overflowX: "auto", marginBottom: "16px" }}>
              <table className="custom-table" style={{ fontSize: "0.825rem", width: "100%" }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th style={{ width: "70px", textAlign: "center" }}>Qty</th>
                    <th style={{ width: "95px" }}>Selling ₹</th>
                    <th style={{ width: "95px" }}>Cost ₹</th>
                    <th style={{ width: "80px" }}>GST %</th>
                    <th style={{ width: "90px" }}>Tax Mode</th>
                    <th style={{ textAlign: "right" }}>Line Total</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          className="input-field"
                          value={item.item_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditItems((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], item_name: val };
                              return updated;
                            });
                          }}
                          style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="input-field"
                          value={item.quantity}
                          onChange={(e) => updateEditItemQty(idx, parseFloat(e.target.value) || 1)}
                          style={{ padding: "4px 6px", fontSize: "0.8rem", textAlign: "center" }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field"
                          value={item.rate}
                          onChange={(e) => updateEditItemRate(idx, parseFloat(e.target.value) || 0)}
                          style={{ padding: "4px 6px", fontSize: "0.8rem", color: "#38bdf8", fontWeight: 600 }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field"
                          value={item.purchase_price ?? 0}
                          onChange={(e) => updateEditItemPurchasePrice(idx, parseFloat(e.target.value) || 0)}
                          style={{ padding: "4px 6px", fontSize: "0.8rem", color: "#f59e0b", fontWeight: 600 }}
                        />
                      </td>

                      <td>
                        <select
                          className="input-field"
                          value={item.gst_rate}
                          onChange={(e) => updateEditItemGst(idx, parseFloat(e.target.value) || 0)}
                          style={{ padding: "4px 6px", fontSize: "0.8rem" }}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => toggleEditItemTaxInclusive(idx)}
                          style={{
                            padding: "3px 6px",
                            borderRadius: "4px",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: "1px solid var(--border)",
                            background: item.is_tax_inclusive ? "rgba(59, 130, 246, 0.2)" : "rgba(100, 116, 139, 0.2)",
                            color: item.is_tax_inclusive ? "#60a5fa" : "#94a3b8",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.is_tax_inclusive ? "MRP Incl." : "Exclusive"}
                        </button>
                      </td>

                      <td style={{ textAlign: "right", fontWeight: 700, color: "#34d399", fontSize: "0.9rem" }}>
                        ₹{item.total_amount.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeEditItem(idx)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                          title="Remove Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Notes Section */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Invoice Notes
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editModalNotes}
                  onChange={(e) => setEditModalNotes(e.target.value)}
                  placeholder="Optional notes or remarks..."
                  style={{ fontSize: "0.85rem", resize: "none" }}
                />
              </div>

              <div style={{ background: "rgba(30, 41, 59, 0.4)", padding: "12px 16px", borderRadius: "8px", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Subtotal (Taxable):</span>
                  <span>₹{editTaxable.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total GST:</span>
                  <span>₹{editTotalGst.toFixed(2)}</span>
                </div>
                {editRoundOff !== 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Round Off:</span>
                    <span>{editRoundOff > 0 ? `+₹${editRoundOff.toFixed(2)}` : `-₹${Math.abs(editRoundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "6px", marginTop: "4px", fontSize: "1.1rem", fontWeight: 700 }}>
                  <span>Grand Total:</span>
                  <span style={{ color: "#34d399" }}>₹{editGrandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                className="btn-secondary"
                disabled={isSavingEdit}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#10b981", borderColor: "#059669" }}
              >
                {isSavingEdit ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
