"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Package,
  Plus,
  Search,
  Barcode,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Tag,
  IndianRupee,
} from "lucide-react";

export default function ItemsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "Groceries",
    unit: "PCS",
    sale_price: "",
    purchase_price: "",
    gst_rate: "18",
    hsn_code: "",
    min_stock_alert: "5",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/items`, {
        params: {
          search: search || undefined,
          category: categoryFilter !== "All" ? categoryFilter : undefined,
        },
      });
      setItems(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      category: "Groceries",
      unit: "PCS",
      sale_price: "",
      purchase_price: "",
      gst_rate: "18",
      hsn_code: "",
      min_stock_alert: "5",
    });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || "",
      barcode: item.barcode || "",
      category: item.category,
      unit: item.unit,
      sale_price: item.sale_price.toString(),
      purchase_price: item.purchase_price.toString(),
      gst_rate: item.gst_rate.toString(),
      hsn_code: item.hsn_code || "",
      min_stock_alert: item.min_stock_alert.toString(),
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      barcode: formData.barcode.trim() || undefined,
      category: formData.category,
      unit: formData.unit,
      sale_price: parseFloat(formData.sale_price) || 0,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      gst_rate: parseFloat(formData.gst_rate) || 0,
      hsn_code: formData.hsn_code.trim() || undefined,
      min_stock_alert: parseFloat(formData.min_stock_alert) || 0,
    };

    try {
      if (editingItem) {
        await api.put(`/items/${editingItem.id}`, payload);
        setSuccessMsg(`Item "${formData.name}" updated successfully!`);
      } else {
        await api.post("/items", payload);
        setSuccessMsg(`Item "${formData.name}" added to catalog!`);
      }
      setShowModal(false);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (itemId: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate "${name}"?`)) return;
    try {
      await api.delete(`/items/${itemId}`);
      setSuccessMsg(`Item "${name}" removed`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete item");
    }
  };

  const categories = ["All", "Groceries", "Beverages", "Snacks", "Dairy", "Pharmacy", "Electronics", "General"];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "4px" }}>Item & Product Master</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Catalog management with GST rates, HSN codes, and barcode scanner support
          </p>
        </div>

        {isAdmin && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus size={18} /> Add New Product
          </button>
        )}
      </div>

      {successMsg && (
        <div className="badge badge-success" style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", marginBottom: "20px", display: "block" }}>
          {successMsg}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: "16px", marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search by name, SKU, or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
            <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "12px" }} />
          </div>
          <button type="submit" className="btn-secondary">Search</button>
        </form>

        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: categoryFilter === c ? "#2563eb" : "rgba(30, 41, 59, 0.5)",
                color: categoryFilter === c ? "#ffffff" : "var(--text-muted)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: "var(--text-muted)" }}>Loading item catalog...</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            No products found. Add your first item using the button above.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Barcode / SKU</th>
                <th>Sale Price</th>
                <th>GST Rate</th>
                <th>HSN Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Unit: {item.unit}</div>
                  </td>
                  <td>
                    <span className="badge badge-purple">{item.category}</span>
                  </td>
                  <td>
                    {item.barcode ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace", fontSize: "0.85rem" }}>
                        <Barcode size={16} color="#38bdf8" /> {item.barcode}
                      </div>
                    ) : item.sku ? (
                      <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{item.sku}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: "#34d399", fontSize: "0.95rem" }}>
                    ₹{item.sale_price.toFixed(2)}
                  </td>
                  <td>
                    <span className="badge badge-blue">{item.gst_rate}% GST</span>
                  </td>
                  <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                    {item.hsn_code || "—"}
                  </td>
                  <td>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEditModal(item)} className="btn-secondary" style={{ padding: "4px 8px" }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.name)} className="btn-danger" style={{ padding: "4px 8px" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
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
            style={{ width: "100%", maxWidth: "540px", padding: "30px", borderRadius: "14px", background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                {editingItem ? "Edit Product" : "Add New Product"}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ width: "100%", padding: "8px 12px", marginBottom: "16px", display: "block" }}>
                {error}
              </div>
                      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Primary Required Details */}
              <div>
                <label className="input-label">Product Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Basmati Rice 1kg, Milk 500ml, Crocin 650mg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="input-label">Sale Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    placeholder="0.00"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">GST Tax Rate (%)</label>
                  <select
                    className="input-field"
                    value={formData.gst_rate}
                    onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                  >
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="5">5% (Essential)</option>
                    <option value="12">12% (Standard I)</option>
                    <option value="18">18% (Standard II)</option>
                    <option value="28">28% (Luxury / Sin)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Unit of Measure</label>
                  <select
                    className="input-field"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="LTR">LTR (Litres)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="BAG">BAG (Bags)</option>
                    <option value="MTR">MTR (Metres)</option>
                    <option value="PKT">PKT (Packets)</option>
                  </select>
                </div>
              </div>

              {/* Optional Identifiers & Codes */}
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.4)",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px dashed var(--border)",
                  marginTop: "4px",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "10px" }}>
                  Optional Codes & Tracking (Leave empty if not needed)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label className="input-label" style={{ fontSize: "0.75rem" }}>Barcode (Optional)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 8901052000012"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: "0.75rem" }}>Item Code / SKU (Optional)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. RICE-1KG"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label className="input-label" style={{ fontSize: "0.75rem" }}>HSN Code (Optional)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 1006"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: "0.75rem" }}>Purchase Price (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
