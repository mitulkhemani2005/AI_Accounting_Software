"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Boxes,
  Plus,
  ArrowRightLeft,
  History,
  AlertTriangle,
  Clock,
  Warehouse,
  Search,
  Filter,
  RefreshCw,
  Building2,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  CheckCircle2,
  X,
  Edit2,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  Truck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

interface Godown {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contact_person?: string;
  contact_number?: string;
  is_default: boolean;
  is_active: boolean;
}

interface StockBatch {
  id: string;
  godown_id: string;
  item_id: string;
  batch_number: string;
  expiry_date?: string;
  manufacturing_date?: string;
  purchase_price: number;
  sale_price?: number;
  quantity: number;
}

interface ItemStockSummary {
  item_id: string;
  item_name: string;
  sku?: string;
  barcode?: string;
  category: string;
  unit: string;
  sale_price: number;
  purchase_price: number;
  total_quantity: number;
  total_valuation_cost: number;
  total_valuation_sale: number;
  min_stock_alert: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  godown_breakdown: { godown_id: string; godown_name: string; quantity: number }[];
  active_batches: StockBatch[];
}

interface InventoryMetrics {
  total_items_count: number;
  total_stock_units: number;
  total_inventory_valuation_cost: number;
  total_inventory_valuation_sale: number;
  low_stock_items_count: number;
  out_of_stock_items_count: number;
  expiring_soon_batches_count: number;
  active_godowns_count: number;
}

interface StockMovement {
  id: string;
  created_at: string;
  godown_id: string;
  godown_name?: string;
  item_id: string;
  item_name?: string;
  item_unit: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  cost_per_unit: number;
  reference_type: string;
  reference_id?: string;
  batch_number?: string;
  notes?: string;
  performed_by_name?: string;
}

interface StockTransfer {
  id: string;
  transfer_number: string;
  from_godown_id: string;
  from_godown_name?: string;
  to_godown_id: string;
  to_godown_name?: string;
  status: string;
  transfer_date: string;
  notes?: string;
  created_by_name?: string;
  items: {
    id: string;
    item_id: string;
    item_name?: string;
    batch_number?: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
}

interface LowStockAlert {
  item_id: string;
  item_name: string;
  sku?: string;
  category: string;
  unit: string;
  total_quantity: number;
  min_stock_alert: number;
  status: string;
  godown_distribution: { godown_id: string; godown_name: string; quantity: number }[];
}

interface ExpiringBatchAlert {
  batch_id: string;
  item_id: string;
  item_name: string;
  godown_name: string;
  batch_number: string;
  expiry_date: string;
  days_to_expiry: number;
  quantity: number;
  unit: string;
  status: string;
}

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "stock_in" | "godowns" | "transfers" | "movements" | "alerts">("overview");

  // State
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [stocks, setStocks] = useState<ItemStockSummary[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<ExpiringBatchAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  // Modals
  const [showGodownModal, setShowGodownModal] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [godownForm, setGodownForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    contact_person: "",
    contact_number: "",
    is_default: false,
    is_active: true,
  });

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTargetItem, setAdjustTargetItem] = useState<ItemStockSummary | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    godown_id: "",
    adjustment_type: "add",
    quantity: 1,
    batch_number: "",
    reason: "Physical count correction",
    notes: "",
  });

  // Stock In Form State
  const [stockInForm, setStockInForm] = useState({
    godown_id: "",
    supplier_name: "",
    invoice_number: "",
    items: [
      {
        item_id: "",
        quantity: 1,
        purchase_price: 0,
        batch_number: "",
        expiry_date: "",
      },
    ],
    notes: "",
  });

  // Stock Transfer Form State
  const [transferForm, setTransferForm] = useState({
    from_godown_id: "",
    to_godown_id: "",
    items: [
      {
        item_id: "",
        quantity: 1,
        batch_number: "",
        unit: "PCS",
        notes: "",
      },
    ],
    notes: "",
  });

  // All Items lookup list for dropdowns
  const [allItemsList, setAllItemsList] = useState<{ id: string; name: string; sku?: string; unit: string; purchase_price: number }[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, stocksRes, godownsRes, alertsRes, expiringRes] = await Promise.all([
        api.get("/inventory/metrics"),
        api.get("/inventory/stock"),
        api.get("/inventory/godowns"),
        api.get("/inventory/alerts/low-stock"),
        api.get("/inventory/alerts/expiring?days=60"),
      ]);

      setMetrics(metricsRes.data);
      setStocks(stocksRes.data);
      setGodowns(godownsRes.data);
      setLowStockAlerts(alertsRes.data);
      setExpiringAlerts(expiringRes.data);

      // Fetch Items list for drop-downs
      const itemsRes = await api.get("/items");
      setAllItemsList(itemsRes.data);

      // Pre-set default godown in forms
      const def = godownsRes.data.find((g: Godown) => g.is_default) || godownsRes.data[0];
      if (def) {
        setStockInForm((prev) => ({ ...prev, godown_id: def.id }));
        setTransferForm((prev) => ({ ...prev, from_godown_id: def.id }));
        setAdjustForm((prev) => ({ ...prev, godown_id: def.id }));
      }
    } catch (err) {
      console.error("Failed to load inventory data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await api.get(`/inventory/movements?movement_type=${movementTypeFilter}`);
      setMovements(res.data);
    } catch (err) {
      console.error("Failed to load movements", err);
    }
  };

  const loadTransfers = async () => {
    try {
      const res = await api.get("/inventory/transfers");
      setTransfers(res.data);
    } catch (err) {
      console.error("Failed to load transfers", err);
    }
  };

  useEffect(() => {
    if (activeTab === "movements") loadMovements();
    if (activeTab === "transfers") loadTransfers();
  }, [activeTab, movementTypeFilter]);

  // Handle Save Godown
  const handleSaveGodown = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGodown) {
        await api.put(`/inventory/godowns/${editingGodown.id}`, godownForm);
      } else {
        await api.post("/inventory/godowns", godownForm);
      }
      setShowGodownModal(false);
      setEditingGodown(null);
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save Godown");
    }
  };

  const openCreateGodown = () => {
    setEditingGodown(null);
    setGodownForm({
      name: "",
      code: "",
      address: "",
      city: "",
      state: "Maharashtra",
      pincode: "",
      contact_person: "",
      contact_number: "",
      is_default: false,
      is_active: true,
    });
    setShowGodownModal(true);
  };

  const openEditGodown = (g: Godown) => {
    setEditingGodown(g);
    setGodownForm({
      name: g.name,
      code: g.code,
      address: g.address || "",
      city: g.city || "",
      state: g.state || "Maharashtra",
      pincode: g.pincode || "",
      contact_person: g.contact_person || "",
      contact_number: g.contact_number || "",
      is_default: g.is_default,
      is_active: g.is_active,
    });
    setShowGodownModal(true);
  };

  // Handle Stock Adjustment
  const openAdjustStock = (item: ItemStockSummary) => {
    setAdjustTargetItem(item);
    const def = godowns.find((g) => g.is_default) || godowns[0];
    setAdjustForm({
      godown_id: def ? def.id : "",
      adjustment_type: "add",
      quantity: 1,
      batch_number: "",
      reason: "Physical stock take correction",
      notes: "",
    });
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetItem) return;
    try {
      await api.post("/inventory/adjust", {
        item_id: adjustTargetItem.item_id,
        ...adjustForm,
      });
      setShowAdjustModal(false);
      setAdjustTargetItem(null);
      loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to adjust stock");
    }
  };

  // Handle Stock In Submission
  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/inventory/stock-in", stockInForm);
      alert("✅ Stock-in recorded successfully!");
      // Reset form
      setStockInForm({
        godown_id: godowns.find((g) => g.is_default)?.id || "",
        supplier_name: "",
        invoice_number: "",
        items: [{ item_id: "", quantity: 1, purchase_price: 0, batch_number: "", expiry_date: "" }],
        notes: "",
      });
      loadAllData();
      setActiveTab("overview");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to record stock-in");
    }
  };

  // Handle Stock Transfer Submission
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.from_godown_id === transferForm.to_godown_id) {
      alert("Source and destination godowns cannot be the same.");
      return;
    }
    try {
      await api.post("/inventory/transfers", transferForm);
      alert("✅ Stock transferred successfully!");
      setTransferForm({
        from_godown_id: godowns[0]?.id || "",
        to_godown_id: "",
        items: [{ item_id: "", quantity: 1, batch_number: "", unit: "PCS", notes: "" }],
        notes: "",
      });
      loadAllData();
      loadTransfers();
      setActiveTab("transfers");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Transfer failed");
    }
  };

  // Filtered Stock List
  const filteredStocks = stocks.filter((s) => {
    const matchSearch =
      s.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.sku && s.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.barcode && s.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchCategory = categoryFilter === "all" || s.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchLowStock = !lowStockOnly || s.is_low_stock;

    const matchGodown =
      godownFilter === "all" ||
      s.godown_breakdown.some((g) => g.godown_id === godownFilter && g.quantity > 0);

    return matchSearch && matchCategory && matchLowStock && matchGodown;
  });

  const categories = Array.from(new Set(stocks.map((s) => s.category))).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Boxes size={28} color="#38bdf8" />
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
              Inventory & Warehouse Management
            </h1>
            <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>Phase 3</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "4px 0 0 0" }}>
            Multi-godown stock tracking, batch & expiry control, purchase restocking, and movement ledgers
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={loadAllData} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={15} /> Refresh
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setActiveTab("stock_in")} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> Stock-In (Purchase)
              </button>
              <button onClick={() => setActiveTab("transfers")} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ArrowRightLeft size={16} /> Transfer Stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Total Units */}
          <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ background: "rgba(56, 189, 248, 0.15)", padding: "12px", borderRadius: "10px", color: "#38bdf8" }}>
              <Package size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Stock On Hand</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc" }}>{metrics.total_stock_units} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Units</span></div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{metrics.total_items_count} catalog items</div>
            </div>
          </div>

          {/* Valuation Cost */}
          <div className="glass-panel" style={{ padding: "18px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.15)", padding: "12px", borderRadius: "10px", color: "#34d399" }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Valuation (Cost)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#34d399" }}>₹{metrics.total_inventory_valuation_cost.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Retail value: ₹{metrics.total_inventory_valuation_sale.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div
            className="glass-panel"
            style={{
              padding: "18px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              border: metrics.low_stock_items_count > 0 ? "1px solid rgba(245, 158, 11, 0.4)" : undefined,
              cursor: "pointer",
            }}
            onClick={() => {
              setActiveTab("overview");
              setLowStockOnly(true);
            }}
          >
            <div style={{ background: "rgba(245, 158, 11, 0.15)", padding: "12px", borderRadius: "10px", color: "#fbbf24" }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Low / Out of Stock</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fbbf24" }}>{metrics.low_stock_items_count} <span style={{ fontSize: "0.8rem", color: "#f87171" }}>({metrics.out_of_stock_items_count} Out)</span></div>
              <div style={{ fontSize: "0.7rem", color: "#38bdf8" }}>Click to filter low stock items</div>
            </div>
          </div>

          {/* Expiring Batches */}
          <div
            className="glass-panel"
            style={{
              padding: "18px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              border: metrics.expiring_soon_batches_count > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : undefined,
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("alerts")}
          >
            <div style={{ background: "rgba(239, 68, 68, 0.15)", padding: "12px", borderRadius: "10px", color: "#f87171" }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Expiring Soon (60d)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f87171" }}>{metrics.expiring_soon_batches_count} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Batches</span></div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Across {metrics.active_godowns_count} active godowns</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", overflowX: "auto" }}>
        {[
          { id: "overview", label: "Stock Overview", icon: Package },
          { id: "stock_in", label: "Stock-In (Purchase)", icon: Plus, adminOnly: true },
          { id: "godowns", label: "Godowns & Branches", icon: Warehouse },
          { id: "transfers", label: "Stock Transfers", icon: ArrowRightLeft },
          { id: "movements", label: "Movement Ledger", icon: History },
          { id: "alerts", label: `Alerts (${lowStockAlerts.length + expiringAlerts.length})`, icon: ShieldAlert },
        ].map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={isActive ? "btn-primary" : "btn-secondary"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "0.875rem",
                borderRadius: "8px",
                background: isActive ? undefined : "transparent",
                borderColor: isActive ? undefined : "transparent",
              }}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: STOCK OVERVIEW --- */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filters */}
          <div className="glass-panel" style={{ padding: "16px", borderRadius: "12px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, minWidth: "280px" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search item name, SKU, or barcode..."
                  className="input-field"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: "36px", width: "100%" }}
                />
              </div>

              {/* Category Filter */}
              <select className="input-field" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: "160px" }}>
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Godown Filter */}
              <select className="input-field" value={godownFilter} onChange={(e) => setGodownFilter(e.target.value)} style={{ width: "180px" }}>
                <option value="all">All Godowns</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                ))}
              </select>
            </div>

            {/* Low Stock Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: lowStockOnly ? "#fbbf24" : "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                ⚠️ Low Stock Only
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden" }}>
            <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Item & Details</th>
                  <th>Category</th>
                  <th>Godown Breakdown</th>
                  <th style={{ textAlign: "right" }}>Cost Price</th>
                  <th style={{ textAlign: "right" }}>Sale Price</th>
                  <th style={{ textAlign: "right" }}>On Hand</th>
                  <th style={{ textAlign: "right" }}>Cost Value</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                      No stock items found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((item) => (
                    <tr key={item.item_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{item.item_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "8px", marginTop: "2px" }}>
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.barcode && <span>• Barcode: {item.barcode}</span>}
                        </div>
                        {/* Batches pill */}
                        {item.active_batches.length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                            {item.active_batches.map((b) => (
                              <span key={b.id} className="badge badge-blue" style={{ fontSize: "0.65rem" }}>
                                {b.batch_number} ({b.quantity} {item.unit}) {b.expiry_date ? `• Exp: ${b.expiry_date}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>{item.category}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.75rem" }}>
                          {item.godown_breakdown.length === 0 ? (
                            <span style={{ color: "#ef4444" }}>No stock in any godown</span>
                          ) : (
                            item.godown_breakdown.map((gb) => (
                              <div key={gb.godown_id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", color: gb.quantity > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                                <span>{gb.godown_name}:</span>
                                <strong>{gb.quantity} {item.unit}</strong>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-muted)" }}>₹{item.purchase_price.toFixed(2)}</td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 600 }}>₹{item.sale_price.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "1.05rem", fontWeight: 700, color: item.is_out_of_stock ? "#ef4444" : item.is_low_stock ? "#fbbf24" : "#34d399" }}>
                          {item.total_quantity}
                        </span>{" "}
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.unit}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#f8fafc" }}>
                        ₹{item.total_valuation_cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        {item.is_out_of_stock ? (
                          <span className="badge badge-danger" style={{ fontSize: "0.7rem" }}>Out of Stock</span>
                        ) : item.is_low_stock ? (
                          <span className="badge badge-warning" style={{ fontSize: "0.7rem" }}>Low Stock (&le; {item.min_stock_alert})</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>In Stock</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => openAdjustStock(item)}
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                              title="Adjust Stock (Wastage, Count, Corrections)"
                            >
                              <Edit2 size={12} /> Adjust
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: STOCK-IN / PURCHASE ENTRY --- */}
      {activeTab === "stock_in" && isAdmin && (
        <div className="glass-panel" style={{ padding: "24px", borderRadius: "14px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <Plus size={22} color="#34d399" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>Record Stock-In / Purchase Goods</h2>
          </div>

          <form onSubmit={handleStockInSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Target Godown */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  🏢 Target Godown / Warehouse *
                </label>
                <select
                  className="input-field"
                  value={stockInForm.godown_id}
                  onChange={(e) => setStockInForm({ ...stockInForm, godown_id: e.target.value })}
                  required
                >
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code}) {g.is_default ? "★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Name */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  🚚 Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. National Distributors"
                  className="input-field"
                  value={stockInForm.supplier_name}
                  onChange={(e) => setStockInForm({ ...stockInForm, supplier_name: e.target.value })}
                />
              </div>
            </div>

            {/* Invoice Number */}
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                📄 Supplier Purchase Invoice / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. INV-PUR-9821"
                className="input-field"
                value={stockInForm.invoice_number}
                onChange={(e) => setStockInForm({ ...stockInForm, invoice_number: e.target.value })}
              />
            </div>

            {/* Line Items */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>Restock Line Items</span>
                <button
                  type="button"
                  onClick={() =>
                    setStockInForm({
                      ...stockInForm,
                      items: [...stockInForm.items, { item_id: "", quantity: 1, purchase_price: 0, batch_number: "", expiry_date: "" }],
                    })
                  }
                  className="btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={13} /> Add Row
                </button>
              </div>

              {stockInForm.items.map((row, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.8fr 0.8fr 1fr 1fr 32px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  {/* Item Picker */}
                  <select
                    className="input-field"
                    value={row.item_id}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      const selItem = allItemsList.find((it) => it.id === e.target.value);
                      updated[idx].item_id = e.target.value;
                      if (selItem && (!updated[idx].purchase_price || updated[idx].purchase_price === 0)) {
                        updated[idx].purchase_price = selItem.purchase_price;
                      }
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    required
                    style={{ fontSize: "0.825rem" }}
                  >
                    <option value="">Select Item...</option>
                    {allItemsList.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </select>

                  {/* Quantity */}
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Qty"
                    className="input-field"
                    value={row.quantity}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].quantity = parseFloat(e.target.value) || 0;
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    required
                    style={{ fontSize: "0.825rem" }}
                  />

                  {/* Purchase Cost */}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cost (₹)"
                    className="input-field"
                    value={row.purchase_price}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].purchase_price = parseFloat(e.target.value) || 0;
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    style={{ fontSize: "0.825rem" }}
                  />

                  {/* Batch Number */}
                  <input
                    type="text"
                    placeholder="Batch No (Opt)"
                    className="input-field"
                    value={row.batch_number}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].batch_number = e.target.value;
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    style={{ fontSize: "0.825rem" }}
                  />

                  {/* Expiry Date */}
                  <input
                    type="date"
                    className="input-field"
                    value={row.expiry_date}
                    onChange={(e) => {
                      const updated = [...stockInForm.items];
                      updated[idx].expiry_date = e.target.value;
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    style={{ fontSize: "0.825rem" }}
                  />

                  {/* Remove Row */}
                  <button
                    type="button"
                    onClick={() => {
                      if (stockInForm.items.length <= 1) return;
                      const updated = stockInForm.items.filter((_, i) => i !== idx);
                      setStockInForm({ ...stockInForm, items: updated });
                    }}
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Notes / Goods Receipt Memo
              </label>
              <textarea
                placeholder="Optional notes regarding this consignment..."
                className="input-field"
                rows={2}
                value={stockInForm.notes}
                onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button type="button" onClick={() => setActiveTab("overview")} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Confirm & Stock-In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 3: GODOWNS & BRANCHES --- */}
      {activeTab === "godowns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
              Warehouse & Branch Locations ({godowns.length})
            </h3>
            {isAdmin && (
              <button onClick={openCreateGodown} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> Add New Godown
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {godowns.map((g) => (
              <div key={g.id} className="glass-panel" style={{ padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>{g.name}</h4>
                      <span className="badge badge-blue" style={{ fontSize: "0.7rem", marginTop: "4px" }}>Code: {g.code}</span>
                    </div>
                    {g.is_default && (
                      <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>★ Default Counter</span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.4", margin: "10px 0" }}>
                    <div><strong>Address:</strong> {g.address || "—"}</div>
                    {(g.city || g.state) && <div><strong>City/State:</strong> {[g.city, g.state, g.pincode].filter(Boolean).join(", ")}</div>}
                    {g.contact_person && <div><strong>Contact:</strong> {g.contact_person} {g.contact_number ? `(${g.contact_number})` : ""}</div>}
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "12px" }}>
                    <button onClick={() => openEditGodown(g)} className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: STOCK TRANSFERS --- */}
      {activeTab === "transfers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Transfer Form (Admin only) */}
          {isAdmin && (
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                <ArrowRightLeft size={20} color="#38bdf8" />
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>Execute Inter-Godown Stock Transfer</h3>
              </div>

              <form onSubmit={handleTransferSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                      From Source Godown *
                    </label>
                    <select
                      className="input-field"
                      value={transferForm.from_godown_id}
                      onChange={(e) => setTransferForm({ ...transferForm, from_godown_id: e.target.value })}
                      required
                    >
                      {godowns.map((g) => (
                        <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                      To Destination Godown *
                    </label>
                    <select
                      className="input-field"
                      value={transferForm.to_godown_id}
                      onChange={(e) => setTransferForm({ ...transferForm, to_godown_id: e.target.value })}
                      required
                    >
                      <option value="">Select Destination...</option>
                      {godowns
                        .filter((g) => g.id !== transferForm.from_godown_id)
                        .map((g) => (
                          <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Transfer items */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.825rem", fontWeight: 700, color: "#f8fafc" }}>Items to Transfer</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTransferForm({
                          ...transferForm,
                          items: [...transferForm.items, { item_id: "", quantity: 1, batch_number: "", unit: "PCS", notes: "" }],
                        })
                      }
                      className="btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      + Add Item
                    </button>
                  </div>

                  {transferForm.items.map((row, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 32px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      <select
                        className="input-field"
                        value={row.item_id}
                        onChange={(e) => {
                          const updated = [...transferForm.items];
                          const selItem = allItemsList.find((it) => it.id === e.target.value);
                          updated[idx].item_id = e.target.value;
                          if (selItem) updated[idx].unit = selItem.unit;
                          setTransferForm({ ...transferForm, items: updated });
                        }}
                        required
                        style={{ fontSize: "0.825rem" }}
                      >
                        <option value="">Select Item...</option>
                        {allItemsList.map((it) => (
                          <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Quantity"
                        className="input-field"
                        value={row.quantity}
                        onChange={(e) => {
                          const updated = [...transferForm.items];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setTransferForm({ ...transferForm, items: updated });
                        }}
                        required
                        style={{ fontSize: "0.825rem" }}
                      />

                      <input
                        type="text"
                        placeholder="Batch No (Opt)"
                        className="input-field"
                        value={row.batch_number}
                        onChange={(e) => {
                          const updated = [...transferForm.items];
                          updated[idx].batch_number = e.target.value;
                          setTransferForm({ ...transferForm, items: updated });
                        }}
                        style={{ fontSize: "0.825rem" }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (transferForm.items.length <= 1) return;
                          setTransferForm({ ...transferForm, items: transferForm.items.filter((_, i) => i !== idx) });
                        }}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <textarea
                  placeholder="Transfer notes (e.g. branch vehicle #MH-04-1234)..."
                  className="input-field"
                  rows={2}
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="submit" className="btn-primary">
                    Transfer Stock
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transfers History */}
          <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "#f8fafc" }}>
              Stock Transfer History
            </div>
            <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Transfer # & Date</th>
                  <th>Source Godown</th>
                  <th>Destination Godown</th>
                  <th>Items Transferred</th>
                  <th>Status</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "28px", color: "var(--text-muted)" }}>
                      No stock transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: "#38bdf8" }}>{t.transfer_number}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(t.transfer_date).toLocaleString("en-IN")}</div>
                      </td>
                      <td><span className="badge badge-blue">{t.from_godown_name}</span></td>
                      <td><span className="badge badge-purple">{t.to_godown_name}</span></td>
                      <td>
                        {t.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: "0.8rem" }}>
                            • {it.item_name || "Item"}: <strong>{it.quantity} {it.unit}</strong>
                          </div>
                        ))}
                      </td>
                      <td><span className="badge badge-success">{t.status}</span></td>
                      <td>{t.created_by_name || "Admin"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 5: MOVEMENT LEDGER --- */}
      {activeTab === "movements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="glass-panel" style={{ padding: "14px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "#f8fafc" }}>Complete Stock Movement & Audit Log</div>
            <select
              className="input-field"
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              style={{ width: "200px" }}
            >
              <option value="all">All Movement Types</option>
              <option value="sale_out">Sale Out (POS / Invoices)</option>
              <option value="purchase_in">Purchase In (Restock)</option>
              <option value="transfer_in">Transfer In</option>
              <option value="transfer_out">Transfer Out</option>
              <option value="adjustment_in">Adjustment In (+)</option>
              <option value="adjustment_out">Adjustment Out (-)</option>
              <option value="void_restock">Void Restock (Bill Void)</option>
            </select>
          </div>

          <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden" }}>
            <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Item</th>
                  <th>Godown</th>
                  <th>Movement Type</th>
                  <th style={{ textAlign: "right" }}>Quantity</th>
                  <th style={{ textAlign: "right" }}>Balance After</th>
                  <th>Reference & Notes</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                      No movements found.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = ["purchase_in", "transfer_in", "adjustment_in", "void_restock"].includes(m.movement_type);
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td style={{ fontWeight: 600, color: "#f8fafc" }}>{m.item_name}</td>
                        <td>{m.godown_name}</td>
                        <td>
                          <span
                            className={`badge ${
                              isPositive ? "badge-success" : m.movement_type === "sale_out" ? "badge-blue" : "badge-danger"
                            }`}
                            style={{ textTransform: "uppercase", fontSize: "0.7rem" }}
                          >
                            {m.movement_type.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: isPositive ? "#34d399" : "#f87171" }}>
                          {isPositive ? `+${m.quantity}` : `-${m.quantity}`} {m.item_unit}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#f8fafc" }}>
                          {m.balance_after} {m.item_unit}
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          <div>{m.reference_id && <strong>Ref: {m.reference_id}</strong>}</div>
                          <div>{m.notes || "—"}</div>
                        </td>
                        <td style={{ fontSize: "0.8rem" }}>{m.performed_by_name || "System"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 6: ALERTS & EXPIRY --- */}
      {activeTab === "alerts" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Low Stock Alerts */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#fbbf24" }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                Low Stock Threshold Alerts ({lowStockAlerts.length})
              </h3>
            </div>

            {lowStockAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#34d399" }}>
                <CheckCircle2 size={36} style={{ margin: "0 auto 8px auto" }} />
                <div>All inventory items have healthy stock levels!</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {lowStockAlerts.map((a) => (
                  <div key={a.item_id} style={{ padding: "12px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{a.item_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Current: <strong style={{ color: "#ef4444" }}>{a.total_quantity} {a.unit}</strong> | Min Alert: <strong>{a.min_stock_alert} {a.unit}</strong>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTab("stock_in");
                          setStockInForm({
                            ...stockInForm,
                            items: [{ item_id: a.item_id, quantity: 20, purchase_price: 0, batch_number: "", expiry_date: "" }],
                          });
                        }}
                        className="btn-primary"
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      >
                        Restock
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Batches */}
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#f87171" }}>
              <Clock size={20} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                Batches Expiring Soon ({expiringAlerts.length})
              </h3>
            </div>

            {expiringAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#34d399" }}>
                <CheckCircle2 size={36} style={{ margin: "0 auto 8px auto" }} />
                <div>No active batches expiring within the next 60 days.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {expiringAlerts.map((b) => (
                  <div key={b.batch_id} style={{ padding: "12px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{b.item_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Batch: <strong>{b.batch_number}</strong> ({b.quantity} {b.unit}) | Godown: {b.godown_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: b.days_to_expiry < 0 ? "#ef4444" : "#fbbf24", marginTop: "2px" }}>
                        Expiry: {b.expiry_date} ({b.days_to_expiry < 0 ? "EXPIRED" : `${b.days_to_expiry} days remaining`})
                      </div>
                    </div>
                    <span className={`badge ${b.days_to_expiry < 0 ? "badge-danger" : "badge-warning"}`}>
                      {b.days_to_expiry < 0 ? "EXPIRED" : "EXPIRING"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT GODOWN --- */}
      {showGodownModal && (
        <div className="modal-overlay" onClick={() => setShowGodownModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "500px", padding: "24px", borderRadius: "14px", background: "#0f172a" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                {editingGodown ? "Edit Godown Location" : "Add New Godown / Warehouse"}
              </h3>
              <button onClick={() => setShowGodownModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGodown} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Godown Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Warehouse"
                  className="input-field"
                  value={godownForm.name}
                  onChange={(e) => setGodownForm({ ...godownForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Godown Code (Unique) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. WH-02"
                  className="input-field"
                  value={godownForm.code}
                  onChange={(e) => setGodownForm({ ...godownForm, code: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Address / Location
                </label>
                <textarea
                  placeholder="Street Address..."
                  className="input-field"
                  rows={2}
                  value={godownForm.address}
                  onChange={(e) => setGodownForm({ ...godownForm, address: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="City"
                  className="input-field"
                  value={godownForm.city}
                  onChange={(e) => setGodownForm({ ...godownForm, city: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  className="input-field"
                  value={godownForm.pincode}
                  onChange={(e) => setGodownForm({ ...godownForm, pincode: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Contact Person"
                  className="input-field"
                  value={godownForm.contact_person}
                  onChange={(e) => setGodownForm({ ...godownForm, contact_person: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Contact Number"
                  className="input-field"
                  value={godownForm.contact_number}
                  onChange={(e) => setGodownForm({ ...godownForm, contact_number: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={godownForm.is_default}
                    onChange={(e) => setGodownForm({ ...godownForm, is_default: e.target.checked })}
                  />
                  Default Counter Warehouse
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={godownForm.is_active}
                    onChange={(e) => setGodownForm({ ...godownForm, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowGodownModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Godown
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: STOCK ADJUSTMENT --- */}
      {showAdjustModal && adjustTargetItem && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "450px", padding: "24px", borderRadius: "14px", background: "#0f172a" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>Adjust Item Stock</h3>
                <div style={{ fontSize: "0.8rem", color: "#38bdf8" }}>{adjustTargetItem.item_name}</div>
              </div>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Godown / Location *
                </label>
                <select
                  className="input-field"
                  value={adjustForm.godown_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, godown_id: e.target.value })}
                  required
                >
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Adjustment Action *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                  {[
                    { id: "add", label: "Add (+)" },
                    { id: "subtract", label: "Reduce (-)" },
                    { id: "set", label: "Set Exact" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setAdjustForm({ ...adjustForm, adjustment_type: act.id })}
                      className={adjustForm.adjustment_type === act.id ? "btn-primary" : "btn-secondary"}
                      style={{ padding: "6px", fontSize: "0.8rem" }}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Quantity ({adjustTargetItem.unit}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input-field"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Reason *
                </label>
                <select
                  className="input-field"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  required
                >
                  <option value="Physical count correction">Physical count correction</option>
                  <option value="Damaged / Broken goods">Damaged / Broken goods</option>
                  <option value="Wastage / Expiry write-off">Wastage / Expiry write-off</option>
                  <option value="Supplier sample">Supplier sample</option>
                  <option value="Internal usage">Internal usage</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional details..."
                  className="input-field"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAdjustModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
