"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  TrendingUp,
  RotateCw,
  List,
  UserPlus,
  Plus,
  Trash2,
  Check,
  Printer,
  X,
  Search,
  Barcode as BarcodeIcon,
  Image as ImageIcon,
} from "lucide-react";

interface POSItem {
  item_id?: string;
  item_name: string;
  packing: string;
  quantity: number;
  free_qty: number;
  mrp: number;
  rate: number;
  scheme_pct: number;
  less_rs: number;
  disc_pct: number;
  disc_rs: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  amount: number;
  batch: string;
  unit: string;
  taxable_amount: number;
}

export default function InvoiceGenerationPage() {
  const { user, tenant, isAdmin } = useAuth();
  const router = useRouter();

  // Master Data
  const [catalog, setCatalog] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [selectedGodownId, setSelectedGodownId] = useState("");

  // Bill Header Form
  const [activeTab, setActiveTab] = useState<"basic" | "tax" | "freight" | "payment">("basic");
  const [docCode, setDocCode] = useState("Cash-KHP");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Credit">("Cash");
  const [billNumber, setBillNumber] = useState("11323");
  const [billDate, setBillDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [dayName, setDayName] = useState(() => {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  });

  // Party Selection
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedPartyName, setSelectedPartyName] = useState("CASH IN HAND");
  const [partyBalance, setPartyBalance] = useState("150417.93 D");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPos, setCustomerPos] = useState("23-Madhya Pradesh");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  // Transport & Despatch
  const [transportName, setTransportName] = useState("");
  const [chlNo, setChlNo] = useState("");
  const [chlDate, setChlDate] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [tcsPct, setTcsPct] = useState(0);
  const [tcsRs, setTcsRs] = useState(0);
  const [casesNo, setCasesNo] = useState("");
  const [remark, setRemark] = useState("");

  // Payment Breakdown
  const [tenderCash, setTenderCash] = useState<number>(0);
  const [tenderCard, setTenderCard] = useState<number>(0);
  const [tenderChq, setTenderChq] = useState<number>(0);

  // Barcode & Quick Add Row
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeQty, setBarcodeQty] = useState(1);

  // Table Items
  const [billItems, setBillItems] = useState<POSItem[]>([]);

  // Active Item Input Row
  const [activeItem, setActiveItem] = useState({
    item_id: "",
    item_name: "",
    packing: "1CS",
    quantity: 1,
    free_qty: 0,
    mrp: 0,
    rate: 0,
    scheme_pct: 0,
    less_rs: 0,
    disc_pct: 0,
    disc_rs: 0,
    gst_rate: 18,
    batch: "B-" + new Date().getFullYear(),
  });

  // Modal State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyForm, setNewPartyForm] = useState({
    name: "",
    type: "customer",
    mobile: "",
    place: "UJJAIN",
    area_id: "",
    gstin: "",
    address: "",
  });

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [itemsRes, partiesRes, godownsRes, areasRes] = await Promise.all([
        api.get("/items/"),
        api.get("/parties/"),
        api.get("/inventory/godowns"),
        api.get("/parties/areas").catch(() => ({ data: [] })),
      ]);
      setCatalog(itemsRes.data || []);
      setParties(partiesRes.data || []);
      setGodowns(godownsRes.data || []);
      setAreas(areasRes.data || []);
      if (godownsRes.data?.length > 0) {
        setSelectedGodownId(godownsRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load POS masters:", err);
    }
  };

  const handleSelectParty = (partyId: string) => {
    if (!partyId) {
      setSelectedPartyId("");
      setSelectedPartyName("CASH IN HAND");
      setPartyBalance("0.00 D");
      setCustomerMobile("");
      setCustomerGstin("");
      setCustomerAddress("");
      return;
    }
    const p = parties.find((x) => x.id === partyId);
    if (p) {
      setSelectedPartyId(p.id);
      setSelectedPartyName(p.name);
      const bal = Number(p.current_balance || p.opening_balance || 0);
      const balType = p.balance_type === "cr" ? "C" : "D";
      setPartyBalance(`${Math.abs(bal).toFixed(2)} ${balType}`);
      setCustomerMobile(p.mobile || "");
      setCustomerGstin(p.gst_number || "");
      setCustomerAddress(p.address || "");
      if (p.place) setCustomerPos(`23-${p.place.toUpperCase()}`);
    }
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      e.preventDefault();
      const code = barcodeInput.trim();
      const item = catalog.find(
        (i) => (i.barcode && i.barcode.toLowerCase() === code.toLowerCase()) ||
               (i.name && i.name.toLowerCase().includes(code.toLowerCase()))
      );
      if (item) {
        addItemToBill(item, barcodeQty);
        setBarcodeInput("");
        setBarcodeQty(1);
      } else {
        alert(`No product found matching barcode/name: "${code}"`);
      }
    }
  };

  const addItemToBill = (item: any, qty: number = 1) => {
    const rate = Number(item.base_sale_price || item.sale_price || 100);
    const mrp = Number(item.mrp || rate * 1.2);
    const gstRate = Number(item.gst_rate || 18);
    const totalAmt = rate * qty;
    const taxable = totalAmt / (1 + gstRate / 100);
    const gstAmt = totalAmt - taxable;

    const newItem: POSItem = {
      item_id: item.id,
      item_name: item.name,
      packing: item.secondary_unit ? `1CS (${item.units_per_case || 10} ${item.unit})` : item.unit || "1EA",
      quantity: qty,
      free_qty: 0,
      mrp: mrp,
      rate: rate,
      scheme_pct: 0,
      less_rs: 0,
      disc_pct: 0,
      disc_rs: 0,
      gst_rate: gstRate,
      cgst_amount: Number((gstAmt / 2).toFixed(2)),
      sgst_amount: Number((gstAmt / 2).toFixed(2)),
      igst_amount: 0,
      amount: Number(totalAmt.toFixed(2)),
      batch: "B-2026",
      unit: item.unit || "EA",
      taxable_amount: Number(taxable.toFixed(2)),
    };

    setBillItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddManualItem = () => {
    if (!activeItem.item_name) {
      alert("Please enter or select an Item Name first.");
      return;
    }
    const totalAmt = activeItem.rate * activeItem.quantity - activeItem.disc_rs;
    const taxable = totalAmt / (1 + activeItem.gst_rate / 100);
    const gstAmt = totalAmt - taxable;

    const newItem: POSItem = {
      item_id: activeItem.item_id || undefined,
      item_name: activeItem.item_name,
      packing: activeItem.packing,
      quantity: activeItem.quantity,
      free_qty: activeItem.free_qty,
      mrp: activeItem.mrp,
      rate: activeItem.rate,
      scheme_pct: activeItem.scheme_pct,
      less_rs: activeItem.less_rs,
      disc_pct: activeItem.disc_pct,
      disc_rs: activeItem.disc_rs,
      gst_rate: activeItem.gst_rate,
      cgst_amount: Number((gstAmt / 2).toFixed(2)),
      sgst_amount: Number((gstAmt / 2).toFixed(2)),
      igst_amount: 0,
      amount: Number(totalAmt.toFixed(2)),
      batch: activeItem.batch,
      unit: "EA",
      taxable_amount: Number(taxable.toFixed(2)),
    };

    setBillItems((prev) => [...prev, newItem]);
    setActiveItem({
      item_id: "",
      item_name: "",
      packing: "1CS",
      quantity: 1,
      free_qty: 0,
      mrp: 0,
      rate: 0,
      scheme_pct: 0,
      less_rs: 0,
      disc_pct: 0,
      disc_rs: 0,
      gst_rate: 18,
      batch: "B-" + new Date().getFullYear(),
    });
  };

  // Calculations
  const grossTotal = billItems.reduce((sum, i) => sum + i.amount, 0);
  const totalGst = billItems.reduce((sum, i) => sum + i.cgst_amount + i.sgst_amount + i.igst_amount, 0);
  const roundOff = Number((Math.round(grossTotal) - grossTotal).toFixed(2));
  const finalBillAmount = Math.round(grossTotal);

  const handleSaveBill = async () => {
    if (billItems.length === 0) {
      alert("Cannot save invoice with 0 items. Please add items to bill.");
      return;
    }

    try {
      const payload = {
        type: "sale",
        party_id: selectedPartyId || undefined,
        party_name: selectedPartyName,
        party_mobile: customerMobile || undefined,
        party_gst: customerGstin || undefined,
        party_address: customerAddress || undefined,
        is_interstate: false,
        payment_mode: paymentMode.toLowerCase(),
        items: billItems.map((item) => ({
          item_id: item.item_id || undefined,
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit || "EA",
          rate: item.rate,
          purchase_price: item.rate * 0.8,
          discount_amount: item.disc_rs,
          gst_rate: item.gst_rate,
          is_tax_inclusive: true,
        })),
        godown_id: selectedGodownId || undefined,
      };

      const res = await api.post("/bills/", payload);
      alert(`Invoice #${res.data.bill_number || "GENERATED"} successfully saved & posted to Accounting!`);
      // Reset bill for next invoice
      setBillItems([]);
      setBillNumber(String(Number(billNumber) + 1));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create invoice.");
    }
  };

  const handleCreatePartyQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/parties/", newPartyForm);
      setParties((prev) => [...prev, res.data]);
      handleSelectParty(res.data.id);
      setShowAddPartyModal(false);
      alert("Party created successfully!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create party.");
    }
  };

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "#ffffff",
        fontSize: "0.8rem",
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
      }}
    >
      {/* Top Header: Title, Barcode & Action Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 14px",
          borderBottom: "2px solid #120a42",
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
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#120a42", letterSpacing: "0.04em" }}>
            INVOICE GENERATION
          </h2>
        </div>

        {/* Center Barcode Box */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontWeight: 700, color: "#120a42", fontSize: "0.85rem" }}>BARCODE</span>
          <input
            type="text"
            className="erp-input"
            placeholder="Scan / Type Barcode or Item..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeScan}
            style={{ width: "220px", fontWeight: 600 }}
          />
          <input
            type="number"
            className="erp-input"
            value={barcodeQty}
            onChange={(e) => setBarcodeQty(Math.max(1, Number(e.target.value)))}
            style={{ width: "45px", textAlign: "center", fontWeight: 700 }}
          />
        </div>

        {/* Right Section: No Image Box + Circular Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              background: "#120a42",
              color: "#ffffff",
              padding: "4px 8px",
              fontSize: "0.65rem",
              fontWeight: 800,
              textAlign: "center",
              borderRadius: "2px",
            }}
          >
            NO IMAGE<br />AVAILABLE
          </div>

          <button className="erp-circle-btn" title="Reload / Refresh (F5)" onClick={loadMasters}>
            <RotateCw size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="List of Bills (F11)"
            onClick={() => router.push("/dashboard/bills")}
          >
            <List size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="Party Master / Add Party"
            onClick={() => setShowAddPartyModal(true)}
          >
            <UserPlus size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="New Invoice"
            onClick={() => {
              setBillItems([]);
              setBillNumber(String(Number(billNumber) + 1));
            }}
          >
            <Plus size={18} />
          </button>
          <button
            className="erp-circle-btn erp-circle-btn-danger"
            title="Clear Current Items"
            onClick={() => setBillItems([])}
          >
            <Trash2 size={16} />
          </button>
          <button
            className="erp-circle-btn"
            style={{ borderColor: "#16a34a", color: "#16a34a" }}
            title="Validate & Save Invoice (F12)"
            onClick={handleSaveBill}
          >
            <Check size={18} />
          </button>
          <button className="erp-circle-btn" title="Print Invoice" onClick={() => window.print()}>
            <Printer size={16} />
          </button>
          <button
            className="erp-circle-btn"
            title="Close / Exit"
            onClick={() => router.push("/dashboard")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs Strip */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #94a3b8",
          background: "#f1f5f9",
          padding: "2px 14px 0 14px",
          gap: "2px",
        }}
      >
        {[
          { id: "basic", label: "BASIC BILL DETAIL" },
          { id: "tax", label: "TAX AND OTHER DETAIL" },
          { id: "freight", label: "FREIGHT DETAIL" },
          { id: "payment", label: "PAYMENT DETAIL" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "4px 14px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: activeTab === tab.id ? "#ffffff" : "#e2e8f0",
              color: activeTab === tab.id ? "#120a42" : "#475569",
              borderTop: activeTab === tab.id ? "2px solid #120a42" : "1px solid #cbd5e1",
              borderLeft: "1px solid #cbd5e1",
              borderRight: "1px solid #cbd5e1",
              borderBottom: activeTab === tab.id ? "1px solid #ffffff" : "1px solid #cbd5e1",
              cursor: "pointer",
              marginBottom: activeTab === tab.id ? "-1px" : "0",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top Header Forms Grid (4 Columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 280px 180px 1fr",
          gap: "10px",
          padding: "10px 14px",
          background: "#ffffff",
          borderBottom: "2px solid #120a42",
        }}
      >
        {/* Column 1: DOC, CASH/CR, BILL NO, DATE, BILL TO */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>DOC CODE</span>
            <select className="erp-select" value={docCode} onChange={(e) => setDocCode(e.target.value)}>
              <option value="Cash-KHP">Cash-KHP</option>
              <option value="CR-SALES">CR-SALES</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>CASH/CR.</span>
            <select
              className="erp-select"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              style={{ background: "#2563eb", color: "#ffffff" }}
            >
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>BILL NO.</span>
            <input
              type="text"
              className="erp-input"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              style={{ fontWeight: 900, fontSize: "1rem", color: "#120a42", letterSpacing: "0.05em" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>BILL DATE</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                className="erp-input"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                style={{ width: "95px", fontWeight: 700 }}
              />
              <span style={{ fontSize: "0.75rem", color: "#475569", alignSelf: "center" }}>{dayName}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>BILL TO</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <select
                className="erp-select"
                value={selectedPartyId}
                onChange={(e) => handleSelectParty(e.target.value)}
                style={{ flex: 1, background: "#120a42", color: "#ffffff" }}
              >
                <option value="">CASH IN HAND</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className="erp-btn"
                onClick={() => setShowAddPartyModal(true)}
                style={{ padding: "0 6px" }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#64748b" }}>BAL.</span>
            <input
              type="text"
              className="erp-input"
              readOnly
              value={partyBalance}
              style={{ width: "130px", fontWeight: 800, textAlign: "right", background: "#f8fafc" }}
            />
          </div>
        </div>

        {/* Column 2: DESPATCH AND ORDER DETAIL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", borderLeft: "1px solid #e2e8f0", paddingLeft: "10px" }}>
          <div style={{ fontWeight: 700, color: "#64748b", fontSize: "0.75rem" }}>
            DESPATCH AND ORDER DETAIL
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>TRANSPORT</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                className="erp-input"
                value={transportName}
                onChange={(e) => setTransportName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="erp-btn" style={{ padding: "0 6px" }}>+</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>CHL NO.</span>
              <input type="text" className="erp-input" value={chlNo} onChange={(e) => setChlNo(e.target.value)} />
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>CHL DATE</span>
              <input type="text" className="erp-input" value={chlDate} onChange={(e) => setChlDate(e.target.value)} placeholder="DD/MM/YYYY" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>ORDER NO.</span>
              <input type="text" className="erp-input" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>ORDER DATE</span>
              <input type="text" className="erp-input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} placeholder="DD/MM/YYYY" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, color: "#120a42" }}>SALES A/C</span>
            <select className="erp-select" style={{ background: "#120a42", color: "#ffffff" }}>
              <option value="SALES A/C">SALES A/C</option>
            </select>
          </div>
        </div>

        {/* Column 3: CASES NO, REMARK, BIG BILL AMOUNT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", borderLeft: "1px solid #e2e8f0", paddingLeft: "10px" }}>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>CASES NO.</span>
            <input type="text" className="erp-input" value={casesNo} onChange={(e) => setCasesNo(e.target.value)} />
          </div>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#120a42" }}>REMARK</span>
            <input type="text" className="erp-input" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>

          <div style={{ marginTop: "auto", border: "2px solid #120a42", padding: "6px", background: "#f8fafc", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#120a42", letterSpacing: "0.05em" }}>
              BILL AMOUNT
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#dc2626" }}>
              ₹ {formatINR(finalBillAmount)}
            </div>
          </div>
        </div>

        {/* Column 4: CUSTOMER DETAIL & PAYMENT BREAKDOWN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderLeft: "1px solid #e2e8f0", paddingLeft: "10px" }}>
          <div style={{ fontWeight: 700, color: "#64748b", fontSize: "0.75rem" }}>
            CUSTOMER DETAIL
          </div>
          <input
            type="text"
            className="erp-input"
            placeholder="Address Line 1"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>P.O.S.</span>
            <input type="text" className="erp-input" value={customerPos} onChange={(e) => setCustomerPos(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>MOBILE</span>
            <input type="text" className="erp-input" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>GSTIN</span>
            <input type="text" className="erp-input" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Quick Add Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 14px",
          background: "#120a42",
          color: "#ffffff",
          fontSize: "0.75rem",
        }}
      >
        <select
          className="erp-select"
          value={activeItem.item_name}
          onChange={(e) => {
            const it = catalog.find((x) => x.name === e.target.value);
            if (it) {
              setActiveItem((prev) => ({
                ...prev,
                item_id: it.id,
                item_name: it.name,
                packing: it.secondary_unit ? `1CS (${it.units_per_case || 10} ${it.unit})` : it.unit || "1EA",
                rate: Number(it.base_sale_price || it.sale_price || 100),
                mrp: Number(it.mrp || 120),
                gst_rate: Number(it.gst_rate || 18),
              }));
            } else {
              setActiveItem((prev) => ({ ...prev, item_name: e.target.value }));
            }
          }}
          style={{ width: "240px", fontWeight: 600 }}
        >
          <option value="">-- Select Product Item --</option>
          {catalog.map((i) => (
            <option key={i.id} value={i.name}>
              {i.name} (MRP: ₹{i.mrp || i.sale_price})
            </option>
          ))}
        </select>

        <input
          type="text"
          className="erp-input"
          placeholder="Packing"
          value={activeItem.packing}
          onChange={(e) => setActiveItem({ ...activeItem, packing: e.target.value })}
          style={{ width: "90px" }}
        />

        <input
          type="number"
          className="erp-input"
          placeholder="Qnty"
          value={activeItem.quantity}
          onChange={(e) => setActiveItem({ ...activeItem, quantity: Number(e.target.value) })}
          style={{ width: "65px", textAlign: "center", fontWeight: 700 }}
        />

        <input
          type="number"
          className="erp-input"
          placeholder="Free"
          value={activeItem.free_qty}
          onChange={(e) => setActiveItem({ ...activeItem, free_qty: Number(e.target.value) })}
          style={{ width: "55px", textAlign: "center" }}
        />

        <input
          type="number"
          className="erp-input"
          placeholder="Rate"
          value={activeItem.rate}
          onChange={(e) => setActiveItem({ ...activeItem, rate: Number(e.target.value) })}
          style={{ width: "80px", textAlign: "right", fontWeight: 700 }}
        />

        <input
          type="number"
          className="erp-input"
          placeholder="Disc %"
          value={activeItem.disc_pct}
          onChange={(e) => {
            const pct = Number(e.target.value);
            const amt = (activeItem.rate * activeItem.quantity * pct) / 100;
            setActiveItem({ ...activeItem, disc_pct: pct, disc_rs: Number(amt.toFixed(2)) });
          }}
          style={{ width: "60px", textAlign: "center" }}
        />

        <input
          type="number"
          className="erp-input"
          placeholder="Disc Rs"
          value={activeItem.disc_rs}
          onChange={(e) => setActiveItem({ ...activeItem, disc_rs: Number(e.target.value) })}
          style={{ width: "70px", textAlign: "right" }}
        />

        <input
          type="text"
          className="erp-input"
          placeholder="Batch"
          value={activeItem.batch}
          onChange={(e) => setActiveItem({ ...activeItem, batch: e.target.value })}
          style={{ width: "90px" }}
        />

        <button
          onClick={handleAddManualItem}
          style={{
            background: "#10b981",
            color: "#ffffff",
            border: "none",
            padding: "4px 14px",
            fontWeight: 800,
            borderRadius: "2px",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          + ADD TO BILL
        </button>
      </div>

      {/* 14-Column High-Density Accounting Grid */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <table className="erp-table">
          <thead>
            <tr>
              <th style={{ width: "40px", textAlign: "center" }}>Sr#</th>
              <th style={{ minWidth: "220px" }}>Item Name</th>
              <th style={{ width: "100px" }}>Packing</th>
              <th style={{ width: "65px", textAlign: "center" }}>Qnty</th>
              <th style={{ width: "55px", textAlign: "center" }}>Free</th>
              <th style={{ width: "80px", textAlign: "right" }}>MRP</th>
              <th style={{ width: "85px", textAlign: "right" }}>Rate</th>
              <th style={{ width: "65px", textAlign: "center" }}>Schm %</th>
              <th style={{ width: "70px", textAlign: "right" }}>Less Rs</th>
              <th style={{ width: "65px", textAlign: "center" }}>Disc %</th>
              <th style={{ width: "70px", textAlign: "right" }}>Disc Rs</th>
              <th style={{ width: "105px", textAlign: "center" }}>CGST + SGST %</th>
              <th style={{ width: "100px", textAlign: "right" }}>Amount</th>
              <th style={{ width: "90px" }}>Batch</th>
              <th style={{ width: "35px", textAlign: "center" }}>✕</th>
            </tr>
          </thead>
          <tbody>
            {billItems.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No items in invoice. Scan barcode above or choose product and click (+ ADD TO BILL).
                </td>
              </tr>
            ) : (
              billItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: "#1e1b4b" }}>{item.item_name}</td>
                  <td>{item.packing}</td>
                  <td style={{ textAlign: "center", fontWeight: 800 }}>{item.quantity}</td>
                  <td style={{ textAlign: "center" }}>{item.free_qty || 0}</td>
                  <td style={{ textAlign: "right" }}>₹{formatINR(item.mrp)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>₹{formatINR(item.rate)}</td>
                  <td style={{ textAlign: "center" }}>{item.scheme_pct || 0}%</td>
                  <td style={{ textAlign: "right" }}>₹{formatINR(item.less_rs || 0)}</td>
                  <td style={{ textAlign: "center" }}>{item.disc_pct || 0}%</td>
                  <td style={{ textAlign: "right" }}>₹{formatINR(item.disc_rs || 0)}</td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{item.gst_rate}%</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#120a42" }}>
                    ₹{formatINR(item.amount)}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{item.batch}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Summary Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          background: "#120a42",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", gap: "20px" }}>
          <span>Total Items: <strong>{billItems.length}</strong></span>
          <span>Total Qty: <strong>{billItems.reduce((s, i) => s + i.quantity, 0)}</strong></span>
          <span>Total GST: <strong>₹{formatINR(totalGst)}</strong></span>
          <span>Round Off: <strong>₹{formatINR(roundOff)}</strong></span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#a3e635" }}>
            NET PAYABLE: ₹ {formatINR(finalBillAmount)}
          </div>
          <button
            onClick={handleSaveBill}
            style={{
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              padding: "6px 18px",
              fontWeight: 800,
              fontSize: "0.85rem",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            SAVE INVOICE (F12)
          </button>
        </div>
      </div>

      {/* Quick Add Party Modal */}
      {showAddPartyModal && (
        <div className="modal-overlay">
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "4px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              border: "2px solid #120a42",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "2px solid #120a42", paddingBottom: "8px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#120a42" }}>
                + CREATE NEW PARTY / SUNDRY DEBTOR
              </h3>
              <button
                onClick={() => setShowAddPartyModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePartyQuick} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="input-label" style={{ color: "#120a42" }}>Party Name *</label>
                <input
                  type="text"
                  required
                  className="erp-input"
                  value={newPartyForm.name}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, name: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="input-label" style={{ color: "#120a42" }}>Mobile</label>
                  <input
                    type="text"
                    className="erp-input"
                    value={newPartyForm.mobile}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, mobile: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ color: "#120a42" }}>Area / Route</label>
                  <select
                    className="erp-select"
                    value={newPartyForm.area_id}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, area_id: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    <option value="">Default Area</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label" style={{ color: "#120a42" }}>GSTIN Number</label>
                <input
                  type="text"
                  className="erp-input"
                  value={newPartyForm.gstin}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, gstin: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="input-label" style={{ color: "#120a42" }}>Address</label>
                <input
                  type="text"
                  className="erp-input"
                  value={newPartyForm.address}
                  onChange={(e) => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="erp-btn"
                  style={{ background: "#64748b" }}
                  onClick={() => setShowAddPartyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="erp-btn" style={{ background: "#10b981" }}>
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
