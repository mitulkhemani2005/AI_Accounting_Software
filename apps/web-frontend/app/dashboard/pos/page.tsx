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
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface POSItem {
  item_id?: string;
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

export default function POSPage() {
  const { user, tenant, isAdmin, isStaff } = useAuth();
  
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
  const [customerName, setCustomerName] = useState("Cash Customer");
  const [customerMobile, setCustomerMobile] = useState("");
  const [isInterstate, setIsInterstate] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [notes, setNotes] = useState("");

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

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load & Offline queue checks
  useEffect(() => {
    // Check online status
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        syncOfflineQueue();
      }
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    setIsOnline(navigator.onLine);

    // Load held bills and offline queue count from localStorage
    try {
      const savedHeld = localStorage.getItem("pos_held_bills");
      if (savedHeld) setHeldBills(JSON.parse(savedHeld));

      const savedQueue = localStorage.getItem("pos_offline_queue");
      if (savedQueue) setOfflineQueueCount(JSON.parse(savedQueue).length);
    } catch (e) {}

    // Fetch catalog items & customers
    api.get("/items").then((res) => setCatalog(res.data)).catch(console.error);
    api.get("/parties/customers").then((res) => setCustomers(res.data)).catch(console.error);

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
        console.log(`Synced ${res.data.synced_count} offline bills.`);
      }
    } catch (e) {
      console.error("Offline sync error:", e);
    }
  };

  // 3. Tax & Line Item Calculations
  const calculateLineItem = (
    item: { rate: number; quantity: number; discount_amount?: number; gst_rate: number },
    interstate: boolean
  ) => {
    const raw = item.quantity * item.rate;
    const taxable = Math.max(0, raw - (item.discount_amount || 0));
    const gstRate = item.gst_rate || 0;

    let cgst = 0, sgst = 0, igst = 0;
    if (interstate) {
      igst = Math.round(taxable * (gstRate / 100) * 100) / 100;
    } else {
      const halfRate = gstRate / 2;
      cgst = Math.round(taxable * (halfRate / 100) * 100) / 100;
      sgst = Math.round(taxable * (halfRate / 100) * 100) / 100;
    }
    const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

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
          { rate: current.rate, quantity: newQty, discount_amount: current.discount_amount, gst_rate: current.gst_rate },
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
        const calc = calculateLineItem(
          { rate: product.sale_price, quantity: 1, discount_amount: 0, gst_rate: product.gst_rate },
          isInterstate
        );
        const newItem: POSItem = {
          item_id: product.id,
          item_name: product.name,
          hsn_code: product.hsn_code,
          quantity: 1,
          unit: product.unit || "PCS",
          rate: product.sale_price,
          discount_amount: 0,
          gst_rate: product.gst_rate,
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

  const updateItemQty = (idx: number, delta: number) => {
    setBillItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      const calc = calculateLineItem(
        { rate: item.rate, quantity: newQty, discount_amount: item.discount_amount, gst_rate: item.gst_rate },
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
        { rate: newRate, quantity: item.quantity, discount_amount: item.discount_amount, gst_rate: item.gst_rate },
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

  const removeItem = (idx: number) => {
    setBillItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 4. Barcode Scan Handler
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    // Check catalog cache first
    const match = catalog.find((c) => c.barcode === barcodeInput.trim());
    if (match) {
      addItemToCart(match);
      setBarcodeInput("");
      return;
    }

    // Otherwise lookup backend API
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

  // 6. Hold / Resume Bill
  const holdCurrentBill = () => {
    if (billItems.length === 0) return;
    const draft = {
      id: Date.now().toString(),
      customerName,
      customerMobile,
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
    setCustomerName("Cash Customer");
    setCustomerMobile("");
    setPartyType("cash");
    setSelectedCustomerId("");
    setOverallDiscount("0");
    setPaymentMode("cash");
    setNotes("");
    setCompletedBill(null);
    setWhatsAppData(null);
  };

  // 7. Complete Checkout / Create Bill
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
        discount_amount: i.discount_amount,
        gst_rate: i.gst_rate,
      })),
    };

    if (!isOnline) {
      // Save to offline queue
      const existingQueue = JSON.parse(localStorage.getItem("pos_offline_queue") || "[]");
      existingQueue.push(payload);
      localStorage.setItem("pos_offline_queue", JSON.stringify(existingQueue));
      setOfflineQueueCount(existingQueue.length);

      setCompletedBill({
        bill_number: "OFFLINE-QUEUED",
        total_amount: grandTotal,
        payment_mode: paymentMode,
        is_offline: true,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.post("/bills", payload);
      setCompletedBill(res.data);

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px", height: "calc(100vh - 120px)" }}>
      {/* LEFT COLUMN: Catalog & Item Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
        {/* Top Controls: Barcode Scanner & Search */}
        <div className="glass-panel" style={{ padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
          <form onSubmit={handleBarcodeSubmit} style={{ display: "flex", gap: "8px", flex: 1 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                ref={barcodeInputRef}
                type="text"
                className="input-field"
                placeholder="Scan Barcode (Press Enter)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                style={{ paddingLeft: "36px", borderColor: "#38bdf8" }}
              />
              <Barcode size={18} color="#38bdf8" style={{ position: "absolute", left: "10px", top: "11px" }} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: "8px 14px" }}>
              Add
            </button>
          </form>

          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search product name / SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
            <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "11px" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isOnline ? (
              <span className="badge badge-success" title="Connected to Cloud">
                <Wifi size={12} /> Online
              </span>
            ) : (
              <span className="badge badge-danger" title="Working in Offline Mode">
                <WifiOff size={12} /> Offline ({offlineQueueCount})
              </span>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: selectedCategory === c ? "#2563eb" : "rgba(30, 41, 59, 0.6)",
                color: selectedCategory === c ? "#ffffff" : "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div
          className="glass-panel"
          style={{
            flex: 1,
            padding: "16px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "12px",
            alignContent: "start",
          }}
        >
          {filteredCatalog.map((product) => (
            <div
              key={product.id}
              onClick={() => addItemToCart(product)}
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "12px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 600, marginBottom: "2px" }}>
                  {product.category}
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#f8fafc", lineHeight: 1.3, marginBottom: "6px" }}>
                  {product.name}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <span style={{ fontWeight: 700, color: "#34d399", fontSize: "0.95rem" }}>
                  ₹{product.sale_price.toFixed(2)}
                </span>
                <span className="badge badge-blue" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                  {product.gst_rate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Bill & Checkout */}
      <div className="glass-panel" style={{ padding: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
        <div>
          {/* Bill Header & Customer Selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Receipt size={20} color="#3b82f6" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>POS Counter Sale</h3>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={holdCurrentBill} disabled={billItems.length === 0} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                <PauseCircle size={14} /> Hold
              </button>
              {heldBills.length > 0 && (
                <button onClick={() => setShowHeldModal(true)} className="btn-primary" style={{ padding: "4px 8px", fontSize: "0.75rem", background: "#f59e0b" }}>
                  <PlayCircle size={14} /> Resume ({heldBills.length})
                </button>
              )}
            </div>
          </div>

          {/* Customer / Party details */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <input
              type="text"
              className="input-field"
              placeholder="Customer Name (Cash Customer)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ fontSize: "0.85rem", padding: "6px 10px" }}
            />
            <input
              type="tel"
              maxLength={10}
              className="input-field"
              placeholder="10-Digit Mobile"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              style={{ fontSize: "0.85rem", padding: "6px 10px" }}
            />
          </div>

          {/* Cart Table */}
          <div style={{ maxHeight: "calc(100vh - 440px)", overflowY: "auto", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
            {billItems.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No items added. Scan barcode or click a product from the left catalog.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: "0.825rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "6px 4px" }}>Item</th>
                    <th style={{ padding: "6px 4px", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "6px 4px", width: "24px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
                      <td style={{ padding: "6px 4px" }}>
                        <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>GST: {item.gst_rate}%</div>
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <button onClick={() => updateItemQty(idx, -1)} style={{ background: "rgba(51, 65, 85, 0.5)", border: "none", color: "#fff", borderRadius: "4px", width: "20px", height: "20px", cursor: "pointer" }}>
                            -
                          </button>
                          <span style={{ fontWeight: 600, minWidth: "20px" }}>{item.quantity}</span>
                          <button onClick={() => updateItemQty(idx, 1)} style={{ background: "rgba(51, 65, 85, 0.5)", border: "none", color: "#fff", borderRadius: "4px", width: "20px", height: "20px", cursor: "pointer" }}>
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>₹{item.rate.toFixed(2)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700, color: "#34d399" }}>
                        ₹{item.total_amount.toFixed(2)}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <button onClick={() => removeItem(idx)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Totals Breakdown & Checkout Actions */}
        <div>
          <div style={{ padding: "10px 0", fontSize: "0.825rem", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
              <span>Subtotal (Taxable):</span>
              <span>₹{taxableVal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
              <span>Total GST Tax:</span>
              <span>₹{totalGst.toFixed(2)}</span>
            </div>
            {roundOff !== 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span>Round Off:</span>
                <span>₹{roundOff.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc", paddingTop: "6px", borderTop: "1px solid var(--border)" }}>
              <span>Grand Total:</span>
              <span style={{ color: "#38bdf8" }}>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Modes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
            {[
              { id: "cash", label: "Cash" },
              { id: "upi", label: "UPI / QR" },
              { id: "card", label: "Card" },
              { id: "credit", label: "Khata (Due)" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMode(m.id as any)}
                style={{
                  padding: "8px 4px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  fontSize: "0.775rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: paymentMode === m.id ? "#2563eb" : "rgba(30, 41, 59, 0.4)",
                  color: paymentMode === m.id ? "#ffffff" : "var(--text-muted)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Complete Bill Button */}
          <button
            onClick={handleCheckout}
            disabled={isSubmitting || billItems.length === 0}
            className="btn-primary"
            style={{ width: "100%", padding: "12px", fontSize: "1rem" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Processing Sale...
              </>
            ) : (
              <>
                Complete Counter Sale (₹{grandTotal.toFixed(2)}) <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {completedBill && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ width: "100%", maxWidth: "460px", padding: "30px", borderRadius: "14px", background: "#0f172a", textAlign: "center" }}>
            <CheckCircle2 size={54} color="#34d399" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "4px" }}>
              Sale Completed Successfully!
            </h2>
            <div style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Invoice No: <strong style={{ color: "#38bdf8" }}>{completedBill.bill_number}</strong> &bull; Amount: <strong>₹{completedBill.total_amount?.toFixed(2)}</strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
              {completedBill.id && (
                <a
                  href={`/api/v1/bills/${completedBill.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px" }}
                >
                  <Printer size={16} /> Print / Download Tax Invoice (PDF)
                </a>
              )}

              {whatsAppData && (
                <a
                  href={whatsAppData.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ width: "100%", padding: "10px", justifyContent: "center", background: "#065f46", color: "#34d399", borderColor: "#059669" }}
                >
                  <Share2 size={16} /> Share Invoice on WhatsApp
                </a>
              )}
            </div>

            <button onClick={resetCart} className="btn-secondary" style={{ width: "100%", padding: "10px" }}>
              + Next Counter Sale
            </button>
          </div>
        </div>
      )}

      {/* Resume Held Drafts Modal */}
      {showHeldModal && (
        <div className="modal-overlay" onClick={() => setShowHeldModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "480px", padding: "24px", borderRadius: "14px", background: "#0f172a" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700 }}>Held Bills ({heldBills.length})</h3>
              <button onClick={() => setShowHeldModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
              {heldBills.map((draft) => (
                <div
                  key={draft.id}
                  style={{
                    background: "rgba(30, 41, 59, 0.4)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{draft.customerName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {draft.billItems.length} items &bull; Time: {draft.date}
                    </div>
                  </div>
                  <button onClick={() => resumeDraft(draft)} className="btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
