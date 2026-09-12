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
  Edit2,
  PlusCircle,
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
  terms_conditions?: string;
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [printFormat, setPrintFormat] = useState<"thermal" | "half_a4">("half_a4");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Multi-Bill Selection & Batch Actions
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [isBatchDownloadingPdf, setIsBatchDownloadingPdf] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  // Edit Bill Modal State (Admin only)
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editPartyId, setEditPartyId] = useState("");
  const [editPartyName, setEditPartyName] = useState("");
  const [editPartyMobile, setEditPartyMobile] = useState("");
  const [editPartyGst, setEditPartyGst] = useState("");
  const [editPartyAddress, setEditPartyAddress] = useState("");
  const [editIsInterstate, setEditIsInterstate] = useState(false);
  const [editPaymentMode, setEditPaymentMode] = useState<"cash" | "credit">("cash");
  const [editPaymentStatus, setEditPaymentStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<BillItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedCatalogItemToAdd, setSelectedCatalogItemToAdd] = useState("");

  const numberToWordsINR = (amount: number): string => {
    try {
      const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
      const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

      const convertBelowThousand = (n: number): string => {
        let res = "";
        if (n >= 100) {
          res += units[Math.floor(n / 100)] + " Hundred ";
          n %= 100;
        }
        if (n >= 20) {
          res += tens[Math.floor(n / 10)] + " ";
          n %= 10;
        }
        if (n > 0) {
          res += units[n] + " ";
        }
        return res.trim();
      };

      let rupees = Math.floor(amount);
      const paise = Math.round((amount - rupees) * 100);

      if (rupees === 0) return "Rupees Zero Only";

      const crores = Math.floor(rupees / 10000000);
      rupees %= 10000000;
      const lakhs = Math.floor(rupees / 100000);
      rupees %= 100000;
      const thousands = Math.floor(rupees / 1000);
      rupees %= 1000;
      const remainder = rupees;

      const parts: string[] = [];
      if (crores > 0) parts.push(convertBelowThousand(crores) + " Crore");
      if (lakhs > 0) parts.push(convertBelowThousand(lakhs) + " Lakh");
      if (thousands > 0) parts.push(convertBelowThousand(thousands) + " Thousand");
      if (remainder > 0) parts.push(convertBelowThousand(remainder));

      let words = "Rupees " + parts.join(" ").trim();
      if (paise > 0) {
        words += " and " + convertBelowThousand(paise) + " Paise";
      }
      return words + " Only";
    } catch {
      return `Rupees ${amount.toFixed(2)} Only`;
    }
  };

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
    fetchBills();
    fetchAuxData();
  }, [paymentStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  const handleDownloadPdf = async (billId: string, billNumber: string, format: "a4" | "a5" = "a4") => {
    setIsDownloadingPdf(true);
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

  const handlePrintBill = (bill: Bill, format: "thermal" | "half_a4" = "half_a4") => {
    setSelectedBill(bill);
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 120);
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

  const toggleSelectBill = (id: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredList: Bill[]) => {
    if (selectedBillIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(filteredList.map((b) => b.id));
    }
  };

  const clearSelection = () => {
    setSelectedBillIds([]);
  };

  const handlePrintBatch = () => {
    if (selectedBillIds.length === 0) return;
    setIsBatchPrinting(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDownloadCombinedPdf = async (format: "a5" | "a4" = "a5") => {
    if (selectedBillIds.length === 0) return;
    setIsBatchDownloadingPdf(true);
    try {
      const res = await api.get(`/bills/batch/pdf`, {
        params: {
          bill_ids: selectedBillIds.join(","),
          format: format,
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Combined_Bills_${selectedBillIds.length}_Invoices.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to download combined PDF invoices");
    } finally {
      setIsBatchDownloadingPdf(false);
    }
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
    setEditPaymentStatus(bill.payment_status as any);
    setEditPaidAmount(bill.paid_amount);
    setEditDiscount(bill.discount_amount);
    setEditNotes(bill.notes || "");
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
        party_id: editPartyId || undefined,
        party_name: editPartyName.trim() || "Cash Customer",
        party_mobile: editPartyMobile.trim() || undefined,
        party_gst: editPartyGst.trim() || undefined,
        party_address: editPartyAddress.trim() || undefined,
        is_interstate: editIsInterstate,
        payment_mode: editPaymentMode,
        payment_status: editPaymentStatus,
        paid_amount: editPaymentMode === "cash" && editPaymentStatus === "paid" ? editGrandTotal : editPaidAmount,
        discount_amount: editDiscount || 0,
        notes: editNotes.trim() || undefined,
        items: editItems.map((i) => ({
          item_id: i.item_id,
          item_name: i.item_name,
          hsn_code: i.hsn_code,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          purchase_price: i.purchase_price || 0,
          discount_amount: i.discount_amount || 0,
          gst_rate: i.gst_rate,
          is_tax_inclusive: i.is_tax_inclusive || false,
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
      alert(err.response?.data?.detail || "Failed to update bill. Please check values.");
    } finally {
      setIsSavingEdit(false);
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
  const creditSales = bills.filter((b) => b.status !== "void" && b.payment_mode === "credit").reduce((sum, b) => sum + b.total_amount, 0);
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
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Cash vs Credit Split</span>
              <Banknote size={18} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>
              Cash: ₹{cashSales.toFixed(0)} | Credit: ₹{creditSales.toFixed(0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Cash collected vs Credit sales
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px", borderLeft: "4px solid #ef4444" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Customer Credit Due</span>
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
              <option value="unpaid">Unpaid / Credit</option>
            </select>

            {/* Payment Mode Filter - ONLY 2 OPTIONS: Cash or Credit */}
            <select
              className="input-field"
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.85rem", padding: "8px 12px" }}
            >
              <option value="all">All Modes (Cash & Credit)</option>
              <option value="cash">💵 Cash Only</option>
              <option value="credit">📒 Credit Only</option>
            </select>
          </div>
        </div>

        {/* Batch Actions Banner (when 1 or more bills selected) */}
        {selectedBillIds.length > 0 && (
          <div
            className="glass-panel"
            style={{
              padding: "12px 18px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(37, 99, 235, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              borderRadius: "10px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="badge badge-blue" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                ✓ {selectedBillIds.length} Bills Selected
              </span>
              <button
                onClick={clearSelection}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
              >
                Clear Selection
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {/* Batch Print Half-A4 */}
              <button
                onClick={handlePrintBatch}
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: "0.85rem", background: "#3b82f6", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Printer size={16} /> Print Selected ({selectedBillIds.length} Combined)
              </button>

              {/* Batch Download Combined PDF */}
              <button
                onClick={() => handleDownloadCombinedPdf("a5")}
                disabled={isBatchDownloadingPdf}
                className="btn-secondary"
                style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", color: "#a855f7", borderColor: "#a855f7" }}
              >
                {isBatchDownloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} color="#a855f7" />} Download Combined PDF
              </button>
            </div>
          </div>
        )}

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
                  <th style={{ width: "38px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={filteredBills.length > 0 && selectedBillIds.length === filteredBills.length}
                      onChange={() => toggleSelectAll(filteredBills)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      title="Select / Deselect All"
                    />
                  </th>
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
                {filteredBills.map((bill) => {
                  const isSelected = selectedBillIds.includes(bill.id);
                  return (
                  <tr
                    key={bill.id}
                    style={{
                      opacity: bill.status === "void" ? 0.6 : 1,
                      background: isSelected ? "rgba(59, 130, 246, 0.12)" : undefined,
                    }}
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectBill(bill.id)}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                    </td>
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
                        <span
                          className="badge"
                          style={{
                            background: bill.payment_mode === "credit" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                            color: bill.payment_mode === "credit" ? "#fbbf24" : "#34d399",
                            textTransform: "uppercase",
                            fontSize: "0.7rem",
                          }}
                        >
                          {bill.payment_mode === "credit" ? "Credit" : "Cash"}
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
                        {/* View Button */}
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="btn-secondary"
                          style={{ padding: "6px 8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                          title="View Invoice Details"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Admin Edit Button */}
                        {isAdmin && bill.status !== "void" && (
                          <button
                            onClick={() => openEditModal(bill)}
                            className="btn-secondary"
                            style={{ padding: "6px 8px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                            title="Edit Bill (Admin Override)"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}

                        {/* Print Half-A4 */}
                        <button
                          onClick={() => handlePrintBill(bill, "half_a4")}
                          className="btn-secondary"
                          style={{ padding: "6px 8px" }}
                          title="Print Professional Half-A4 (A5) Bill"
                        >
                          <Printer size={14} color="#38bdf8" />
                        </button>

                        {/* Print Thermal */}
                        <button
                          onClick={() => handlePrintBill(bill, "thermal")}
                          className="btn-secondary"
                          style={{ padding: "6px 8px" }}
                          title="Print Thermal Slip"
                        >
                          <Receipt size={14} />
                        </button>

                        {/* Download Half A4 PDF */}
                        <button
                          onClick={() => handleDownloadPdf(bill.id, bill.bill_number, "a5")}
                          className="btn-secondary"
                          style={{ padding: "6px 8px" }}
                          title="Download Half-A4 (A5) PDF"
                        >
                          <FileText size={14} color="#a855f7" />
                        </button>

                        {/* Download Full A4 PDF */}
                        <button
                          onClick={() => handleDownloadPdf(bill.id, bill.bill_number, "a4")}
                          className="btn-secondary"
                          style={{ padding: "6px 8px" }}
                          title="Download Full A4 PDF"
                        >
                          <FileText size={14} color="#60a5fa" />
                        </button>

                        {/* WhatsApp */}
                        <button
                          onClick={() => handleWhatsAppShare(bill.id)}
                          className="btn-secondary"
                          style={{ padding: "6px 8px" }}
                          title="Share on WhatsApp"
                        >
                          <Share2 size={14} color="#25D366" />
                        </button>

                        {/* Void Button */}
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- ADMIN FULL BILL EDITOR MODAL --- */}
      {editingBill && (
        <div className="modal-overlay no-print" onClick={() => setEditingBill(null)}>
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
                  Edit Invoice: {editingBill.bill_number}
                </h2>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Originally created by <strong>{editingBill.creator_name || "Counter Staff"}</strong> &bull; Changes will recalculate totals and update customer balances automatically.
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
                      {c.name} {c.mobile ? `• 📱 ${c.mobile}` : ""} {c.gst_number ? `• 🆔 GST: ${c.gst_number}` : ""} {c.billing_address ? `• 📍 ${c.billing_address}` : ""} • 💰 Credit Due: ₹{c.current_balance?.toFixed(2)}
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

              {/* Payment Mode (ONLY CASH OR CREDIT) */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Payment Mode (2 Options)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPaymentMode("cash");
                      setEditPaymentStatus("paid");
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
                      setEditPaymentStatus("unpaid");
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
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value as any)}
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
              <table className="custom-table" style={{ fontSize: "0.825rem" }}>
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
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
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
                    <span>₹{editRoundOff.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid var(--border)", fontSize: "1.15rem", fontWeight: 700, color: "#34d399" }}>
                  <span>Grand Total:</span>
                  <span>₹{editGrandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions Toolbar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#3b82f6" }}
              >
                {isSavingEdit ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Changes & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL INVOICE DETAILS MODAL (VIEW) --- */}
      {selectedBill && !editingBill && (
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
                <div>Payment Mode: <strong style={{ textTransform: "uppercase" }}>{selectedBill.payment_mode === "credit" ? "Credit" : "Cash"}</strong></div>
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
                    <tr key={item.id || item.item_name}>
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
              <div style={{ display: "flex", gap: "8px" }}>
                {isAdmin && selectedBill.status !== "void" && (
                  <>
                    <button
                      onClick={() => {
                        const b = selectedBill;
                        setSelectedBill(null);
                        openEditModal(b);
                      }}
                      className="btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: "6px", background: "#3b82f6" }}
                    >
                      <Edit2 size={16} /> Edit Bill
                    </button>

                    <button
                      onClick={() => handleVoidBill(selectedBill.id)}
                      disabled={isVoiding}
                      className="btn-danger"
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Trash2 size={16} /> Void Invoice
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handlePrintBill(selectedBill, "half_a4")}
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "#0284c7" }}
                >
                  <Printer size={16} /> Print Half-A4 Bill
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintBill(selectedBill, "thermal")}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Receipt size={16} /> Thermal Slip
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number, "a5")}
                  disabled={isDownloadingPdf}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {isDownloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} color="#a855f7" />} Half-A4 PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedBill.id, selectedBill.bill_number, "a4")}
                  disabled={isDownloadingPdf}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {isDownloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} color="#60a5fa" />} Full A4 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SINGLE PRINTABLE HALF-A4 PROFESSIONAL BILL CONTAINER --- */}
      {selectedBill && printFormat === "half_a4" && !isBatchPrinting && (
        <div className="print-half-a4" style={{ width: "100%", maxWidth: "100%", margin: "0", padding: "2mm 4mm", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", fontSize: "10.5px", color: "#000", background: "#fff", boxSizing: "border-box" }}>
          {/* Header: Company Details & Invoice Metadata */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "5px", marginBottom: "6px" }}>
            <div style={{ maxWidth: "62%" }}>
              <h2 style={{ margin: "0 0 2px 0", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", color: "#000" }}>
                {tenant?.business_name || "RETAIL STORE"}
              </h2>
              {tenant?.legal_name && tenant?.legal_name !== tenant?.business_name && (
                <div style={{ fontSize: "9.5px", color: "#333", marginBottom: "2px" }}>({tenant.legal_name})</div>
              )}
              <div style={{ fontSize: "9.5px", lineHeight: "1.3", color: "#111" }}>
                <div><strong>Address:</strong> {tenant?.address ? `${tenant.address}${tenant.city ? `, ${tenant.city}` : ""}${tenant.state ? `, ${tenant.state}` : ""}${tenant.pincode ? ` - ${tenant.pincode}` : ""}` : "Store Address"}</div>
                <div><strong>Phone:</strong> {tenant?.phone || "—"} &bull; <strong>GSTIN:</strong> {tenant?.gst_number || "Unregistered"}</div>
                {tenant?.email && <div><strong>Email:</strong> {tenant.email}</div>}
              </div>
            </div>
            
            <div style={{ textAlign: "right", maxWidth: "38%" }}>
              <div style={{ background: "#000", color: "#fff", padding: "2px 8px", fontSize: "11px", fontWeight: "bold", display: "inline-block", letterSpacing: "1px", marginBottom: "3px" }}>
                TAX INVOICE
              </div>
              <div style={{ fontSize: "9.5px", lineHeight: "1.35", color: "#111" }}>
                <div><strong>Invoice No:</strong> {selectedBill.bill_number}</div>
                <div><strong>Date:</strong> {new Date(selectedBill.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div><strong>Time:</strong> {new Date(selectedBill.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div><strong>Place of Supply:</strong> {selectedBill.is_interstate ? "Inter-State (IGST)" : "Intra-State"}</div>
              </div>
            </div>
          </div>

          {/* Bill To & Payment Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", border: "1px solid #000", padding: "5px 8px", marginBottom: "6px", fontSize: "10px", lineHeight: "1.35", background: "#fcfcfc" }}>
            <div>
              <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>BILLED TO (CUSTOMER):</div>
              <div style={{ fontSize: "11.5px", fontWeight: "bold", color: "#000" }}>{selectedBill.party_name || "Cash Customer"}</div>
              <div><strong>Address:</strong> {selectedBill.party_address || "—"}</div>
              <div><strong>Phone:</strong> {selectedBill.party_mobile || "—"} &bull; <strong>GSTIN:</strong> {selectedBill.party_gst || "—"}</div>
            </div>
            <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
              <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>PAYMENT & BILLING:</div>
              <div><strong>Payment Mode:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{selectedBill.payment_mode === "credit" ? "CREDIT" : "CASH"}</span></div>
              <div><strong>Payment Status:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{selectedBill.payment_status}</span> (Paid: ₹{selectedBill.paid_amount.toFixed(2)})</div>
              <div><strong>Billed By:</strong> {selectedBill.creator_name || "Counter Staff"}</div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", fontSize: "9.5px" }}>
            <thead>
              <tr style={{ background: "#000", color: "#fff", borderTop: "1px solid #000", borderBottom: "1px solid #000", textAlign: "left" }}>
                <th style={{ padding: "4px 3px", width: "22px", textAlign: "center", borderRight: "1px solid #333" }}>#</th>
                <th style={{ padding: "4px 4px", borderRight: "1px solid #333" }}>Item Description</th>
                <th style={{ padding: "4px 3px", textAlign: "center", width: "42px", borderRight: "1px solid #333" }}>HSN</th>
                <th style={{ padding: "4px 3px", textAlign: "right", width: "35px", borderRight: "1px solid #333" }}>Qty</th>
                <th style={{ padding: "4px 3px", textAlign: "right", width: "48px", borderRight: "1px solid #333" }}>Rate</th>
                <th style={{ padding: "4px 3px", textAlign: "right", width: "52px", borderRight: "1px solid #333" }}>Taxable</th>
                <th style={{ padding: "4px 3px", textAlign: "right", width: "36px", borderRight: "1px solid #333" }}>GST</th>
                <th style={{ padding: "4px 4px", textAlign: "right", width: "62px" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(selectedBill.items || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                  <td style={{ padding: "3px 4px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#000" }}>
                    {item.item_name}
                    {item.is_tax_inclusive && <span style={{ fontSize: "8px", color: "#555", marginLeft: "4px" }}>(Incl.)</span>}
                  </td>
                  <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#444" }}>{item.hsn_code || "—"}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.quantity} {item.unit || "pcs"}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.rate.toFixed(2)}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.taxable_amount.toFixed(2)}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.gst_rate}%</td>
                  <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: "bold", color: "#000" }}>{item.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Tax Breakdown Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "8px", border: "1px solid #000", padding: "6px 8px", marginBottom: "6px", fontSize: "10px", background: "#fcfcfc" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555", marginBottom: "2px" }}>Amount in Words:</div>
                <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "#111", fontWeight: 500 }}>
                  {numberToWordsINR(selectedBill.total_amount || 0)}
                </div>
              </div>
              <div style={{ marginTop: "6px", fontSize: "8px", color: "#555" }}>
                <strong>Declaration:</strong> Certified that the particulars given above are true and correct.
              </div>
            </div>

            <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span>Taxable Amount:</span>
                <span>₹{selectedBill.taxable_amount.toFixed(2)}</span>
              </div>
              {selectedBill.discount_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#000", marginBottom: "2px" }}>
                  <span>Discount:</span>
                  <span>-₹{selectedBill.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {selectedBill.cgst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>CGST:</span>
                  <span>₹{selectedBill.cgst_amount.toFixed(2)}</span>
                </div>
              )}
              {selectedBill.sgst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>SGST:</span>
                  <span>₹{selectedBill.sgst_amount.toFixed(2)}</span>
                </div>
              )}
              {selectedBill.igst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>IGST:</span>
                  <span>₹{selectedBill.igst_amount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid #000", paddingTop: "3px", marginTop: "3px", fontSize: "12px", fontWeight: "bold", color: "#000" }}>
                <span>Grand Total:</span>
                <span>₹{selectedBill.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "10px", paddingTop: "6px", borderTop: "1px dashed #ccc", fontSize: "9.5px" }}>
            <div style={{ textAlign: "center", width: "130px" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>Customer's Signature</div>
            </div>
            <div style={{ textAlign: "center", width: "150px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "14px" }}>For {tenant?.business_name || "Company"}</div>
              <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>Authorized Signatory</div>
            </div>
          </div>
        </div>
      )}

      {/* --- BATCH COMBINED PRINTABLE CONTAINER (MULTIPLE SELECTED BILLS) --- */}
      {selectedBillIds.length > 0 && (
        <div className="print-batch-sheet" style={{ width: "100%", maxWidth: "100%", margin: "0", padding: "0", background: "#fff", color: "#000" }}>
          {selectedBillIds.map((billId, billIdx) => {
            const b = bills.find((item) => item.id === billId);
            if (!b) return null;
            return (
              <div key={b.id} className={billIdx < selectedBillIds.length - 1 ? "print-page-break" : ""} style={{ width: "100%", padding: "2mm 4mm", boxSizing: "border-box", marginBottom: "4mm" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "5px", marginBottom: "6px" }}>
                  <div style={{ maxWidth: "62%" }}>
                    <h2 style={{ margin: "0 0 2px 0", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", color: "#000" }}>
                      {tenant?.business_name || "RETAIL STORE"}
                    </h2>
                    {tenant?.legal_name && tenant?.legal_name !== tenant?.business_name && (
                      <div style={{ fontSize: "9.5px", color: "#333", marginBottom: "2px" }}>({tenant.legal_name})</div>
                    )}
                    <div style={{ fontSize: "9.5px", lineHeight: "1.3", color: "#111" }}>
                      <div><strong>Address:</strong> {tenant?.address ? `${tenant.address}${tenant.city ? `, ${tenant.city}` : ""}${tenant.state ? `, ${tenant.state}` : ""}${tenant.pincode ? ` - ${tenant.pincode}` : ""}` : "Store Address"}</div>
                      <div><strong>Phone:</strong> {tenant?.phone || "—"} &bull; <strong>GSTIN:</strong> {tenant?.gst_number || "Unregistered"}</div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "right", maxWidth: "38%" }}>
                    <div style={{ background: "#000", color: "#fff", padding: "2px 8px", fontSize: "11px", fontWeight: "bold", display: "inline-block", letterSpacing: "1px", marginBottom: "3px" }}>
                      TAX INVOICE
                    </div>
                    <div style={{ fontSize: "9.5px", lineHeight: "1.35", color: "#111" }}>
                      <div><strong>Invoice No:</strong> {b.bill_number}</div>
                      <div><strong>Date:</strong> {new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <div><strong>Supply:</strong> {b.is_interstate ? "Inter-State (IGST)" : "Intra-State"}</div>
                    </div>
                  </div>
                </div>

                {/* Bill To & Payment Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", border: "1px solid #000", padding: "5px 8px", marginBottom: "6px", fontSize: "10px", lineHeight: "1.35", background: "#fcfcfc" }}>
                  <div>
                    <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>BILLED TO (CUSTOMER):</div>
                    <div style={{ fontSize: "11.5px", fontWeight: "bold", color: "#000" }}>{b.party_name || "Cash Customer"}</div>
                    <div><strong>Address:</strong> {b.party_address || "—"}</div>
                    <div><strong>Phone:</strong> {b.party_mobile || "—"} &bull; <strong>GSTIN:</strong> {b.party_gst || "—"}</div>
                  </div>
                  <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
                    <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>PAYMENT & BILLING:</div>
                    <div><strong>Payment Mode:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{b.payment_mode === "credit" ? "CREDIT" : "CASH"}</span></div>
                    <div><strong>Payment Status:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{b.payment_status}</span> (Paid: ₹{b.paid_amount.toFixed(2)})</div>
                    <div><strong>Billed By:</strong> {b.creator_name || "Counter Staff"}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", fontSize: "9.5px" }}>
                  <thead>
                    <tr style={{ background: "#000", color: "#fff", borderTop: "1px solid #000", borderBottom: "1px solid #000", textAlign: "left" }}>
                      <th style={{ padding: "4px 3px", width: "22px", textAlign: "center", borderRight: "1px solid #333" }}>#</th>
                      <th style={{ padding: "4px 4px", borderRight: "1px solid #333" }}>Item Description</th>
                      <th style={{ padding: "4px 3px", textAlign: "center", width: "42px", borderRight: "1px solid #333" }}>HSN</th>
                      <th style={{ padding: "4px 3px", textAlign: "right", width: "35px", borderRight: "1px solid #333" }}>Qty</th>
                      <th style={{ padding: "4px 3px", textAlign: "right", width: "48px", borderRight: "1px solid #333" }}>Rate</th>
                      <th style={{ padding: "4px 3px", textAlign: "right", width: "52px", borderRight: "1px solid #333" }}>Taxable</th>
                      <th style={{ padding: "4px 3px", textAlign: "right", width: "36px", borderRight: "1px solid #333" }}>GST</th>
                      <th style={{ padding: "4px 4px", textAlign: "right", width: "62px" }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(b.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "3px 4px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#000" }}>
                          {item.item_name}
                          {item.is_tax_inclusive && <span style={{ fontSize: "8px", color: "#555", marginLeft: "4px" }}>(Incl.)</span>}
                        </td>
                        <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#444" }}>{item.hsn_code || "—"}</td>
                        <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.quantity} {item.unit || "pcs"}</td>
                        <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.rate.toFixed(2)}</td>
                        <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.taxable_amount.toFixed(2)}</td>
                        <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.gst_rate}%</td>
                        <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: "bold", color: "#000" }}>{item.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals & Tax Breakdown Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "8px", border: "1px solid #000", padding: "6px 8px", marginBottom: "6px", fontSize: "10px", background: "#fcfcfc" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555", marginBottom: "2px" }}>Amount in Words:</div>
                      <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "#111", fontWeight: 500 }}>
                        {numberToWordsINR(b.total_amount || 0)}
                      </div>
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "8px", color: "#555" }}>
                      <strong>Declaration:</strong> Certified that the particulars given above are true and correct.
                    </div>
                  </div>

                  <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span>Taxable Amount:</span>
                      <span>₹{b.taxable_amount.toFixed(2)}</span>
                    </div>
                    {b.discount_amount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#000", marginBottom: "2px" }}>
                        <span>Discount:</span>
                        <span>-₹{b.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {b.cgst_amount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span>CGST:</span>
                        <span>₹{b.cgst_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {b.sgst_amount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span>SGST:</span>
                        <span>₹{b.sgst_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {b.igst_amount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span>IGST:</span>
                        <span>₹{b.igst_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid #000", paddingTop: "3px", marginTop: "3px", fontSize: "12px", fontWeight: "bold", color: "#000" }}>
                      <span>Grand Total:</span>
                      <span>₹{b.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "10px", paddingTop: "6px", borderTop: "1px dashed #ccc", fontSize: "9.5px" }}>
                  <div style={{ textAlign: "center", width: "130px" }}>
                    <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>Customer's Signature</div>
                  </div>
                  <div style={{ textAlign: "center", width: "150px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "14px" }}>For {tenant?.business_name || "Company"}</div>
                    <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>Authorized Signatory</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- PRINTABLE THERMAL RECEIPT CONTAINER --- */}
      {selectedBill && printFormat === "thermal" && (
        <div className="print-thermal" style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px", width: "300px", margin: "0 auto" }}>
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
              <span style={{ textTransform: "uppercase" }}>{selectedBill.payment_mode === "credit" ? "Credit" : "Cash"}</span>
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
