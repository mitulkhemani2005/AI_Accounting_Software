"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Users,
  Plus,
  Search,
  Building,
  UserCheck,
  Phone,
  Edit2,
  X,
  Loader2,
  IndianRupee,
  MapPin,
  Trash2,
  Tag,
  Layers,
  CheckCircle2,
  RefreshCw,
  FileText,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Calendar,
  AlertCircle,
  Receipt,
  Scale,
} from "lucide-react";

interface Area {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  customers_count?: number;
  suppliers_count?: number;
  created_at: string;
}

interface PartyLedgerEntry {
  id: string;
  date: string;
  type: string;
  type_label: string;
  reference_no: string;
  description: string;
  payment_mode?: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface PartyLedgerData {
  party_id: string;
  party_name: string;
  party_type: string;
  mobile?: string;
  gst_number?: string;
  area_name?: string;
  opening_balance: number;
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
  transactions: PartyLedgerEntry[];
}

export default function PartiesPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"customers" | "suppliers" | "areas">("customers");
  const [parties, setParties] = useState<any[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [search, setSearch] = useState("");

  // Party Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    gst_number: "",
    state: "Maharashtra",
    address: "",
    area_id: "",
    opening_balance: "0",
  });

  // Area Modal State
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaFormData, setAreaFormData] = useState({
    name: "",
    code: "",
    description: "",
  });

  // Quick Inline Area Creation from Party Modal
  const [showQuickAddArea, setShowQuickAddArea] = useState(false);
  const [quickAreaName, setQuickAreaName] = useState("");
  const [isSubmittingQuickArea, setIsSubmittingQuickArea] = useState(false);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetParty, setPaymentTargetParty] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_mode: "cash",
    reference_number: "",
    notes: "",
    payment_date: new Date().toISOString().split("T")[0],
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Statement / Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<PartyLedgerData | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAreas = async () => {
    try {
      setIsLoadingAreas(true);
      const res = await api.get("/parties/areas");
      setAreas(res.data);
    } catch (err) {
      console.error("Failed to load areas", err);
    } finally {
      setIsLoadingAreas(false);
    }
  };

  const fetchParties = async () => {
    if (tab === "areas") {
      fetchAreas();
      return;
    }
    try {
      setIsLoading(true);
      const endpoint = tab === "customers" ? "/parties/customers" : "/parties/suppliers";
      const res = await api.get(endpoint, {
        params: {
          search: search.trim() || undefined,
          area_id: selectedAreaFilter !== "all" ? selectedAreaFilter : undefined,
        },
      });
      setParties(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    fetchParties();
  }, [tab, selectedAreaFilter]);

  // Recalculate Balances
  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      const res = await api.post("/parties/recalculate");
      setSuccessMsg(`✅ Balances synchronized: ${res.data.recalculated_customers} customers and ${res.data.recalculated_suppliers} suppliers verified!`);
      await fetchParties();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to recalculate balances");
    } finally {
      setIsRecalculating(false);
    }
  };

  // Party Modals
  const openCreateModal = () => {
    setEditingParty(null);
    setFormData({
      name: "",
      mobile: "",
      email: "",
      gst_number: "",
      state: "Maharashtra",
      address: "",
      area_id: selectedAreaFilter !== "all" ? selectedAreaFilter : "",
      opening_balance: "0",
    });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (party: any) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      mobile: party.mobile || "",
      email: party.email || "",
      gst_number: party.gst_number || "",
      state: party.state || "Maharashtra",
      address: party.address || "",
      area_id: party.area_id || "",
      opening_balance: (party.opening_balance || 0).toString(),
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const endpoint = tab === "customers" ? "/parties/customers" : "/parties/suppliers";
    const payload = {
      name: formData.name.trim(),
      mobile: formData.mobile.trim() || undefined,
      email: formData.email.trim() || undefined,
      gst_number: formData.gst_number.trim() || undefined,
      state: formData.state,
      address: formData.address.trim() || undefined,
      area_id: formData.area_id || undefined,
      opening_balance: parseFloat(formData.opening_balance) || 0,
    };

    try {
      if (editingParty) {
        await api.put(`${endpoint}/${editingParty.id}`, payload);
        setSuccessMsg(`✅ ${tab === "customers" ? "Customer" : "Supplier"} updated successfully!`);
      } else {
        await api.post(endpoint, payload);
        setSuccessMsg(`✅ ${tab === "customers" ? "Customer" : "Supplier"} created successfully!`);
      }
      setShowModal(false);
      fetchParties();
      fetchAreas();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save party");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Payment Recording
  const openPaymentModal = (party: any) => {
    setPaymentTargetParty(party);
    setPaymentForm({
      amount: party.current_balance > 0 ? party.current_balance.toString() : "",
      payment_mode: "cash",
      reference_number: "",
      notes: "",
      payment_date: new Date().toISOString().split("T")[0],
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(paymentForm.amount);
    if (!amountVal || amountVal <= 0) {
      alert("Please enter a valid payment amount greater than 0");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const pType = tab === "customers" ? "customer" : "supplier";
      const payType = tab === "customers" ? "payment_in" : "payment_out";

      await api.post("/parties/payments", {
        party_type: pType,
        party_id: paymentTargetParty.id,
        payment_type: payType,
        amount: amountVal,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
        payment_date: paymentForm.payment_date ? new Date(paymentForm.payment_date).toISOString() : undefined,
      });

      setSuccessMsg(`✅ Payment of ₹${amountVal.toFixed(2)} recorded for ${paymentTargetParty.name}!`);
      setShowPaymentModal(false);
      await fetchParties();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to record payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Ledger Statement
  const openLedgerModal = async (party: any) => {
    setSelectedPartyForLedger(party);
    setShowLedgerModal(true);
    setIsLoadingLedger(true);
    try {
      const pType = tab === "customers" ? "customer" : "supplier";
      const res = await api.get(`/parties/${pType}/${party.id}/ledger`);
      setLedgerData(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to load ledger statement");
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Area Modals
  const openCreateAreaModal = () => {
    setEditingArea(null);
    setAreaFormData({ name: "", code: "", description: "" });
    setError(null);
    setShowAreaModal(true);
  };

  const openEditAreaModal = (area: Area) => {
    setEditingArea(area);
    setAreaFormData({
      name: area.name,
      code: area.code || "",
      description: area.description || "",
    });
    setError(null);
    setShowAreaModal(true);
  };

  const handleAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: areaFormData.name.trim(),
      code: areaFormData.code.trim() || undefined,
      description: areaFormData.description.trim() || undefined,
    };

    try {
      if (editingArea) {
        await api.put(`/parties/areas/${editingArea.id}`, payload);
        setSuccessMsg(`✅ Area '${payload.name}' updated!`);
      } else {
        await api.post("/parties/areas", payload);
        setSuccessMsg(`✅ Area '${payload.name}' created!`);
      }
      setShowAreaModal(false);
      fetchAreas();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save area");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`Are you sure you want to delete area "${areaName}"?\nParties belonging to this area will become unassigned.`)) {
      return;
    }
    try {
      await api.delete(`/parties/areas/${areaId}`);
      setSuccessMsg(`✅ Area "${areaName}" deleted.`);
      fetchAreas();
      if (selectedAreaFilter === areaId) setSelectedAreaFilter("all");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete area");
    }
  };

  const handleQuickAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAreaName.trim()) return;
    setIsSubmittingQuickArea(true);
    try {
      const res = await api.post("/parties/areas", { name: quickAreaName.trim() });
      await fetchAreas();
      setFormData((prev) => ({ ...prev, area_id: res.data.id }));
      setQuickAreaName("");
      setShowQuickAddArea(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create area");
    } finally {
      setIsSubmittingQuickArea(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px", color: "#f87171" }}>
          Admin Access Required
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Staff members are restricted to counter sale billing only. Adding or managing customers, suppliers, and areas requires Store Owner / Admin privileges.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="badge badge-blue">Party Master</span>
            <span className="badge badge-success">Live Ledger Reconciliation</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Parties & Ledger Directory
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "4px" }}>
            Area-wise Customer receivables, Supplier payables, Trade Localities, and Double-Entry Ledger statements
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleRecalculateAll}
            disabled={isRecalculating}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            title="Recalculate and synchronize all customer and supplier balances with mathematical precision"
          >
            <RefreshCw size={15} className={isRecalculating ? "animate-spin" : ""} />
            {isRecalculating ? "Syncing..." : "Sync Balances"}
          </button>

          {tab === "areas" ? (
            <button onClick={openCreateAreaModal} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={18} /> Add New Area
            </button>
          ) : (
            <button onClick={openCreateModal} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={18} /> Add {tab === "customers" ? "Customer" : "Supplier"}
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="badge badge-success" style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}><X size={14} /></button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", overflowX: "auto" }}>
        {[
          { id: "customers", label: "Customers (Receivables)", icon: Users },
          { id: "suppliers", label: "Suppliers (Payables)", icon: Building },
          { id: "areas", label: `📍 Areas & Routes (${areas.length})`, icon: MapPin },
        ].map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as any);
                setSearch("");
              }}
              className={isActive ? "btn-primary" : "btn-secondary"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                fontSize: "0.875rem",
                borderRadius: "8px",
                background: isActive ? undefined : "transparent",
                borderColor: isActive ? undefined : "transparent",
              }}
            >
              <t.icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB 1 & 2: CUSTOMERS & SUPPLIERS LIST --- */}
      {tab !== "areas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filters & Actions Bar */}
          <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, minWidth: "280px" }}>
              {/* Search Bar */}
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder={`Search ${tab} by name, mobile, GSTIN, area...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchParties()}
                  style={{ paddingLeft: "36px" }}
                />
              </div>

              {/* Area Wise Dropdown Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={16} color="#38bdf8" />
                <select
                  className="input-field"
                  value={selectedAreaFilter}
                  onChange={(e) => setSelectedAreaFilter(e.target.value)}
                  style={{ width: "auto", minWidth: "190px", borderColor: "rgba(56, 189, 248, 0.4)" }}
                >
                  <option value="all">📍 All Areas ({areas.length})</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      📍 {a.name} ({tab === "customers" ? (a.customers_count || 0) : (a.suppliers_count || 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={() => { fetchParties(); fetchAreas(); }} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {/* Quick Area Filter Pills Bar */}
          {areas.length > 0 && (
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
              <button
                onClick={() => setSelectedAreaFilter("all")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: selectedAreaFilter === "all" ? "1px solid #38bdf8" : "1px solid var(--border)",
                  background: selectedAreaFilter === "all" ? "rgba(56, 189, 248, 0.2)" : "rgba(30, 41, 59, 0.4)",
                  color: selectedAreaFilter === "all" ? "#38bdf8" : "var(--text-muted)",
                }}
              >
                All Areas
              </button>
              {areas.map((a) => {
                const count = tab === "customers" ? (a.customers_count || 0) : (a.suppliers_count || 0);
                const isSel = selectedAreaFilter === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAreaFilter(a.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      border: isSel ? "1px solid #38bdf8" : "1px solid var(--border)",
                      background: isSel ? "rgba(56, 189, 248, 0.2)" : "rgba(30, 41, 59, 0.4)",
                      color: isSel ? "#38bdf8" : "var(--text-muted)",
                    }}
                  >
                    <span>📍 {a.name}</span>
                    <span style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: "10px" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="glass-panel" style={{ overflow: "hidden", borderRadius: "12px" }}>
            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "var(--text-muted)" }}>Loading {tab}...</div>
              </div>
            ) : parties.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Users size={36} style={{ margin: "0 auto 10px auto", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: "#f8fafc" }}>No {tab} found in this area.</div>
                <div style={{ fontSize: "0.85rem", marginTop: "4px", marginBottom: "16px" }}>
                  {selectedAreaFilter !== "all" ? "Try selecting 'All Areas' or add a new party to this area." : `Click "Add ${tab === "customers" ? "Customer" : "Supplier"}" to register your first trade party.`}
                </div>
                <button onClick={openCreateModal} className="btn-primary" style={{ margin: "0 auto" }}>
                  <Plus size={16} /> Add {tab === "customers" ? "Customer" : "Supplier"}
                </button>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.8)" }}>
                    <th>Party Name & Address</th>
                    <th>Trade Area / Route</th>
                    <th>Contact & Phone</th>
                    <th>GSTIN & State</th>
                    <th style={{ textAlign: "right" }}>Opening Bal</th>
                    <th style={{ textAlign: "right" }}>Current Outstanding</th>
                    <th style={{ textAlign: "center" }}>Actions & Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => {
                    const balance = p.current_balance || 0;
                    const isDebit = balance > 0;
                    const isSettled = Math.abs(balance) < 0.01;
                    const isCredit = balance < 0;

                    return (
                      <tr key={p.id}>
                        {/* Name & Address */}
                        <td>
                          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>{p.name}</div>
                          {p.address ? (
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                              <MapPin size={11} color="#38bdf8" /> {p.address}
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "2px" }}>
                              No address registered
                            </div>
                          )}
                        </td>

                        {/* Area Badge */}
                        <td>
                          {p.area_name ? (
                            <span className="badge badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.75rem" }}>
                              <MapPin size={12} /> {p.area_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              — Unassigned
                            </span>
                          )}
                        </td>

                        {/* Contact */}
                        <td>
                          {p.mobile ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#60a5fa", fontWeight: 500 }}>
                              <Phone size={13} /> +91 {p.mobile}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                          {p.email && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{p.email}</div>}
                        </td>

                        {/* GST */}
                        <td>
                          <div style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#f8fafc" }}>{p.gst_number || "Unregistered"}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>State: {p.state}</div>
                        </td>

                        {/* Opening Bal */}
                        <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                          ₹{(p.opening_balance || 0).toFixed(2)}
                        </td>

                        {/* Current Outstanding */}
                        <td style={{ textAlign: "right" }}>
                          {isSettled ? (
                            <span className="badge badge-success" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                              ₹0.00 Settled
                            </span>
                          ) : isDebit ? (
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f87171" }}>
                                ₹{balance.toFixed(2)}
                              </span>
                              <span style={{ fontSize: "0.65rem", color: "#f87171", fontWeight: 600 }}>
                                {tab === "customers" ? "Due from Customer" : "Payable to Supplier"}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#38bdf8" }}>
                                ₹{Math.abs(balance).toFixed(2)}
                              </span>
                              <span style={{ fontSize: "0.65rem", color: "#38bdf8", fontWeight: 600 }}>
                                Advance / Credit
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                            {/* Record Payment */}
                            <button
                              onClick={() => openPaymentModal(p)}
                              className="btn-primary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px", background: "#10b981", borderColor: "#059669" }}
                              title={tab === "customers" ? "Collect payment from customer" : "Record payment to supplier"}
                            >
                              <CreditCard size={12} /> {tab === "customers" ? "Collect" : "Pay"}
                            </button>

                            {/* View Ledger */}
                            <button
                              onClick={() => openLedgerModal(p)}
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                              title="View full statement of account and transaction ledger"
                            >
                              <FileText size={12} /> Ledger
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openEditModal(p)}
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                              title="Edit party details"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
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
      )}

      {/* --- TAB 3: AREAS & ROUTES MASTER --- */}
      {tab === "areas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Summary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", borderLeft: "4px solid #38bdf8" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Defined Areas</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>{areas.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active geographical routes</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", borderLeft: "4px solid #34d399" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Assigned Customers</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>
                {areas.reduce((acc, a) => acc + (a.customers_count || 0), 0)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Across all delivery routes</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", borderLeft: "4px solid #a78bfa" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Assigned Suppliers</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#a78bfa", marginTop: "4px" }}>
                {areas.reduce((acc, a) => acc + (a.suppliers_count || 0), 0)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Vendors & distributors</div>
            </div>
          </div>

          {/* Area Cards Grid */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Areas & Route Master Directory</h3>
              </div>
              <button onClick={openCreateAreaModal} className="btn-primary" style={{ padding: "6px 14px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> + New Area / Route
              </button>
            </div>

            {isLoadingAreas ? (
              <div style={{ padding: "30px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={28} color="#38bdf8" style={{ margin: "0 auto 8px" }} />
                <div style={{ color: "var(--text-muted)" }}>Loading areas...</div>
              </div>
            ) : areas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <MapPin size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: "#f8fafc" }}>No Trade Areas Defined Yet</div>
                <div style={{ fontSize: "0.85rem", marginTop: "4px", marginBottom: "16px" }}>
                  Create delivery areas (e.g. "Main Market", "Sector 4", "Industrial Area") to organize your parties and enable fast route filtering in POS sales.
                </div>
                <button onClick={openCreateAreaModal} className="btn-primary" style={{ margin: "0 auto" }}>
                  <Plus size={16} /> Create First Area
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {areas.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "12px",
                      transition: "transform 0.15s ease, border-color 0.15s ease",
                    }}
                    className="hover-card"
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}>
                            📍 {a.name}
                          </div>
                          {a.code && (
                            <span className="badge badge-purple" style={{ fontSize: "0.65rem", marginTop: "4px" }}>
                              Code: {a.code}
                            </span>
                          )}
                        </div>
                        <span className="badge badge-success" style={{ fontSize: "0.65rem" }}>Active</span>
                      </div>

                      {a.description && (
                        <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "8px 0 0 0", lineHeight: 1.4 }}>
                          {a.description}
                        </p>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span>👤 <strong>{a.customers_count || 0}</strong> Cust</span>
                        <span>🏢 <strong>{a.suppliers_count || 0}</strong> Supp</span>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => openEditAreaModal(a)}
                          className="btn-secondary"
                          style={{ padding: "3px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "3px" }}
                          title="Edit Area"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteArea(a.id, a.name)}
                          className="btn-secondary"
                          style={{ padding: "3px 8px", fontSize: "0.75rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                          title="Delete Area"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: RECORD / COLLECT PAYMENT --- */}
      {showPaymentModal && paymentTargetParty && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "460px", padding: "26px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CreditCard size={20} color="#10b981" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                  {tab === "customers" ? "Collect Customer Payment" : "Record Supplier Payment"}
                </h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Target Party Info Box */}
            <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>👤 {paymentTargetParty.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {paymentTargetParty.mobile ? `📱 +91 ${paymentTargetParty.mobile}` : "No phone"} {paymentTargetParty.area_name ? `• 📍 ${paymentTargetParty.area_name}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Current Due</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: paymentTargetParty.current_balance > 0 ? "#f87171" : "#34d399" }}>
                  ₹{(paymentTargetParty.current_balance || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="input-label">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="input-field"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10b981", borderColor: "#059669" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="input-label">Payment Mode *</label>
                  <select
                    className="input-field"
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="upi">📱 UPI / QR Code</option>
                    <option value="bank_transfer">🏦 Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="cheque">📝 Cheque</option>
                    <option value="card">💳 Card (Debit/Credit)</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Payment Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Reference / Txn / Cheque No (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. UPI Ref #, Cheque #, UTR"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Payment Remarks / Notes (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Cleared bill invoice balance"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingPayment} className="btn-primary" style={{ background: "#10b981", borderColor: "#059669" }}>
                  {isSubmittingPayment ? <Loader2 className="animate-spin" size={16} /> : `Save & Clear Due (₹${parseFloat(paymentForm.amount || "0").toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: FULL STATEMENT OF ACCOUNT / LEDGER --- */}
      {showLedgerModal && selectedPartyForLedger && (
        <div className="modal-overlay" onClick={() => setShowLedgerModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "860px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "24px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileText size={22} color="#38bdf8" />
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                    Party Statement of Account & Ledger
                  </h2>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span>Party: <strong style={{ color: "#f8fafc" }}>{selectedPartyForLedger.name}</strong></span>
                  {selectedPartyForLedger.address && <span>• 📍 {selectedPartyForLedger.address}</span>}
                  {selectedPartyForLedger.mobile && <span>• 📱 +91 {selectedPartyForLedger.mobile}</span>}
                  {selectedPartyForLedger.gst_number && <span>• 🆔 GST: {selectedPartyForLedger.gst_number}</span>}
                  {selectedPartyForLedger.area_name && <span>• 📍 Area: {selectedPartyForLedger.area_name}</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", fontSize: "0.8rem" }}
                >
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setShowLedgerModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {isLoadingLedger ? (
              <div style={{ padding: "50px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={36} color="#38bdf8" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "var(--text-muted)" }}>Calculating statement & running balances...</div>
              </div>
            ) : ledgerData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                {/* 4 Financial Summary KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  <div className="glass-panel" style={{ padding: "14px", borderRadius: "10px", background: "rgba(15, 23, 42, 0.7)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Opening Balance</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#cbd5e1", marginTop: "2px" }}>₹{ledgerData.opening_balance.toFixed(2)}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: "14px", borderRadius: "10px", background: "rgba(15, 23, 42, 0.7)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Invoiced (Debits)</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc", marginTop: "2px" }}>₹{ledgerData.total_invoiced.toFixed(2)}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: "14px", borderRadius: "10px", background: "rgba(15, 23, 42, 0.7)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Paid / Received</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#34d399", marginTop: "2px" }}>₹{ledgerData.total_paid.toFixed(2)}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: "14px", borderRadius: "10px", background: "rgba(15, 23, 42, 0.7)", borderLeft: "4px solid #f87171" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Net Outstanding Due</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: ledgerData.current_balance > 0 ? "#f87171" : "#34d399", marginTop: "2px" }}>
                      ₹{ledgerData.current_balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Ledger Transactions Table */}
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  <table className="custom-table" style={{ fontSize: "0.825rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(30, 41, 59, 0.8)" }}>
                        <th>Date</th>
                        <th>Transaction Type</th>
                        <th>Ref #</th>
                        <th>Description / Mode</th>
                        <th style={{ textAlign: "right" }}>Debit (₹)</th>
                        <th style={{ textAlign: "right" }}>Credit (₹)</th>
                        <th style={{ textAlign: "right" }}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                            No transactions recorded for this party yet.
                          </td>
                        </tr>
                      ) : (
                        ledgerData.transactions.map((tx, idx) => (
                          <tr key={idx} style={{ background: tx.type === "bill_void" ? "rgba(239, 68, 68, 0.05)" : undefined }}>
                            <td style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                              {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  tx.type === "sale_invoice" || tx.type === "purchase_invoice"
                                    ? "badge-blue"
                                    : tx.type.startsWith("payment")
                                    ? "badge-success"
                                    : tx.type === "bill_void"
                                    ? "badge-danger"
                                    : "badge-purple"
                                }`}
                                style={{ fontSize: "0.7rem" }}
                              >
                                {tx.type_label}
                              </span>
                            </td>
                            <td style={{ fontFamily: "monospace", color: "#f8fafc" }}>
                              {tx.reference_no}
                            </td>
                            <td style={{ color: "var(--text-muted)" }}>
                              {tx.description}
                              {tx.payment_mode && <span style={{ marginLeft: "4px", fontSize: "0.7rem", color: "#38bdf8" }}>[{tx.payment_mode}]</span>}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: tx.debit > 0 ? 700 : 400, color: tx.debit > 0 ? "#f8fafc" : "var(--text-muted)" }}>
                              {tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: tx.credit > 0 ? 700 : 400, color: tx.credit > 0 ? "#34d399" : "var(--text-muted)" }}>
                              {tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: tx.running_balance > 0 ? "#f87171" : "#34d399" }}>
                              ₹{tx.running_balance.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT PARTY --- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "540px", padding: "26px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserCheck size={20} color="#38bdf8" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                  {editingParty ? `Edit ${tab === "customers" ? "Customer" : "Supplier"}` : `Add New ${tab === "customers" ? "Customer" : "Supplier"}`}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ width: "100%", padding: "8px 12px", marginBottom: "14px", display: "block" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Name */}
              <div>
                <label className="input-label">Party Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder={tab === "customers" ? "e.g. Ramesh Kumar / Sharma General Store" : "e.g. Hindustan Unilever Ltd / ABC Distributor"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Area / Route Selection with Inline Quick Creation */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label className="input-label" style={{ margin: 0 }}>Trade Area / Route</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddArea(!showQuickAddArea)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    {showQuickAddArea ? "✕ Cancel Quick Area" : "+ Add New Area"}
                  </button>
                </div>

                {showQuickAddArea ? (
                  <div style={{ display: "flex", gap: "6px", background: "rgba(56, 189, 248, 0.1)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                    <input
                      type="text"
                      placeholder="New Area Name (e.g. Sector 14)"
                      value={quickAreaName}
                      onChange={(e) => setQuickAreaName(e.target.value)}
                      className="input-field"
                      style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddArea}
                      disabled={isSubmittingQuickArea || !quickAreaName.trim()}
                      className="btn-primary"
                      style={{ padding: "4px 12px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                    >
                      {isSubmittingQuickArea ? <Loader2 className="animate-spin" size={14} /> : "Create & Select"}
                    </button>
                  </div>
                ) : (
                  <select
                    className="input-field"
                    value={formData.area_id}
                    onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                  >
                    <option value="">— Select Trade Area / Route (Optional) —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        📍 {a.name} {a.code ? `(${a.code})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Mobile & Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="input-label">Mobile Number</label>
                  <input
                    type="tel"
                    maxLength={10}
                    className="input-field"
                    placeholder="9876543210"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Email Address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="contact@party.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* GST & State */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="input-label">15-Digit GSTIN</label>
                  <input
                    type="text"
                    maxLength={15}
                    className="input-field"
                    placeholder="27AABCU9603R1ZM"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="input-label">State</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>

              {/* Opening Balance */}
              <div>
                <label className="input-label">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                />
              </div>

              {/* Address */}
              <div>
                <label className="input-label">Shop / Office Address</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Shop No, Street, Landmark, City, Pincode"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Save Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT AREA --- */}
      {showAreaModal && (
        <div className="modal-overlay" onClick={() => setShowAreaModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "460px", padding: "26px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={20} color="#38bdf8" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                  {editingArea ? `Edit Area — ${editingArea.name}` : "Create New Trade Area"}
                </h3>
              </div>
              <button onClick={() => setShowAreaModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ width: "100%", padding: "8px 12px", marginBottom: "14px", display: "block" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAreaSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="input-label">Area / Route Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Main Market, Sector 14, Ring Road"
                  value={areaFormData.name}
                  onChange={(e) => setAreaFormData({ ...areaFormData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Area Code (Optional)</label>
                <input
                  type="text"
                  maxLength={20}
                  className="input-field"
                  placeholder="e.g. MM-01, Z-NORTH"
                  value={areaFormData.code}
                  onChange={(e) => setAreaFormData({ ...areaFormData, code: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <label className="input-label">Description / Route Notes</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Optional delivery notes, landmarks, or route details..."
                  value={areaFormData.description}
                  onChange={(e) => setAreaFormData({ ...areaFormData, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowAreaModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Save Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
