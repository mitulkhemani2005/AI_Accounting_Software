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
} from "lucide-react";

export default function PartiesPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [parties, setParties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    gst_number: "",
    state: "Maharashtra",
    address: "",
    opening_balance: "0",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchParties = async () => {
    try {
      setIsLoading(true);
      const endpoint = tab === "customers" ? "/parties/customers" : "/parties/suppliers";
      const res = await api.get(endpoint, {
        params: { search: search || undefined },
      });
      setParties(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [tab]);

  const openCreateModal = () => {
    setEditingParty(null);
    setFormData({
      name: "",
      mobile: "",
      email: "",
      gst_number: "",
      state: "Maharashtra",
      address: "",
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
      name: formData.name,
      mobile: formData.mobile || undefined,
      email: formData.email || undefined,
      gst_number: formData.gst_number || undefined,
      state: formData.state,
      address: formData.address || undefined,
      opening_balance: parseFloat(formData.opening_balance) || 0,
    };

    try {
      if (editingParty) {
        await api.put(`${endpoint}/${editingParty.id}`, payload);
        setSuccessMsg(`${tab === "customers" ? "Customer" : "Supplier"} updated successfully!`);
      } else {
        await api.post(endpoint, payload);
        setSuccessMsg(`${tab === "customers" ? "Customer" : "Supplier"} created successfully!`);
      }
      setShowModal(false);
      fetchParties();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save party");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px", color: "#f87171" }}>
          Admin Access Required
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Staff members are restricted to counter sale billing only. Adding or managing customers and suppliers requires Store Owner / Admin privileges.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "4px" }}>
            Parties & Ledger Directory
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Manage Customer receivables, Supplier payables, GST details, and credit balances
          </p>
        </div>

        <button onClick={openCreateModal} className="btn-primary">
          <Plus size={18} /> Add {tab === "customers" ? "Customer" : "Supplier"}
        </button>
      </div>

      {successMsg && (
        <div className="badge badge-success" style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", marginBottom: "20px", display: "block" }}>
          {successMsg}
        </div>
      )}

      {/* Tab Switcher & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", gap: "6px", background: "rgba(15, 23, 42, 0.6)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <button
            onClick={() => { setTab("customers"); setSearch(""); }}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              background: tab === "customers" ? "#2563eb" : "transparent",
              color: tab === "customers" ? "#ffffff" : "var(--text-muted)",
            }}
          >
            Customers (Receivables)
          </button>
          <button
            onClick={() => { setTab("suppliers"); setSearch(""); }}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              background: tab === "suppliers" ? "#2563eb" : "transparent",
              color: tab === "suppliers" ? "#ffffff" : "var(--text-muted)",
            }}
          >
            Suppliers (Payables)
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "280px" }}>
          <input
            type="text"
            className="input-field"
            placeholder={`Search ${tab} by name, mobile, GSTIN...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchParties()}
            style={{ paddingLeft: "36px" }}
          />
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "12px" }} />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: "var(--text-muted)" }}>Loading {tab}...</div>
          </div>
        ) : parties.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            No {tab} registered. Click &quot;Add {tab === "customers" ? "Customer" : "Supplier"}&quot; to create one.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Contact</th>
                <th>GSTIN & State</th>
                <th>Opening Bal</th>
                <th>Current Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.address && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.address}</div>}
                  </td>
                  <td>
                    {p.mobile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={14} color="#60a5fa" /> +91 {p.mobile}
                      </div>
                    ) : "—"}
                  </td>
                  <td>
                    <div style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{p.gst_number || "Unregistered"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>State: {p.state}</div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    ₹{p.opening_balance.toFixed(2)}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: "0.95rem", color: p.current_balance > 0 ? "#f87171" : "#34d399" }}>
                    ₹{p.current_balance.toFixed(2)}
                  </td>
                  <td>
                    <button onClick={() => openEditModal(p)} className="btn-secondary" style={{ padding: "4px 8px" }}>
                      <Edit2 size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="glass-panel"
            style={{ width: "100%", maxWidth: "500px", padding: "30px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                {editingParty ? `Edit ${tab === "customers" ? "Customer" : "Supplier"}` : `Add New ${tab === "customers" ? "Customer" : "Supplier"}`}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ width: "100%", padding: "8px 12px", marginBottom: "16px", display: "block" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="input-label">Full Name / Trade Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Ramesh Trading Co."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

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

              <div>
                <label className="input-label">Address</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Shop No, Street, City, Pincode"
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
    </div>
  );
}
