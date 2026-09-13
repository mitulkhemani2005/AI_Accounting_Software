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

export default function PartiesPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"customers" | "suppliers" | "areas">("customers");
  const [parties, setParties] = useState<any[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
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
      opening_balance: party.opening_balance.toString(),
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
        setSuccessMsg(`✅ Area '${payload.name}' updated successfully!`);
      } else {
        await api.post("/parties/areas", payload);
        setSuccessMsg(`✅ Area '${payload.name}' created successfully!`);
      }
      setShowAreaModal(false);
      fetchAreas();
      if (tab !== "areas") fetchParties();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save area");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (area: Area) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete Area "${area.name}"? Any assigned parties will be set to Unassigned.`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/parties/areas/${area.id}`);
      setSuccessMsg(`✅ Area "${area.name}" deleted successfully!`);
      fetchAreas();
      if (tab !== "areas") fetchParties();
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
            <span className="badge badge-success">Area-Wise Organization</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Parties & Ledger Directory
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "4px" }}>
            Area-wise Customer receivables, Supplier payables, Trade Localities, and Ledger balances
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
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
                    <th>Opening Bal</th>
                    <th>Current Outstanding</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => (
                    <tr key={p.id}>
                      {/* Name & Address */}
                      <td>
                        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>{p.name}</div>
                        {p.address && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>{p.address}</div>}
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
                      <td style={{ color: "var(--text-muted)" }}>
                        ₹{p.opening_balance.toFixed(2)}
                      </td>

                      {/* Current Balance */}
                      <td style={{ fontWeight: 700, fontSize: "0.95rem", color: p.current_balance > 0 ? "#f87171" : "#34d399" }}>
                        ₹{p.current_balance.toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "center" }}>
                        <button onClick={() => openEditModal(p)} className="btn-secondary" style={{ padding: "5px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Edit2 size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
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
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8", marginTop: "4px" }}>{areas.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Delivery zones & sales routes</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Customers in Areas</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>
                {areas.reduce((acc, a) => acc + (a.customers_count || 0), 0)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Assigned to trade localities</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", borderLeft: "4px solid #8b5cf6" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Suppliers in Areas</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#a78bfa", marginTop: "4px" }}>
                {areas.reduce((acc, a) => acc + (a.suppliers_count || 0), 0)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Trade vendors organized by area</div>
            </div>
          </div>

          {/* Area Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {areas.map((a) => (
              <div key={a.id} className="glass-panel" style={{ padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={16} color="#38bdf8" />
                        <span>{a.name}</span>
                      </h4>
                      {a.code && <span className="badge badge-blue" style={{ fontSize: "0.65rem", marginTop: "4px" }}>Code: {a.code}</span>}
                    </div>
                    <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Active</span>
                  </div>

                  {a.description && (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "8px 0" }}>
                      {a.description}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "0.8rem" }}>
                    <div style={{ color: "#34d399" }}><strong>{a.customers_count || 0}</strong> Customers</div>
                    <div style={{ color: "var(--text-muted)" }}>•</div>
                    <div style={{ color: "#a78bfa" }}><strong>{a.suppliers_count || 0}</strong> Suppliers</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={() => {
                      setSelectedAreaFilter(a.id);
                      setTab("customers");
                    }}
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    View Parties
                  </button>
                  <button onClick={() => openEditAreaModal(a)} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDeleteArea(a)} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem", color: "#f87171" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {areas.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <MapPin size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>No Trade Areas Created Yet</div>
                <div style={{ fontSize: "0.85rem", marginTop: "4px", marginBottom: "16px" }}>
                  Create areas (e.g. Main Market, Sector 14, Industrial Area) to organize your customers and suppliers route-wise.
                </div>
                <button onClick={openCreateAreaModal} className="btn-primary" style={{ margin: "0 auto" }}>
                  <Plus size={16} /> Add First Area
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT PARTY (CUSTOMER / SUPPLIER) --- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "540px", padding: "26px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                {editingParty ? `Edit ${tab === "customers" ? "Customer" : "Supplier"}` : `Add New ${tab === "customers" ? "Customer" : "Supplier"}`}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ width: "100%", padding: "8px 12px", marginBottom: "14px", display: "block" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Name */}
              <div>
                <label className="input-label">Full Name / Trade Business Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Ramesh General Store"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Trade Area Selection with Inline + New Area */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label className="input-label" style={{ margin: 0 }}>📍 Trade Area / Route</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddArea(!showQuickAddArea)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}
                  >
                    <Plus size={12} /> {showQuickAddArea ? "Cancel" : "Add New Area"}
                  </button>
                </div>

                {showQuickAddArea ? (
                  <div style={{ display: "flex", gap: "6px", background: "rgba(30, 41, 59, 0.6)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.4)", marginBottom: "6px" }}>
                    <input
                      type="text"
                      placeholder="Area Name (e.g. Station Road)"
                      className="input-field"
                      value={quickAreaName}
                      onChange={(e) => setQuickAreaName(e.target.value)}
                      style={{ fontSize: "0.85rem" }}
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
                  <label className="input-label">State of Supply</label>
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
