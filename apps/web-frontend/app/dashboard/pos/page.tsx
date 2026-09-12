"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Receipt,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  Share2,
  PauseCircle,
  PlayCircle,
  Wifi,
  WifiOff,
  CreditCard,
  QrCode,
  IndianRupee,
  UserCheck,
  UserPlus,
  X,
  Loader2,
  Tag,
  Percent,
  Phone,
  Building,
  Calendar,
  FileText,
} from "lucide-react";

interface POSItem {
  item_id?: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  rate: number;
  purchase_price?: number;
  discount_amount: number;
  gst_rate: number;
  is_tax_inclusive: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export default function POSPage() {
  const { user, tenant, isAdmin } = useAuth();

  // Catalog & Search
  const [catalog, setCatalog] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Cart / Bill State
  const [billItems, setBillItems] = useState<POSItem[]>([]);
  const [partyType, setPartyType] = useState<"cash" | "customer">("cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in Cash Customer");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerGst, setCustomerGst] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerBalance, setCustomerBalance] = useState<number>(0);
  const [isInterstate, setIsInterstate] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("cash");
  const [notes, setNotes] = useState("");

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

  // Customer Quick-Add Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    mobile: "",
    gst_number: "",
    address: "",
    state: "Maharashtra",
  });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerSearchFilter, setCustomerSearchFilter] = useState("");

  // Drafts (Hold / Resume)
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Network & Sync State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Completed Bill Modal
  const [completedBill, setCompletedBill] = useState<any>(null);
  const [whatsAppData, setWhatsAppData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [printFormat, setPrintFormat] = useState<"thermal" | "half_a4">("half_a4");

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load & Offline queue checks
  const fetchCustomers = async () => {
    try {
      const res = await api.get("/parties/customers");
      setCustomers(res.data);
    } catch (e) {
      console.error("Failed to load customers:", e);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await api.get("/items");
      setCatalog(res.data);
    } catch (e) {
      console.error("Failed to load catalog:", e);
    }
  };

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        syncOfflineQueue();
      }
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    setIsOnline(navigator.onLine);

    try {
      const savedHeld = localStorage.getItem("pos_held_bills");
      if (savedHeld) setHeldBills(JSON.parse(savedHeld));

      const savedQueue = localStorage.getItem("pos_offline_queue");
      if (savedQueue) setOfflineQueueCount(JSON.parse(savedQueue).length);
    } catch (e) {}

    fetchCatalog();
    fetchCustomers();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // 2. Offline Sync Function
  const syncOfflineQueue = async () => {
    try {
      const savedQueue = localStorage.getItem("pos_offline_queue");
      if (!savedQueue) return;
      const queue = JSON.parse(savedQueue);
      if (queue.length === 0) return;

      const res = await api.post("/bills/sync", { bills: queue });
      if (res.data.synced_count > 0) {
        localStorage.removeItem("pos_offline_queue");
        setOfflineQueueCount(0);
      }
    } catch (e) {
      console.error("Offline sync error:", e);
    }
  };

  // 3. Tax & Line Item Calculations (Handles Tax Inclusive & Exclusive)
  const calculateLineItem = (
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
      // GST INCLUDED IN PRICE (MRP reverse extraction)
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
      // GST EXCLUSIVE (Added on top)
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

  const addItemToCart = (product: any) => {
    setBillItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.item_id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = current.quantity + 1;
        const calc = calculateLineItem(
          {
            rate: current.rate,
            quantity: newQty,
            discount_amount: current.discount_amount,
            gst_rate: current.gst_rate,
            is_tax_inclusive: current.is_tax_inclusive,
          },
          isInterstate
        );
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          taxable_amount: calc.taxable,
          cgst_amount: calc.cgst,
          sgst_amount: calc.sgst,
          igst_amount: calc.igst,
          total_amount: calc.total,
        };
        return updated;
      } else {
        const isTaxInc = product.is_tax_inclusive || false;
        const calc = calculateLineItem(
          {
            rate: product.sale_price,
            quantity: 1,
            discount_amount: 0,
            gst_rate: product.gst_rate,
            is_tax_inclusive: isTaxInc,
          },
          isInterstate
        );
        const newItem: POSItem = {
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
        return [...prev, newItem];
      }
    });
  };

  const toggleItemTaxInclusive = (idx: number) => {
    setBillItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const newInc = !item.is_tax_inclusive;
      const calc = calculateLineItem(
        {
          rate: item.rate,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: newInc,
        },
        isInterstate
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

  const updateItemQty = (idx: number, delta: number) => {
    setBillItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      const calc = calculateLineItem(
        {
          rate: item.rate,
          quantity: newQty,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: item.is_tax_inclusive,
        },
        isInterstate
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

  const updateItemRate = (idx: number, newRate: number) => {
    setBillItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const calc = calculateLineItem(
        {
          rate: newRate,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
          gst_rate: item.gst_rate,
          is_tax_inclusive: item.is_tax_inclusive,
        },
        isInterstate
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

  const updateItemPurchasePrice = (idx: number, newPurchasePrice: number) => {
    setBillItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        purchase_price: newPurchasePrice,
      };
      return updated;
    });
  };

  const removeItem = (idx: number) => {
    setBillItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 4. Barcode Scan Handler
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const match = catalog.find((c) => c.barcode === barcodeInput.trim());
    if (match) {
      addItemToCart(match);
      setBarcodeInput("");
      return;
    }

    try {
      const res = await api.get(`/items/barcode/${barcodeInput.trim()}`);
      if (res.data) {
        addItemToCart(res.data);
      } else {
        alert(`No product found with barcode: ${barcodeInput}`);
      }
    } catch (e) {
      alert(`Barcode search failed: ${barcodeInput}`);
    } finally {
      setBarcodeInput("");
    }
  };

  // 5. Totals Calculation
  const subtotal = billItems.reduce((acc, i) => acc + i.taxable_amount, 0);
  const discountVal = parseFloat(overallDiscount) || 0;
  const taxableVal = Math.max(0, subtotal - discountVal);
  const totalCgst = billItems.reduce((acc, i) => acc + i.cgst_amount, 0);
  const totalSgst = billItems.reduce((acc, i) => acc + i.sgst_amount, 0);
  const totalIgst = billItems.reduce((acc, i) => acc + i.igst_amount, 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const rawTotal = taxableVal + totalGst;
  const grandTotal = Math.round(rawTotal);
  const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;

  // 6. Customer Selection & Quick Add
  const handleSelectCustomer = (cust: any) => {
    if (!cust) {
      setPartyType("cash");
      setSelectedCustomerId("");
      setCustomerName("Walk-in Cash Customer");
      setCustomerMobile("");
      setCustomerGst("");
      setCustomerAddress("");
      setCustomerState("");
      setCustomerBalance(0);
      return;
    }
    setPartyType("customer");
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerMobile(cust.mobile || "");
    setCustomerGst(cust.gst_number || "");
    setCustomerAddress(cust.billing_address || "");
    setCustomerState(cust.state || "");
    setCustomerBalance(cust.current_balance || 0);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;
    setIsAddingCustomer(true);
    try {
      const res = await api.post("/parties/customers", {
        name: newCustomerForm.name.trim(),
        mobile: newCustomerForm.mobile.trim() || undefined,
        gst_number: newCustomerForm.gst_number.trim() || undefined,
        billing_address: newCustomerForm.address.trim() || undefined,
        state: newCustomerForm.state,
      });
      await fetchCustomers();
      handleSelectCustomer(res.data);
      setShowAddCustomerModal(false);
      setNewCustomerForm({ name: "", mobile: "", gst_number: "", address: "", state: "Maharashtra" });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create customer");
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // 7. Hold / Resume Bill
  const holdCurrentBill = () => {
    if (billItems.length === 0) return;
    const draft = {
      id: Date.now().toString(),
      customerName,
      customerMobile,
      selectedCustomerId,
      partyType,
      billItems,
      isInterstate,
      overallDiscount,
      paymentMode,
      date: new Date().toLocaleTimeString("en-IN"),
    };
    const updated = [...heldBills, draft];
    setHeldBills(updated);
    localStorage.setItem("pos_held_bills", JSON.stringify(updated));
    resetCart();
  };

  const resumeDraft = (draft: any) => {
    setCustomerName(draft.customerName);
    setCustomerMobile(draft.customerMobile);
    setSelectedCustomerId(draft.selectedCustomerId || "");
    setPartyType(draft.partyType || "cash");
    setBillItems(draft.billItems);
    setIsInterstate(draft.isInterstate);
    setOverallDiscount(draft.overallDiscount);
    setPaymentMode(draft.paymentMode);

    const updated = heldBills.filter((b) => b.id !== draft.id);
    setHeldBills(updated);
    localStorage.setItem("pos_held_bills", JSON.stringify(updated));
    setShowHeldModal(false);
  };

  const resetCart = () => {
    setBillItems([]);
    setCustomerName("Walk-in Cash Customer");
    setCustomerMobile("");
    setCustomerGst("");
    setCustomerBalance(0);
    setPartyType("cash");
    setSelectedCustomerId("");
    setOverallDiscount("0");
    setPaymentMode("cash");
    setNotes("");
    setCompletedBill(null);
    setWhatsAppData(null);
  };

  // 8. Complete Checkout / Create Bill
  const handleCheckout = async () => {
    if (billItems.length === 0) {
      alert("Cart is empty. Add products before completing checkout.");
      return;
    }

    setIsSubmitting(true);
    const offlineSyncId = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      type: "sale",
      party_id: partyType === "customer" && selectedCustomerId ? selectedCustomerId : undefined,
      party_name: customerName,
      party_mobile: customerMobile || undefined,
      party_gst: customerGst || undefined,
      party_address: partyType === "customer" ? customerAddress : undefined,
      is_interstate: isInterstate,
      discount_amount: discountVal,
      payment_mode: paymentMode,
      payment_status: paymentMode === "credit" ? "unpaid" : "paid",
      paid_amount: paymentMode === "credit" ? 0 : grandTotal,
      notes: notes || undefined,
      offline_sync_id: offlineSyncId,
      items: billItems.map((i) => ({
        item_id: i.item_id,
        item_name: i.item_name,
        hsn_code: i.hsn_code,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        purchase_price: i.purchase_price ?? 0,
        discount_amount: i.discount_amount,
        gst_rate: i.gst_rate,
        is_tax_inclusive: i.is_tax_inclusive,
      })),
    };

    if (!isOnline) {
      const existingQueue = JSON.parse(localStorage.getItem("pos_offline_queue") || "[]");
      existingQueue.push(payload);
      localStorage.setItem("pos_offline_queue", JSON.stringify(existingQueue));
      setOfflineQueueCount(existingQueue.length);

      setCompletedBill({
        bill_number: "OFFLINE-QUEUED",
        total_amount: grandTotal,
        payment_mode: paymentMode,
        is_offline: true,
        items: billItems,
        party_name: customerName,
        party_mobile: customerMobile,
        party_address: customerAddress,
        party_gst: customerGst,
        created_at: new Date().toISOString(),
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.post("/bills", payload);
      setCompletedBill(res.data);

      // Refresh customers to update balance if credit sale
      if (partyType === "customer") {
        fetchCustomers();
      }

      // Fetch WhatsApp share payload
      try {
        const waRes = await api.post(`/bills/${res.data.id}/share-whatsapp`);
        setWhatsAppData(waRes.data);
      } catch (e) {}
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Checkout failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 9. PDF Download with Auth Token
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
      alert("Failed to download PDF invoice. Please check backend connection.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintBill = (format: "thermal" | "half_a4" = "half_a4") => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const categories = ["All", "Groceries", "Beverages", "Snacks", "Dairy", "Pharmacy", "Electronics", "General"];
  const filteredCatalog = catalog.filter((c) => {
    const matchCat = selectedCategory === "All" || c.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.barcode && c.barcode.includes(searchQuery)) ||
      (c.sku && c.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearchFilter ||
      c.name.toLowerCase().includes(customerSearchFilter.toLowerCase()) ||
      (c.mobile && c.mobile.includes(customerSearchFilter))
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "20px", height: "calc(100vh - 110px)" }} className="no-print">
        {/* LEFT COLUMN: Catalog & Barcode Scanner */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
          {/* Top Controls */}
          <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", gap: "10px", alignItems: "center" }}>
            <form onSubmit={handleBarcodeSubmit} style={{ display: "flex", gap: "8px", flex: 1 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  className="input-field"
                  placeholder="Scan Barcode (Enter)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  style={{ paddingLeft: "34px", borderColor: "#38bdf8", fontSize: "0.875rem" }}
                />
                <Barcode size={16} color="#38bdf8" style={{ position: "absolute", left: "10px", top: "11px" }} />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                Add
              </button>
            </form>

            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search name / item code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "34px", fontSize: "0.875rem" }}
              />
              <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "11px" }} />
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  background: selectedCategory === c ? "#2563eb" : "rgba(30, 41, 59, 0.4)",
                  color: selectedCategory === c ? "#ffffff" : "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div
            className="glass-panel"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gridAutoRows: "max-content",
              gap: "10px",
            }}
          >
            {filteredCatalog.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No matching items. Add items in <strong>Product Master</strong>.
              </div>
            ) : (
              filteredCatalog.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addItemToCart(p)}
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform 0.1s ease, border-color 0.1s ease",
                  }}
                  className="hover-card"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#f8fafc", lineHeight: 1.2, marginBottom: "4px" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {p.category} &bull; {p.unit}
                    </div>
                  </div>

                  <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#34d399" }}>
                        ₹{p.sale_price.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: p.is_tax_inclusive ? "#60a5fa" : "var(--text-muted)" }}>
                        {p.is_tax_inclusive ? "Tax Incl." : `+${p.gst_rate}% GST`}
                      </div>
                    </div>
                    <span style={{ background: "#2563eb", borderRadius: "4px", padding: "2px 6px", fontSize: "0.7rem", color: "white" }}>
                      +Add
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: POS Checkout & Cart */}
        <div className="glass-panel" style={{ display: "flex", flexDirection: "column", padding: "16px", height: "100%", overflow: "hidden" }}>
          {/* Header & Customer Bar */}
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Receipt size={18} color="#38bdf8" />
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>Counter Checkout</span>
              </div>

              {/* Status & Draft Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isOnline ? (
                  <span className="badge badge-success" style={{ fontSize: "0.7rem" }}><Wifi size={12} /> Live</span>
                ) : (
                  <span className="badge" style={{ background: "#f59e0b", color: "#000", fontSize: "0.7rem" }}><WifiOff size={12} /> Offline ({offlineQueueCount})</span>
                )}

                {heldBills.length > 0 && (
                  <button onClick={() => setShowHeldModal(true)} className="btn-secondary" style={{ padding: "3px 8px", fontSize: "0.75rem", color: "#f59e0b" }}>
                    <PlayCircle size={12} /> Held ({heldBills.length})
                  </button>
                )}
                <button onClick={holdCurrentBill} disabled={billItems.length === 0} className="btn-secondary" style={{ padding: "3px 8px", fontSize: "0.75rem" }}>
                  <PauseCircle size={12} /> Hold
                </button>
              </div>
            </div>

            {/* Customer Selector Dropdown + Quick Add (Admin Only) */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select
                  className="input-field"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value);
                    handleSelectCustomer(cust);
                  }}
                  style={{ fontSize: "0.85rem", padding: "6px 10px", height: "36px" }}
                >
                  <option value="">👤 Walk-in Cash Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mobile ? `• 📱 ${c.mobile}` : ""} {c.gst_number ? `• 🆔 GST: ${c.gst_number}` : ""} {c.billing_address ? `• 📍 ${c.billing_address}` : ""} • 💰 Credit Due: ₹{c.current_balance?.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="btn-secondary"
                  style={{ padding: "6px 10px", fontSize: "0.8rem", whiteSpace: "nowrap", height: "36px" }}
                  title="Admin: Create New Customer"
                >
                  <UserPlus size={14} /> + New
                </button>
              )}
            </div>

            {/* Selected Customer Info Badge with Name, Address, GSTIN, Mobile, and Credit Due */}
            {selectedCustomerId && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "0.775rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "0.85rem", color: "#f8fafc" }}>👤 {customerName}</strong>
                    {customerMobile && <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>📱 {customerMobile}</span>}
                  </div>
                  <div style={{ color: customerBalance > 0 ? "#f87171" : "#34d399", fontWeight: 700 }}>
                    Credit Due: ₹{customerBalance.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "0.725rem", flexWrap: "wrap", gap: "6px" }}>
                  <div>📍 Address: <span style={{ color: "#f1f5f9" }}>{customerAddress ? `${customerAddress}${customerState ? `, ${customerState}` : ""}` : "No address registered"}</span></div>
                  <div>🆔 GSTIN: <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>{customerGst || "Unregistered"}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
            {billItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Cart is empty. Click items on the left or scan barcode.
              </div>
            ) : (
              billItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#f8fafc" }}>{item.item_name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                          <span>Sell ₹:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.rate}
                            onChange={(e) => updateItemRate(idx, parseFloat(e.target.value) || 0)}
                            style={{
                              width: "72px",
                              padding: "2px 6px",
                              fontSize: "0.75rem",
                              background: "rgba(15, 23, 42, 0.9)",
                              border: "1px solid rgba(56, 189, 248, 0.5)",
                              borderRadius: "4px",
                              color: "#38bdf8",
                              fontWeight: 600,
                            }}
                            title="Edit Selling Price / Unit Rate"
                          />
                        </label>
                        {isAdmin && (
                          <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <span>Cost ₹:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.purchase_price ?? 0}
                              onChange={(e) => updateItemPurchasePrice(idx, parseFloat(e.target.value) || 0)}
                              style={{
                                width: "72px",
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                background: "rgba(15, 23, 42, 0.9)",
                                border: "1px solid rgba(245, 158, 11, 0.5)",
                                borderRadius: "4px",
                                color: "#f59e0b",
                                fontWeight: 600,
                              }}
                              title="Admin: Edit Purchase / Cost Price"
                            />
                          </label>
                        )}
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          &bull; {item.gst_rate}% GST
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#34d399" }}>
                        ₹{item.total_amount.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                        Tax: ₹{(item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    {/* GST Inclusive / Exclusive Toggle for Item */}
                    <button
                      type="button"
                      onClick={() => toggleItemTaxInclusive(idx)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: item.is_tax_inclusive ? "rgba(59, 130, 246, 0.2)" : "rgba(100, 116, 139, 0.2)",
                        color: item.is_tax_inclusive ? "#60a5fa" : "#94a3b8",
                      }}
                      title="Toggle Tax Inclusive / Exclusive"
                    >
                      {item.is_tax_inclusive ? "Tax Inclusive (MRP)" : "Tax Exclusive"}
                    </button>

                    {/* Qty Stepper */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button onClick={() => updateItemQty(idx, -1)} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid var(--border)", borderRadius: "4px", width: "22px", height: "22px", color: "#fff", cursor: "pointer" }}>
                        -
                      </button>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <button onClick={() => updateItemQty(idx, 1)} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid var(--border)", borderRadius: "4px", width: "22px", height: "22px", color: "#fff", cursor: "pointer" }}>
                        +
                      </button>
                      <button onClick={() => removeItem(idx)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "4px" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Payment Section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Taxable Subtotal:</span>
              <span>₹{taxableVal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Total GST ({isInterstate ? "IGST" : "CGST+SGST"}):</span>
              <span>₹{totalGst.toFixed(2)}</span>
            </div>
            {roundOff !== 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                <span>Round Off:</span>
                <span>₹{roundOff.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc", margin: "6px 0" }}>
              <span>Grand Total:</span>
              <span style={{ color: "#34d399" }}>₹{grandTotal.toFixed(2)}</span>
            </div>

            {/* Payment Mode Selector - ONLY CASH & CREDIT */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "10px 0" }}>
              <button
                type="button"
                onClick={() => setPaymentMode("cash")}
                style={{
                  padding: "10px 8px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  border: paymentMode === "cash" ? "2px solid #10b981" : "1px solid var(--border)",
                  background: paymentMode === "cash" ? "rgba(16, 185, 129, 0.25)" : "rgba(30, 41, 59, 0.4)",
                  color: paymentMode === "cash" ? "#34d399" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                💵 CASH
              </button>

              <button
                type="button"
                onClick={() => {
                  if (partyType !== "customer" || !selectedCustomerId) {
                    alert("Please select or add a Customer above to create a Credit bill.");
                    setShowAddCustomerModal(true);
                    return;
                  }
                  setPaymentMode("credit");
                }}
                style={{
                  padding: "10px 8px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  border: paymentMode === "credit" ? "2px solid #f59e0b" : "1px solid var(--border)",
                  background: paymentMode === "credit" ? "rgba(245, 158, 11, 0.25)" : "rgba(30, 41, 59, 0.4)",
                  color: paymentMode === "credit" ? "#fbbf24" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                📒 CREDIT
              </button>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || billItems.length === 0}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", background: "#10b981", borderColor: "#059669", fontSize: "1rem" }}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : `Complete Sale & Print (₹${grandTotal})`}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "420px", padding: "24px", borderRadius: "12px", background: "#0f172a" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Add New Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="input-label">Customer Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Mobile Number (10 Digits)</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="9876543210"
                  value={newCustomerForm.mobile}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, mobile: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">GSTIN (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="27ABCDE1234F1Z5"
                  value={newCustomerForm.gst_number}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, gst_number: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Billing Address (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Shop / House No, Street, City"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isAddingCustomer} className="btn-primary">
                  {isAddingCustomer ? <Loader2 className="animate-spin" size={16} /> : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="modal-overlay" onClick={() => setShowHeldModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "460px", padding: "24px", borderRadius: "12px", background: "#0f172a" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Held Bills Queue ({heldBills.length})</h3>
              <button onClick={() => setShowHeldModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {heldBills.map((draft) => (
                <div key={draft.id} style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{draft.customerName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{draft.billItems.length} items &bull; Time: {draft.date}</div>
                  </div>
                  <button onClick={() => resumeDraft(draft)} className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed Bill Success Modal */}
      {completedBill && (
        <div className="modal-overlay no-print">
          <div className="glass-panel" style={{ width: "100%", maxWidth: "460px", padding: "28px", borderRadius: "14px", background: "#0f172a", textAlign: "center" }}>
            <CheckCircle2 size={50} color="#34d399" style={{ margin: "0 auto 10px" }} />
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: "4px" }}>
              Sale Completed Successfully!
            </h2>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Invoice No: <strong style={{ color: "#38bdf8" }}>{completedBill.bill_number}</strong> &bull; Total: <strong style={{ color: "#34d399" }}>₹{completedBill.total_amount?.toFixed(2)}</strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "16px 0" }}>
              {/* Direct Print Half A4 */}
              <button
                type="button"
                onClick={() => handlePrintBill("half_a4")}
                className="btn-primary"
                style={{ width: "100%", padding: "10px", background: "#0284c7", borderColor: "#0369a1", fontSize: "0.95rem" }}
              >
                <Printer size={16} /> Print Half-A4 (A5) Professional Bill
              </button>

              {/* Direct Print Thermal */}
              <button
                type="button"
                onClick={() => handlePrintBill("thermal")}
                className="btn-secondary"
                style={{ width: "100%", padding: "9px", fontSize: "0.9rem" }}
              >
                <Receipt size={16} /> Print Thermal POS Receipt
              </button>

              {/* PDF Download Buttons */}
              {completedBill.id && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(completedBill.id, completedBill.bill_number, "a5")}
                    disabled={isDownloadingPdf}
                    className="btn-secondary"
                    style={{ padding: "9px 6px", fontSize: "0.825rem", justifyContent: "center" }}
                  >
                    {isDownloadingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} color="#a855f7" />} Half-A4 PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(completedBill.id, completedBill.bill_number, "a4")}
                    disabled={isDownloadingPdf}
                    className="btn-secondary"
                    style={{ padding: "9px 6px", fontSize: "0.825rem", justifyContent: "center" }}
                  >
                    {isDownloadingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} color="#60a5fa" />} Full A4 PDF
                  </button>
                </div>
              )}

              {/* WhatsApp Share Button */}
              {whatsAppData && (
                <a
                  href={whatsAppData.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ width: "100%", padding: "9px", justifyContent: "center", background: "#065f46", color: "#34d399", borderColor: "#059669", fontSize: "0.85rem" }}
                >
                  <Share2 size={15} /> Share Invoice on WhatsApp
                </a>
              )}
            </div>

            <button onClick={resetCart} className="btn-secondary" style={{ width: "100%", padding: "10px", fontSize: "0.9rem" }}>
              + Next Counter Sale
            </button>
          </div>
        </div>
      )}

      {/* --- PRINTABLE HALF-A4 PROFESSIONAL BILL CONTAINER --- */}
      {completedBill && printFormat === "half_a4" && (
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
                <div><strong>Invoice No:</strong> {completedBill.bill_number}</div>
                <div><strong>Date:</strong> {new Date(completedBill.created_at || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div><strong>Time:</strong> {new Date(completedBill.created_at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div><strong>Place of Supply:</strong> {completedBill.is_interstate ? "Inter-State (IGST)" : "Intra-State"}</div>
              </div>
            </div>
          </div>

          {/* Bill To (Customer Details) & Payment Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", border: "1px solid #000", padding: "5px 8px", marginBottom: "6px", fontSize: "10px", lineHeight: "1.35", background: "#fcfcfc" }}>
            <div>
              <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>BILLED TO (CUSTOMER):</div>
              <div style={{ fontSize: "11.5px", fontWeight: "bold", color: "#000" }}>{completedBill.party_name || customerName}</div>
              <div><strong>Address:</strong> {completedBill.party_address || customerAddress || "—"}</div>
              <div><strong>Phone:</strong> {completedBill.party_mobile || customerMobile || "—"} &bull; <strong>GSTIN:</strong> {completedBill.party_gst || customerGst || "—"}</div>
            </div>
            <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
              <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>PAYMENT & BILLING:</div>
              <div><strong>Payment Mode:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{completedBill.payment_mode === "credit" ? "CREDIT" : "CASH"}</span></div>
              <div><strong>Payment Status:</strong> <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{completedBill.payment_status || "PAID"}</span></div>
              <div><strong>Billed By:</strong> {user?.name || "Counter Staff"}</div>
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
              {(completedBill.items || []).map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                  <td style={{ padding: "3px 4px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#000" }}>
                    {item.item_name}
                    {item.is_tax_inclusive && <span style={{ fontSize: "8px", color: "#555", marginLeft: "4px" }}>(Incl.)</span>}
                  </td>
                  <td style={{ padding: "3px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#444" }}>{item.hsn_code || "—"}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.quantity} {item.unit || "pcs"}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.rate.toFixed(2)}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{(item.taxable_amount || (item.quantity * item.rate)).toFixed(2)}</td>
                  <td style={{ padding: "3px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{item.gst_rate}%</td>
                  <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: "bold", color: "#000" }}>{item.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Tax Breakdown Grid */}
          <div className="print-totals-block" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "8px", border: "1px solid #000", padding: "6px 8px", marginBottom: "6px", fontSize: "10px", background: "#fcfcfc", pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#555", marginBottom: "2px" }}>Amount in Words:</div>
                <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "#111", fontWeight: 500 }}>
                  {numberToWordsINR(completedBill.total_amount || 0)}
                </div>
              </div>
              <div style={{ marginTop: "6px", fontSize: "8px", color: "#555" }}>
                <strong>Declaration:</strong> Certified that the particulars given above are true and correct.
              </div>
            </div>

            <div style={{ borderLeft: "1px solid #ccc", paddingLeft: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span>Taxable Amount:</span>
                <span>₹{(completedBill.taxable_amount || completedBill.subtotal || 0).toFixed(2)}</span>
              </div>
              {completedBill.discount_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#000", marginBottom: "2px" }}>
                  <span>Discount:</span>
                  <span>-₹{completedBill.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {completedBill.cgst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>CGST:</span>
                  <span>₹{completedBill.cgst_amount.toFixed(2)}</span>
                </div>
              )}
              {completedBill.sgst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>SGST:</span>
                  <span>₹{completedBill.sgst_amount.toFixed(2)}</span>
                </div>
              )}
              {completedBill.igst_amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>IGST:</span>
                  <span>₹{completedBill.igst_amount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid #000", paddingTop: "3px", marginTop: "3px", fontSize: "12px", fontWeight: "bold", color: "#000" }}>
                <span>Grand Total:</span>
                <span>₹{(completedBill.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="print-signature-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "10px", paddingTop: "6px", borderTop: "1px dashed #ccc", fontSize: "9.5px", pageBreakInside: "avoid", breakInside: "avoid" }}>
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

      {/* --- PRINTABLE THERMAL RECEIPT --- */}
      {completedBill && printFormat === "thermal" && (
        <div className="print-thermal" style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px", width: "300px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
            <h3 style={{ fontSize: "16px", margin: 0 }}>{tenant?.business_name || "RETAIL STORE"}</h3>
            {tenant?.gst_number && <div>GSTIN: {tenant.gst_number}</div>}
            <div>TAX INVOICE</div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
            <div>Inv #: {completedBill.bill_number}</div>
            <div>Date: {new Date(completedBill.created_at || Date.now()).toLocaleString("en-IN")}</div>
            <div>Cust: {completedBill.party_name || "Cash Customer"}</div>
            {completedBill.party_mobile && <div>Phone: {completedBill.party_mobile}</div>}
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
              {(completedBill.items || []).map((item: any, i: number) => (
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
              <span>₹{(completedBill.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>GST Total:</span>
              <span>₹{(completedBill.gst_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", borderTop: "1px solid #000", paddingTop: "4px" }}>
              <span>Grand Total:</span>
              <span>₹{(completedBill.total_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Payment Mode:</span>
              <span style={{ textTransform: "uppercase" }}>{completedBill.payment_mode === "credit" ? "Credit" : "Cash"}</span>
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
