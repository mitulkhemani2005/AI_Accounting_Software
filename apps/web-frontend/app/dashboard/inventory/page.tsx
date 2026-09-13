"use client";

import React, { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CSVImportModal } from "@/components/CSVImportModal";
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
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Barcode,
  Tag,
  Trash2,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  FileText,
  Printer,
  Eye,
  IndianRupee,
  Receipt,
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
  secondary_unit?: string;
  units_per_case?: number;
  total_cases?: number;
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
  const [activeTab, setActiveTab] = useState<"overview" | "stock_in" | "purchases" | "godowns" | "transfers" | "movements" | "alerts" | "ai_restock">("overview");

  // State
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [stocks, setStocks] = useState<ItemStockSummary[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<ExpiringBatchAlert[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState("all");
  const [selectedPurchaseBill, setSelectedPurchaseBill] = useState<any | null>(null);
  const [isDownloadingPurchasePdf, setIsDownloadingPurchasePdf] = useState(false);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productModalReturnTarget, setProductModalReturnTarget] = useState<{ target: "stock_in"; rowIndex?: number } | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "Groceries",
    unit: "EA",
    secondary_unit: "CS",
    units_per_case: "1",
    sale_price: "",
    purchase_price: "",
    sale_price_mode: "EA" as "EA" | "CS",
    cost_price_mode: "EA" as "EA" | "CS",
    gst_rate: "18",
    is_tax_inclusive: false,
    hsn_code: "",
    min_stock_alert: "5",
    opening_stock: "0",
    opening_godown_id: "",
  });
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

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

  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Stock In Form State (Options: product, cs, ea, batch(opt) only)
  const [stockInForm, setStockInForm] = useState<{
    godown_id: string;
    supplier_id?: string;
    supplier_name: string;
    invoice_number: string;
    payment_mode: "credit" | "cash";
    items: {
      item_id: string;
      cases: number | string;
      loose_ea: number | string;
      batch_number: string;
    }[];
    notes: string;
  }>({
    godown_id: "",
    supplier_id: "",
    supplier_name: "",
    invoice_number: "",
    payment_mode: "credit",
    items: [
      {
        item_id: "",
        cases: 1,
        loose_ea: 0,
        batch_number: "",
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
  const [allItemsList, setAllItemsList] = useState<{
    id: string;
    name: string;
    sku?: string;
    barcode?: string;
    category?: string;
    unit: string;
    secondary_unit?: string;
    units_per_case?: number;
    purchase_price: number;
    sale_price?: number;
    gst_rate?: number;
    is_tax_inclusive?: boolean;
    hsn_code?: string;
  }[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam && ["overview", "stock_in", "purchases", "godowns", "transfers", "movements", "alerts"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
    loadAllData();
  }, []);

  const loadPurchaseBills = async () => {
    setIsLoadingPurchases(true);
    try {
      const res = await api.get("/bills", {
        params: {
          bill_type: "purchase",
        },
      });
      setPurchaseBills(res.data);
    } catch (err) {
      console.error("Failed to load purchase bills", err);
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  const handleDownloadPurchasePdf = async (billId: string, billNumber: string) => {
    setIsDownloadingPurchasePdf(true);
    try {
      const res = await api.get(`/bills/${billId}/pdf?format=half_a4`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Purchase_${billNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to download purchase PDF voucher");
    } finally {
      setIsDownloadingPurchasePdf(false);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, stocksRes, godownsRes, alertsRes, expiringRes, suppsRes] = await Promise.all([
        api.get("/inventory/metrics"),
        api.get("/inventory/stock"),
        api.get("/inventory/godowns"),
        api.get("/inventory/alerts/low-stock"),
        api.get("/inventory/alerts/expiring?days=60"),
        api.get("/parties/suppliers"),
      ]);

      setMetrics(metricsRes.data);
      setStocks(stocksRes.data);
      setGodowns(godownsRes.data);
      setLowStockAlerts(alertsRes.data);
      setExpiringAlerts(expiringRes.data);
      setSuppliersList(suppsRes.data);

      // Fetch Items list for drop-downs
      const itemsRes = await api.get("/items");
      setAllItemsList(itemsRes.data);

      // Load purchase bills
      loadPurchaseBills();

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
    if (activeTab === "purchases") loadPurchaseBills();
  }, [activeTab, movementTypeFilter]);

  // --- Product Master CRUD & Quick Restock ---
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductModalReturnTarget(null);
    const def = godowns.find((g) => g.is_default) || godowns[0];
    setProductForm({
      name: "",
      sku: "",
      barcode: "",
      category: "Groceries",
      unit: "EA",
      secondary_unit: "CS",
      units_per_case: "1",
      sale_price: "",
      purchase_price: "",
      sale_price_mode: "EA",
      cost_price_mode: "EA",
      gst_rate: "18",
      is_tax_inclusive: false,
      hsn_code: "",
      min_stock_alert: "5",
      opening_stock: "0",
      opening_godown_id: def ? def.id : "",
    });
    setProductError(null);
    setShowProductModal(true);
  };

  const openCreateProductForStockIn = (rowIndex?: number) => {
    setEditingProduct(null);
    setProductModalReturnTarget({ target: "stock_in", rowIndex });
    const def = godowns.find((g) => g.is_default) || godowns[0];
    setProductForm({
      name: "",
      sku: "",
      barcode: "",
      category: "Groceries",
      unit: "EA",
      secondary_unit: "CS",
      units_per_case: "1",
      sale_price: "",
      purchase_price: "",
      sale_price_mode: "EA",
      cost_price_mode: "EA",
      gst_rate: "18",
      is_tax_inclusive: false,
      hsn_code: "",
      min_stock_alert: "5",
      opening_stock: "0",
      opening_godown_id: def ? def.id : "",
    });
    setProductError(null);
    setShowProductModal(true);
  };

  const openEditProduct = (stockItem: ItemStockSummary) => {
    const fullItem = allItemsList.find((i) => i.id === stockItem.item_id) || stockItem;
    setEditingProduct({ id: stockItem.item_id, ...fullItem });
    setProductModalReturnTarget(null);
    setProductForm({
      name: stockItem.item_name,
      sku: stockItem.sku || "",
      barcode: stockItem.barcode || "",
      category: stockItem.category || "General",
      unit: stockItem.unit || "EA",
      secondary_unit: (fullItem as any).secondary_unit || stockItem.secondary_unit || "CS",
      units_per_case: ((fullItem as any).units_per_case || stockItem.units_per_case || 1).toString(),
      sale_price: stockItem.sale_price.toString(),
      purchase_price: stockItem.purchase_price.toString(),
      sale_price_mode: "EA",
      cost_price_mode: "EA",
      gst_rate: (fullItem as any).gst_rate !== undefined ? (fullItem as any).gst_rate.toString() : "18",
      is_tax_inclusive: (fullItem as any).is_tax_inclusive || false,
      hsn_code: (fullItem as any).hsn_code || "",
      min_stock_alert: stockItem.min_stock_alert.toString(),
      opening_stock: "0",
      opening_godown_id: "",
    });
    setProductError(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProduct(true);
    setProductError(null);

    const uPerCase = parseFloat(productForm.units_per_case) || 1.0;
    
    // Calculate base selling price per EA
    let rawSalePrice = parseFloat(productForm.sale_price) || 0;
    let baseSalePrice = rawSalePrice;
    if (productForm.sale_price_mode === "CS" && uPerCase > 0) {
      baseSalePrice = Math.round((rawSalePrice / uPerCase) * 10000) / 10000;
    }

    // Calculate base purchase cost per EA
    let rawPurchasePrice = parseFloat(productForm.purchase_price) || 0;
    let basePurchasePrice = rawPurchasePrice;
    if (productForm.cost_price_mode === "CS" && uPerCase > 0) {
      basePurchasePrice = Math.round((rawPurchasePrice / uPerCase) * 10000) / 10000;
    }

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || undefined,
      barcode: productForm.barcode.trim() || undefined,
      category: productForm.category.trim() || "General",
      unit: productForm.unit.trim() || "EA",
      secondary_unit: productForm.secondary_unit.trim() || "CS",
      units_per_case: uPerCase,
      sale_price: baseSalePrice,
      purchase_price: basePurchasePrice,
      gst_rate: parseFloat(productForm.gst_rate) || 0,
      is_tax_inclusive: productForm.is_tax_inclusive,
      hsn_code: productForm.hsn_code.trim() || undefined,
      min_stock_alert: parseFloat(productForm.min_stock_alert) || 0,
    };

    try {
      let createdOrUpdatedItem: any = null;
      if (editingProduct) {
        const res = await api.put(`/items/${editingProduct.id}`, payload);
        createdOrUpdatedItem = res.data;
      } else {
        const createRes = await api.post("/items", payload);
        createdOrUpdatedItem = createRes.data;
        const openingQty = parseFloat(productForm.opening_stock) || 0;
        if (openingQty > 0) {
          const targetGodown = productForm.opening_godown_id || (godowns.find((g) => g.is_default) || godowns[0])?.id;
          if (targetGodown) {
            try {
              await api.post("/inventory/stock-in", {
                godown_id: targetGodown,
                supplier_name: "Opening Stock Setup",
                items: [
                  {
                    item_id: createRes.data.id,
                    quantity: openingQty,
                    unit: productForm.unit.trim() || "EA",
                    purchase_price: parseFloat(productForm.purchase_price) || 0,
                    batch_number: "BATCH-INIT",
                  },
                ],
                notes: "Initial opening stock upon product creation",
              });
            } catch (stkErr) {
              console.warn("Opening stock could not be created automatically:", stkErr);
            }
          }
        }
      }
      setShowProductModal(false);
      setEditingProduct(null);
      await loadAllData();

      // If opened from Stock-In form, automatically select newly created product into the target row
      if (productModalReturnTarget?.target === "stock_in" && createdOrUpdatedItem) {
        setStockInForm((prev) => {
          const updated = [...prev.items];
          const rIdx = productModalReturnTarget.rowIndex;
          const newRow = {
            item_id: createdOrUpdatedItem.id,
            cases: 1,
            loose_ea: 0,
            batch_number: "",
          };
          if (rIdx !== undefined && rIdx >= 0 && rIdx < updated.length) {
            updated[rIdx] = newRow;
          } else {
            updated.push(newRow);
          }
          return { ...prev, items: updated };
        });
        setActiveTab("stock_in");
      }
      setProductModalReturnTarget(null);
    } catch (err: any) {
      setProductError(err.response?.data?.detail || "Failed to save product");
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (itemId: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate/delete product "${name}"?`)) return;
    try {
      await api.delete(`/items/${itemId}`);
      await loadAllData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete product");
    }
  };

  const quickStockInItem = (item: ItemStockSummary) => {
    const def = godowns.find((g) => g.is_default) || godowns[0];
    setStockInForm({
      godown_id: def ? def.id : "",
      supplier_name: "",
      invoice_number: "",
      payment_mode: "credit",
      items: [
        {
          item_id: item.item_id,
          cases: 1,
          loose_ea: 0,
          batch_number: `BATCH-${Date.now().toString().slice(-4)}`,
        },
      ],
      notes: `Quick restock for ${item.item_name}`,
    });
    setActiveTab("stock_in");
  };

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
      const payload = {
        godown_id: stockInForm.godown_id,
        supplier_id: stockInForm.supplier_id || undefined,
        supplier_name: stockInForm.supplier_name,
        invoice_number: stockInForm.invoice_number,
        payment_mode: stockInForm.payment_mode || "credit",
        items: stockInForm.items.map((row) => {
          const selItem = allItemsList.find((it) => it.id === row.item_id);
          const uPerCase = selItem?.units_per_case && selItem.units_per_case > 0 ? selItem.units_per_case : 1;
          const cVal = parseFloat(row.cases?.toString() || "0") || 0;
          const eVal = parseFloat(row.loose_ea?.toString() || "0") || 0;
          const totalBaseQty = (cVal * uPerCase) + eVal;

          return {
            item_id: row.item_id,
            quantity: totalBaseQty > 0 ? totalBaseQty : 1,
            unit: "EA",
            cases: cVal > 0 ? cVal : undefined,
            batch_number: row.batch_number.trim() || undefined,
          };
        }),
        notes: stockInForm.notes,
      };

      const res = await api.post("/inventory/stock-in", payload);
      const purBillNo = res.data?.purchase_bill_number || res.data?.purchase_bill_id || "";
      alert(`✅ Stock-in recorded successfully and added to Purchase Book${purBillNo ? ` as Voucher #${purBillNo}` : ""}!`);
      // Reset form
      setStockInForm({
        godown_id: godowns.find((g) => g.is_default)?.id || "",
        supplier_id: "",
        supplier_name: "",
        invoice_number: "",
        payment_mode: "credit",
        items: [{ item_id: "", cases: 1, loose_ea: 0, batch_number: "" }],
        notes: "",
      });
      await loadAllData();
      await loadPurchaseBills();
      setActiveTab("purchases");
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
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
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
  }, [stocks, searchTerm, categoryFilter, lowStockOnly, godownFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(stocks.map((s) => s.category))).filter(Boolean);
  }, [stocks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Boxes size={28} color="#2563eb" />
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Products & Inventory Master
            </h1>
            <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>Unified Master</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "4px 0 0 0" }}>
            Unified catalog master, multi-godown stock levels, batch tracking, purchase restocking & transfers
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={loadAllData} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={15} /> Refresh
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setShowImportModal(true)} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FileSpreadsheet size={15} color="#2563eb" /> Import CSV
              </button>
              <button onClick={openCreateProduct} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> + Add Product
              </button>
              <button onClick={() => setActiveTab("stock_in")} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Truck size={15} /> Stock-In (Purchase)
              </button>
              <button onClick={() => setActiveTab("transfers")} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ArrowRightLeft size={15} /> Transfer Stock
              </button>
              <button onClick={openCreateGodown} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Warehouse size={15} /> + Godown
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Total Units */}
          <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "14px", background: "#ffffff" }}>
            <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", color: "#2563eb" }}>
              <Package size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Stock On Hand</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0f172a" }}>{metrics.total_stock_units} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Units</span></div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{metrics.total_items_count} catalog items</div>
            </div>
          </div>

          {/* Valuation Cost */}
          <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "14px", background: "#ffffff" }}>
            <div style={{ background: "#dcfce7", padding: "12px", borderRadius: "8px", color: "#16a34a" }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Valuation (Cost)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#16a34a" }}>₹{metrics.total_inventory_valuation_cost.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Retail value: ₹{metrics.total_inventory_valuation_sale.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div
            className="glass-panel"
            style={{
              padding: "18px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              border: metrics.low_stock_items_count > 0 ? "1px solid #fcd34d" : undefined,
              background: metrics.low_stock_items_count > 0 ? "#fffbeb" : "#ffffff",
              cursor: "pointer",
            }}
            onClick={() => {
              setActiveTab("overview");
              setLowStockOnly(true);
            }}
          >
            <div style={{ background: "#fef3c7", padding: "12px", borderRadius: "8px", color: "#b45309" }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Low / Out of Stock</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#b45309" }}>{metrics.low_stock_items_count} <span style={{ fontSize: "0.8rem", color: "#dc2626" }}>({metrics.out_of_stock_items_count} Out)</span></div>
              <div style={{ fontSize: "0.7rem", color: "#2563eb" }}>Click to filter low stock items</div>
            </div>
          </div>

          {/* Expiring Batches */}
          <div
            className="glass-panel"
            style={{
              padding: "18px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              border: metrics.expiring_soon_batches_count > 0 ? "1px solid #fca5a5" : undefined,
              background: metrics.expiring_soon_batches_count > 0 ? "#fef2f2" : "#ffffff",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("alerts")}
          >
            <div style={{ background: "#fee2e2", padding: "12px", borderRadius: "8px", color: "#dc2626" }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Expiring Soon (60d)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#dc2626" }}>{metrics.expiring_soon_batches_count} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Batches</span></div>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Across {metrics.active_godowns_count} active godowns</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px", overflowX: "auto" }}>
        {[
          { id: "overview", label: "Products & Stock Master", icon: Package },
          { id: "stock_in", label: "Stock-In (Purchase)", icon: Plus, adminOnly: true },
          { id: "purchases", label: `Purchase Book (${purchaseBills.length})`, icon: FileSpreadsheet, adminOnly: true },
          { id: "godowns", label: "Godowns & Branches", icon: Warehouse },
          { id: "transfers", label: "Stock Transfers", icon: ArrowRightLeft },
          { id: "movements", label: "Movement Ledger", icon: History },
          { id: "alerts", label: `Alerts (${lowStockAlerts.length + expiringAlerts.length})`, icon: ShieldAlert },
          { id: "ai_restock", label: "✨ AI Restock Forecast", icon: Sparkles, adminOnly: true },
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

      {/* --- TAB 1: PRODUCTS & STOCK OVERVIEW --- */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filters & Actions Bar */}
          <div className="glass-panel" style={{ padding: "16px", borderRadius: "8px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
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

            {/* Quick Actions & Low Stock Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: lowStockOnly ? "#b45309" : "var(--text-muted)", fontWeight: lowStockOnly ? 700 : 500 }}>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                ⚠️ Low Stock Only
              </label>

              {isAdmin && (
                <button
                  onClick={openCreateProduct}
                  className="btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={14} /> Add Product
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel" style={{ borderRadius: "8px", overflow: "hidden" }}>
            <table className="custom-table" style={{ width: "100%", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Product & Details</th>
                  <th>Godown Breakdown</th>
                  <th style={{ textAlign: "right" }}>Cost Price</th>
                  <th style={{ textAlign: "right" }}>Sale Price</th>
                  <th style={{ textAlign: "right" }}>On Hand</th>
                  <th style={{ textAlign: "right" }}>Valuation (Cost)</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                      No items found. Click <strong>"+ Add Product"</strong> to create a new item in your catalog.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((item) => {
                    const fullItem = allItemsList.find((i) => i.id === item.item_id);
                    return (
                      <tr key={item.item_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{item.item_name}</div>
                            <span className="badge badge-purple" style={{ fontSize: "0.68rem" }}>{item.category}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "3px" }}>
                            {item.sku && <span>SKU: <strong style={{ color: "#475569" }}>{item.sku}</strong></span>}
                            {item.barcode && <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}><Barcode size={12} color="#2563eb" /> {item.barcode}</span>}
                            {(fullItem as any)?.hsn_code && <span>HSN: {(fullItem as any).hsn_code}</span>}
                            {(fullItem as any)?.is_tax_inclusive && <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>Tax Incl. (MRP)</span>}
                          </div>
                          {/* Batches pill */}
                          {item.active_batches.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                              {item.active_batches.map((b) => (
                                <span key={b.id} className="badge badge-blue" style={{ fontSize: "0.65rem" }}>
                                  Batch: {b.batch_number} ({b.quantity} {item.unit}) {b.expiry_date ? `• Exp: ${b.expiry_date}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: "0.75rem" }}>
                            {item.godown_breakdown.length === 0 ? (
                              <span style={{ color: "#dc2626", fontWeight: 600 }}>No stock in any godown</span>
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
                        <td style={{ textAlign: "right", color: "var(--text-muted)", fontWeight: 500 }}>₹{item.purchase_price.toFixed(2)}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ color: "#1d4ed8", fontWeight: 700 }}>₹{item.sale_price.toFixed(2)}</div>
                          {(fullItem as any)?.gst_rate !== undefined && (
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>GST: {(fullItem as any).gst_rate}%</div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: item.is_out_of_stock ? "#dc2626" : item.is_low_stock ? "#b45309" : "#16a34a" }}>
                            {item.total_quantity} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{item.unit || "EA"}</span>
                          </div>
                          {item.units_per_case && item.units_per_case > 1 && (
                            <div style={{ marginTop: "2px" }}>
                              <div style={{ fontSize: "0.75rem", color: "#1d4ed8", fontWeight: 600 }}>
                                {Math.floor(item.total_quantity / item.units_per_case)} {item.secondary_unit || "CS"}
                                {item.total_quantity % item.units_per_case > 0 ? ` + ${(item.total_quantity % item.units_per_case).toFixed(0)} ${item.unit || "EA"}` : ""}
                              </div>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                                (1 {item.secondary_unit || "CS"} = {item.units_per_case} {item.unit || "EA"})
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
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
                            <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                              <button
                                onClick={() => openEditProduct(item)}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "3px" }}
                                title="Edit Product Master Details"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                onClick={() => openAdjustStock(item)}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "3px" }}
                                title="Adjust Stock Quantity"
                              >
                                <SlidersHorizontal size={12} /> Adjust
                              </button>
                              <button
                                onClick={() => quickStockInItem(item)}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "3px", color: "#059669", borderColor: "#6ee7b7" }}
                                title="Quick Restock / Stock-In"
                              >
                                <Plus size={12} /> Stock-In
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(item.item_id, item.item_name)}
                                className="btn-secondary"
                                style={{ padding: "4px 6px", fontSize: "0.75rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                                title="Deactivate Item"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: STOCK-IN / PURCHASE ENTRY --- */}
      {activeTab === "stock_in" && isAdmin && (
        <div className="glass-panel" style={{ padding: "24px", borderRadius: "8px", maxWidth: "800px", margin: "0 auto", width: "100%", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <Plus size={22} color="#16a34a" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Record Stock-In / Purchase Goods</h2>
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

              {/* Supplier Selector */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  🚚 Supplier / Vendor
                </label>
                {suppliersList.length > 0 ? (
                  <select
                    className="input-field"
                    value={stockInForm.supplier_id || (stockInForm.supplier_name ? "__CUSTOM__" : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__CUSTOM__") {
                        setStockInForm({ ...stockInForm, supplier_id: "", supplier_name: "" });
                      } else {
                        const found = suppliersList.find((s) => s.id === val);
                        setStockInForm({
                          ...stockInForm,
                          supplier_id: val,
                          supplier_name: found ? found.name : "",
                        });
                      }
                    }}
                  >
                    <option value="">-- Select Registered Supplier (Optional) --</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.area_name ? `(${s.area_name})` : ""} {s.mobile ? `- 📱 ${s.mobile}` : ""}
                      </option>
                    ))}
                    <option value="__CUSTOM__">➕ Enter Custom / Unregistered Supplier Name</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. National Distributors"
                    className="input-field"
                    value={stockInForm.supplier_name}
                    onChange={(e) => setStockInForm({ ...stockInForm, supplier_name: e.target.value })}
                  />
                )}
                {(!stockInForm.supplier_id || suppliersList.length === 0) && (
                  <input
                    type="text"
                    placeholder="Custom Supplier Name..."
                    className="input-field"
                    value={stockInForm.supplier_name}
                    onChange={(e) => setStockInForm({ ...stockInForm, supplier_name: e.target.value, supplier_id: "" })}
                    style={{ marginTop: "6px", fontSize: "0.825rem" }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Payment Mode */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  💳 Purchase Payment Terms
                </label>
                <select
                  className="input-field"
                  value={stockInForm.payment_mode}
                  onChange={(e) => setStockInForm({ ...stockInForm, payment_mode: e.target.value as "credit" | "cash" })}
                >
                  <option value="credit">📒 Credit Purchase (Adds to Supplier Payable Outstanding)</option>
                  <option value="cash">💵 Cash Purchase (Immediate Payment Settled)</option>
                </select>
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
            </div>

            {/* Line Items */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>Restock Line Items</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => openCreateProductForStockIn(stockInForm.items.length)}
                    className="btn-secondary"
                    style={{ padding: "5px 10px", fontSize: "0.75rem", color: "#2563eb", borderColor: "#93c5fd", background: "#eff6ff", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Plus size={13} /> + Add New Product to Catalog
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStockInForm({
                        ...stockInForm,
                        items: [...stockInForm.items, { item_id: "", cases: 1, loose_ea: 0, batch_number: "" }],
                      })
                    }
                    className="btn-secondary"
                    style={{ padding: "5px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
              </div>

              {/* Column Titles Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(200px, 2.5fr) 110px 110px 140px 32px",
                  gap: "8px",
                  padding: "0 10px 6px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                <div>Product *</div>
                <div>CS (Cases)</div>
                <div>EA (Loose)</div>
                <div>Batch (Opt)</div>
                <div></div>
              </div>

              {stockInForm.items.map((row, idx) => {
                const selItem = allItemsList.find((it) => it.id === row.item_id);
                const unitsPerCase = selItem?.units_per_case && selItem.units_per_case > 0 ? selItem.units_per_case : 1;
                const cNum = parseFloat(row.cases?.toString() || "0") || 0;
                const eNum = parseFloat(row.loose_ea?.toString() || "0") || 0;
                const totalUnits = (cNum * unitsPerCase) + eNum;

                return (
                  <div
                    key={idx}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "10px",
                      marginBottom: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2.5fr) 110px 110px 140px 32px", gap: "8px", alignItems: "center" }}>
                      {/* Product Picker & Quick-Add */}
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <select
                          className="input-field"
                          value={row.item_id}
                          onChange={(e) => {
                            if (e.target.value === "__NEW_PRODUCT__") {
                              openCreateProductForStockIn(idx);
                              return;
                            }
                            const updated = [...stockInForm.items];
                            updated[idx].item_id = e.target.value;
                            setStockInForm({ ...stockInForm, items: updated });
                          }}
                          required
                          style={{ fontSize: "0.825rem", flex: 1 }}
                        >
                          <option value="">Select Item...</option>
                          <option value="__NEW_PRODUCT__" style={{ color: "#2563eb", fontWeight: 700 }}>
                            ➕ + Create New Product...
                          </option>
                          {allItemsList.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.unit || "EA"}{it.units_per_case && it.units_per_case > 1 ? ` | 1 CS = ${it.units_per_case} EA` : ""})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Add New Catalog Product"
                          onClick={() => openCreateProductForStockIn(idx)}
                          className="btn-secondary"
                          style={{ padding: "6px 8px", color: "#2563eb", borderColor: "#93c5fd" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* CS (Cases) */}
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="CS"
                          className="input-field"
                          value={row.cases}
                          onChange={(e) => {
                            const updated = [...stockInForm.items];
                            updated[idx].cases = e.target.value;
                            setStockInForm({ ...stockInForm, items: updated });
                          }}
                          style={{ fontSize: "0.825rem" }}
                        />
                      </div>

                      {/* EA (Each / Loose) */}
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="EA"
                          className="input-field"
                          value={row.loose_ea}
                          onChange={(e) => {
                            const updated = [...stockInForm.items];
                            updated[idx].loose_ea = e.target.value;
                            setStockInForm({ ...stockInForm, items: updated });
                          }}
                          style={{ fontSize: "0.825rem" }}
                        />
                      </div>

                      {/* Batch (Opt) */}
                      <div>
                        <input
                          type="text"
                          placeholder="Batch (Opt)"
                          className="input-field"
                          value={row.batch_number}
                          onChange={(e) => {
                            const updated = [...stockInForm.items];
                            updated[idx].batch_number = e.target.value;
                            setStockInForm({ ...stockInForm, items: updated });
                          }}
                          style={{ fontSize: "0.825rem" }}
                        />
                      </div>

                      {/* Remove Row */}
                      <button
                        type="button"
                        onClick={() => {
                          if (stockInForm.items.length <= 1) return;
                          const updated = stockInForm.items.filter((_, i) => i !== idx);
                          setStockInForm({ ...stockInForm, items: updated });
                        }}
                        style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", display: "flex", justifyContent: "center" }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Dynamic Calculation Info Pill */}
                    {selItem && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: "12px", alignItems: "center", paddingLeft: "4px" }}>
                        <span>
                          Ratio: <strong style={{ color: "#0f172a" }}>1 {selItem.secondary_unit || "CS"} = {unitsPerCase} {selItem.unit || "EA"}</strong>
                        </span>
                        <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>
                          📦 Total Received: <strong>{totalUnits.toFixed(0)} {selItem.unit || "EA"}</strong>
                          {cNum > 0 && eNum > 0 ? ` (${cNum} CS + ${eNum} EA)` : cNum > 0 ? ` (${cNum} CS)` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* --- TAB: PURCHASE BOOK (INWARD REGISTER) --- */}
      {activeTab === "purchases" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Purchase Summary KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", borderLeft: "4px solid #2563eb", background: "#ffffff" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Inward Purchases</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2563eb", marginTop: "4px" }}>
                ₹{purchaseBills.reduce((acc, b) => acc + (b.total_amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Across {purchaseBills.length} purchase vouchers
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", borderLeft: "4px solid #16a34a", background: "#ffffff" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Taxable Inward Value</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#16a34a", marginTop: "4px" }}>
                ₹{purchaseBills.reduce((acc, b) => acc + (b.taxable_amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Net cost of goods acquired
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", borderLeft: "4px solid #d97706", background: "#ffffff" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Input GST Credit (ITC)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706", marginTop: "4px" }}>
                ₹{purchaseBills.reduce((acc, b) => acc + (b.gst_amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Eligible input tax credit
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "18px", borderRadius: "8px", borderLeft: "4px solid #7c3aed", background: "#ffffff" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Suppliers & Vendors</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#7c3aed", marginTop: "4px" }}>
                {Array.from(new Set(purchaseBills.map((b) => b.party_name).filter(Boolean))).length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Active registered trade vendors
              </div>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="glass-panel" style={{ padding: "16px", borderRadius: "8px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, minWidth: "280px" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search by Voucher #, Supplier Name, Item..."
                  className="input-field"
                  style={{ paddingLeft: "36px" }}
                  value={purchaseSearchTerm}
                  onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                />
              </div>

              {/* Supplier Filter */}
              <select
                className="input-field"
                style={{ width: "auto", minWidth: "180px" }}
                value={purchaseSupplierFilter}
                onChange={(e) => setPurchaseSupplierFilter(e.target.value)}
              >
                <option value="all">All Suppliers ({Array.from(new Set(purchaseBills.map((b) => b.party_name).filter(Boolean))).length})</option>
                {Array.from(new Set(purchaseBills.map((b) => b.party_name).filter(Boolean))).map((sup) => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={loadPurchaseBills}
                className="btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                title="Refresh Purchase Book"
              >
                <RefreshCw size={14} className={isLoadingPurchases ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setActiveTab("stock_in")}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={16} />
                <span>+ Stock-In / Purchase Goods</span>
              </button>
            </div>
          </div>

          {/* Purchases Register Table */}
          <div className="glass-panel" style={{ borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileSpreadsheet size={18} color="#2563eb" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Official Purchase Book Register
                </h3>
              </div>
              <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
                {purchaseBills.filter((b) => {
                  if (purchaseSupplierFilter !== "all" && b.party_name !== purchaseSupplierFilter) return false;
                  if (purchaseSearchTerm.trim()) {
                    const q = purchaseSearchTerm.toLowerCase();
                    const inNumber = b.bill_number?.toLowerCase().includes(q);
                    const inParty = b.party_name?.toLowerCase().includes(q);
                    const inNotes = b.notes?.toLowerCase().includes(q);
                    const inItems = b.items?.some((it: any) => it.item_name?.toLowerCase().includes(q));
                    if (!inNumber && !inParty && !inNotes && !inItems) return false;
                  }
                  return true;
                }).length} Vouchers Recorded
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem", background: "#ffffff" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>VOUCHER / INVOICE #</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>DATE & TIME</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>SUPPLIER / VENDOR</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>PURCHASED ITEMS</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>TAXABLE (₹)</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>GST (₹)</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>TOTAL (₹)</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "center" }}>STATUS</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, background: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "center" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseBills
                    .filter((b) => {
                      if (purchaseSupplierFilter !== "all" && b.party_name !== purchaseSupplierFilter) return false;
                      if (purchaseSearchTerm.trim()) {
                        const q = purchaseSearchTerm.toLowerCase();
                        const inNumber = b.bill_number?.toLowerCase().includes(q);
                        const inParty = b.party_name?.toLowerCase().includes(q);
                        const inNotes = b.notes?.toLowerCase().includes(q);
                        const inItems = b.items?.some((it: any) => it.item_name?.toLowerCase().includes(q));
                        if (!inNumber && !inParty && !inNotes && !inItems) return false;
                      }
                      return true;
                    })
                    .map((pb) => {
                      const purDate = new Date(pb.created_at);
                      const itemsList = pb.items || [];
                      return (
                        <tr key={pb.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {/* Invoice # */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 700, color: "#2563eb", display: "flex", alignItems: "center", gap: "6px" }}>
                              <Receipt size={14} color="#2563eb" />
                              <span>{pb.bill_number}</span>
                            </div>
                            <span className="badge badge-secondary" style={{ fontSize: "0.65rem", marginTop: "4px" }}>
                              PURCHASE INWARD
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div style={{ color: "#0f172a", fontWeight: 600 }}>
                              {purDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {purDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>

                          {/* Supplier */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                              <Building2 size={14} color="#64748b" />
                              <span>{pb.party_name}</span>
                            </div>
                            {pb.party_gst && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                GST: {pb.party_gst}
                              </div>
                            )}
                          </td>

                          {/* Items Summary */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", maxWidth: "260px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {itemsList.slice(0, 3).map((it: any, idx: number) => {
                                const itMaster = allItemsList.find((m) => m.id === it.item_id);
                                const uPerCase = itMaster?.units_per_case && itMaster.units_per_case > 0 ? itMaster.units_per_case : 1;
                                const csCount = (uPerCase > 1 && it.quantity >= uPerCase) ? Math.floor(it.quantity / uPerCase) : 0;
                                const looseCount = uPerCase > 1 ? (it.quantity % uPerCase) : it.quantity;

                                return (
                                  <div key={idx} style={{ fontSize: "0.8rem", color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb", flexShrink: 0 }}></span>
                                    <span style={{ fontWeight: 600 }}>{it.item_name}</span>
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                      {csCount > 0 ? `(${csCount} CS${looseCount > 0 ? ` + ${looseCount} EA` : ""})` : `(${it.quantity} ${it.unit || "EA"})`}
                                    </span>
                                  </div>
                                );
                              })}
                              {itemsList.length > 3 && (
                                <span style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}>
                                  +{itemsList.length - 3} more items...
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Taxable */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "right", color: "#475569", fontWeight: 500 }}>
                            ₹{(pb.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* GST */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "right", color: "#b45309", fontWeight: 600 }}>
                            ₹{(pb.gst_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Grand Total */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "right" }}>
                            <div style={{ fontWeight: 800, color: "#16a34a", fontSize: "0.95rem" }}>
                              ₹{(pb.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "center" }}>
                            <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>
                              Recorded
                            </span>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "4px" }}>
                              {pb.creator_name || "Admin"}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button
                                onClick={() => setSelectedPurchaseBill(pb)}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                                title="View Purchase Voucher Details"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={() => handleDownloadPurchasePdf(pb.id, pb.bill_number)}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                                title="Download PDF Voucher"
                                disabled={isDownloadingPurchasePdf}
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {purchaseBills.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                        <FileSpreadsheet size={40} style={{ margin: "0 auto 12px auto", opacity: 0.4 }} />
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>No Purchase Inward Vouchers Recorded Yet</div>
                        <div style={{ fontSize: "0.85rem", marginTop: "4px", marginBottom: "16px" }}>
                          Whenever you receive stock via Stock-In, it is automatically cataloged in this Purchase Book.
                        </div>
                        <button
                          onClick={() => setActiveTab("stock_in")}
                          className="btn-primary"
                          style={{ margin: "0 auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <Plus size={16} /> Record First Purchase Stock-In
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: GODOWNS & BRANCHES --- */}
      {activeTab === "godowns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
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
              <div key={g.id} className="glass-panel" style={{ padding: "20px", borderRadius: "8px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>{g.name}</h4>
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
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "8px", maxWidth: "800px", margin: "0 auto", width: "100%", background: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                <ArrowRightLeft size={20} color="#2563eb" />
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Execute Inter-Godown Stock Transfer</h3>
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
                    <span style={{ fontSize: "0.825rem", fontWeight: 700, color: "#0f172a" }}>Items to Transfer</span>
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
                        style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}
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
          <div className="glass-panel" style={{ borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "#0f172a", background: "#f8fafc" }}>
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
                        <div style={{ fontWeight: 700, color: "#2563eb" }}>{t.transfer_number}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(t.transfer_date).toLocaleString("en-IN")}</div>
                      </td>
                      <td><span className="badge badge-blue">{t.from_godown_name}</span></td>
                      <td><span className="badge badge-purple">{t.to_godown_name}</span></td>
                      <td>
                        {t.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: "0.8rem" }}>
                            • {it.item_name || "Item"}: <strong style={{ color: "#0f172a" }}>{it.quantity} {it.unit}</strong>
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
          <div className="glass-panel" style={{ padding: "14px 18px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Complete Stock Movement & Audit Log</div>
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

          <div className="glass-panel" style={{ borderRadius: "8px", overflow: "hidden" }}>
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
                        <td style={{ fontWeight: 700, color: "#0f172a" }}>{m.item_name}</td>
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
                        <td style={{ textAlign: "right", fontWeight: 800, color: isPositive ? "#16a34a" : "#dc2626" }}>
                          {isPositive ? `+${m.quantity}` : `-${m.quantity}`} {m.item_unit}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
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
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "8px", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#b45309" }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Low Stock Threshold Alerts ({lowStockAlerts.length})
              </h3>
            </div>

            {lowStockAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#16a34a" }}>
                <CheckCircle2 size={36} style={{ margin: "0 auto 8px auto" }} />
                <div>All inventory items have healthy stock levels!</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {lowStockAlerts.map((a) => (
                  <div key={a.item_id} style={{ padding: "12px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fcd34d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{a.item_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Current: <strong style={{ color: "#dc2626" }}>{a.total_quantity} {a.unit}</strong> | Min Alert: <strong>{a.min_stock_alert} {a.unit}</strong>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTab("stock_in");
                          setStockInForm({
                            ...stockInForm,
                            items: [{ item_id: a.item_id, cases: 1, loose_ea: 0, batch_number: "" }],
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
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "8px", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#dc2626" }}>
              <Clock size={20} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Batches Expiring Soon ({expiringAlerts.length})
              </h3>
            </div>

            {expiringAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#16a34a" }}>
                <CheckCircle2 size={36} style={{ margin: "0 auto 8px auto" }} />
                <div>No active batches expiring within the next 60 days.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {expiringAlerts.map((b) => (
                  <div key={b.batch_id} style={{ padding: "12px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fca5a5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{b.item_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Batch: <strong>{b.batch_number}</strong> ({b.quantity} {b.unit}) | Godown: {b.godown_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: b.days_to_expiry < 0 ? "#dc2626" : "#b45309", marginTop: "2px", fontWeight: 600 }}>
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

      {/* --- TAB: AI RESTOCK FORECAST --- */}
      {activeTab === "ai_restock" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            className="glass-panel"
            style={{
              padding: "28px",
              borderRadius: "16px",
              border: "1px solid #c4b5fd",
              background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <Sparkles size={22} color="#7c3aed" />
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e1b4b", margin: 0 }}>
                  AI Predictive Restock & Velocity Forecasting
                </h3>
              </div>
              <p style={{ color: "#475569", fontSize: "0.9rem", maxWidth: "600px", margin: 0, lineHeight: 1.5 }}>
                Our Exponential Smoothing algorithm computes daily consumption velocity, dynamic safety stocks, and predicted runout days for all your catalog items.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <a
                href="/dashboard/ai"
                className="btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #7c3aed, #db2777)",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={16} />
                <span>Open Full AI Intelligence Hub</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT PRODUCT MASTER --- */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Package size={20} color="#0284c7" />
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  {editingProduct ? `Edit Product Master — ${editingProduct.name}` : "Create New Catalog Product"}
                </h3>
              </div>
              <button onClick={() => setShowProductModal(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {productError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "10px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "14px" }}>
                {productError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Product Name */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amul Butter 500g"
                  className="input-field"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* Category & Unit */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Category *
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="e.g. Groceries"
                    className="input-field"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    required
                  />
                  <datalist id="category-suggestions">
                    <option value="Groceries" />
                    <option value="Dairy" />
                    <option value="Beverages" />
                    <option value="Snacks" />
                    <option value="Pharmacy" />
                    <option value="Electronics" />
                    <option value="Personal Care" />
                    <option value="Clothing" />
                    <option value="Hardware" />
                    <option value="General" />
                  </datalist>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Base Unit of Measurement *
                  </label>
                  <select
                    className="input-field"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    required
                  >
                    <option value="EA">EA (Each / Single Piece)</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="PKT">PKT (Packets)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="BTL">BTL (Bottles)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="GM">GM (Grams)</option>
                    <option value="LTR">LTR (Litres)</option>
                    <option value="ML">ML (Millilitres)</option>
                    <option value="DOZ">DOZ (Dozens)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="SET">SET (Sets)</option>
                  </select>
                </div>
              </div>

              {/* Packaging & Case Conversion (1 CS = X EA) */}
              <div style={{ background: "#f0f9ff", padding: "12px", borderRadius: "10px", border: "1px solid #bae6fd" }}>
                <div style={{ fontSize: "0.825rem", fontWeight: 700, color: "#0284c7", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Package size={16} /> Packaging & Bulk Case Ratio (1 CS = X EA)
                </div>
                <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "0 0 10px 0" }}>
                  Configure dual-unit stock tracking for bulk cases (CS) and loose units/pieces ({productForm.unit || "EA"}).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                      Secondary / Case Unit
                    </label>
                    <input
                      type="text"
                      placeholder="CS"
                      className="input-field"
                      value={productForm.secondary_unit}
                      onChange={(e) => setProductForm({ ...productForm, secondary_unit: e.target.value.toUpperCase() })}
                    />
                    <span style={{ fontSize: "0.68rem", color: "#64748b" }}>Default: CS (Cases / Cartons / Master Packs)</span>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                      Units Per Case (1 CS = ? {productForm.unit}) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="e.g. 24"
                      className="input-field"
                      value={productForm.units_per_case}
                      onChange={(e) => setProductForm({ ...productForm, units_per_case: e.target.value })}
                      required
                    />
                    <span style={{ fontSize: "0.68rem", color: "#0284c7", fontWeight: 600 }}>
                      1 {productForm.secondary_unit || "CS"} = {productForm.units_per_case || "1"} {productForm.unit || "EA"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barcode, SKU, HSN */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                    Barcode
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Scan or type barcode"
                      className="input-field"
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      style={{ paddingLeft: "32px" }}
                    />
                    <Barcode size={15} color="#0284c7" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                    SKU / Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AMUL-BUT-500"
                    className="input-field"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0402"
                    className="input-field"
                    value={productForm.hsn_code}
                    onChange={(e) => setProductForm({ ...productForm, hsn_code: e.target.value })}
                  />
                </div>
              </div>

              {/* Pricing & GST Section with 1EA / 1CS Unit Options */}
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                {(() => {
                  const uPerCase = parseFloat(productForm.units_per_case) || 1.0;
                  const rawSale = parseFloat(productForm.sale_price) || 0;
                  const eaSale = productForm.sale_price_mode === "CS" && uPerCase > 0 ? rawSale / uPerCase : rawSale;
                  const csSale = productForm.sale_price_mode === "EA" ? rawSale * uPerCase : rawSale;

                  const rawCost = parseFloat(productForm.purchase_price) || 0;
                  const eaCost = productForm.cost_price_mode === "CS" && uPerCase > 0 ? rawCost / uPerCase : rawCost;
                  const csCost = productForm.cost_price_mode === "EA" ? rawCost * uPerCase : rawCost;

                  const profitPerEa = eaSale - eaCost;
                  const profitPerCs = csSale - csCost;
                  const marginPct = eaSale > 0 ? ((profitPerEa / eaSale) * 100).toFixed(1) : "0";

                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>
                          Pricing & GST Configuration
                        </div>
                        {uPerCase > 1 && (
                          <span style={{ fontSize: "0.7rem", color: "#0369a1", background: "#e0f2fe", padding: "2px 8px", borderRadius: "4px", border: "1px solid #bae6fd", fontWeight: 600 }}>
                            1 {productForm.secondary_unit || "CS"} = {uPerCase} {productForm.unit || "EA"}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                        {/* Selling Price with 1 EA / 1 CS Toggle */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                              Selling Price (₹) *
                            </label>
                            <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (productForm.sale_price_mode !== "EA") {
                                    const raw = parseFloat(productForm.sale_price) || 0;
                                    const converted = uPerCase > 0 ? raw / uPerCase : raw;
                                    setProductForm({ ...productForm, sale_price_mode: "EA", sale_price: converted ? parseFloat(converted.toFixed(2)).toString() : "" });
                                  }
                                }}
                                style={{
                                  padding: "1px 6px",
                                  fontSize: "0.65rem",
                                  borderRadius: "3px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: productForm.sale_price_mode === "EA" ? "#10b981" : "transparent",
                                  color: productForm.sale_price_mode === "EA" ? "#fff" : "#64748b",
                                  fontWeight: 700,
                                }}
                                title="Enter Selling Price per single piece/unit"
                              >
                                1 {productForm.unit || "EA"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (productForm.sale_price_mode !== "CS") {
                                    const raw = parseFloat(productForm.sale_price) || 0;
                                    const converted = raw * uPerCase;
                                    setProductForm({ ...productForm, sale_price_mode: "CS", sale_price: converted ? parseFloat(converted.toFixed(2)).toString() : "" });
                                  }
                                }}
                                style={{
                                  padding: "1px 6px",
                                  fontSize: "0.65rem",
                                  borderRadius: "3px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: productForm.sale_price_mode === "CS" ? "#10b981" : "transparent",
                                  color: productForm.sale_price_mode === "CS" ? "#fff" : "#64748b",
                                  fontWeight: 700,
                                }}
                                title="Enter Selling Price per full bulk case"
                              >
                                1 {productForm.secondary_unit || "CS"}
                              </button>
                            </div>
                          </div>
                          <div style={{ position: "relative" }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-field"
                              value={productForm.sale_price}
                              onChange={(e) => setProductForm({ ...productForm, sale_price: e.target.value })}
                              style={{ fontWeight: 700, color: "#059669", paddingRight: "48px" }}
                              required
                            />
                            <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: "#059669", fontWeight: 700 }}>
                              /{productForm.sale_price_mode === "CS" ? (productForm.secondary_unit || "CS") : (productForm.unit || "EA")}
                            </span>
                          </div>
                        </div>

                        {/* Purchase Cost with 1 EA / 1 CS Toggle */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                              Purchase Cost (₹)
                            </label>
                            <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (productForm.cost_price_mode !== "EA") {
                                    const raw = parseFloat(productForm.purchase_price) || 0;
                                    const converted = uPerCase > 0 ? raw / uPerCase : raw;
                                    setProductForm({ ...productForm, cost_price_mode: "EA", purchase_price: converted ? parseFloat(converted.toFixed(2)).toString() : "" });
                                  }
                                }}
                                style={{
                                  padding: "1px 6px",
                                  fontSize: "0.65rem",
                                  borderRadius: "3px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: productForm.cost_price_mode === "EA" ? "#0284c7" : "transparent",
                                  color: productForm.cost_price_mode === "EA" ? "#fff" : "#64748b",
                                  fontWeight: 700,
                                }}
                                title="Enter Purchase Cost per single piece/unit"
                              >
                                1 {productForm.unit || "EA"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (productForm.cost_price_mode !== "CS") {
                                    const raw = parseFloat(productForm.purchase_price) || 0;
                                    const converted = raw * uPerCase;
                                    setProductForm({ ...productForm, cost_price_mode: "CS", purchase_price: converted ? parseFloat(converted.toFixed(2)).toString() : "" });
                                  }
                                }}
                                style={{
                                  padding: "1px 6px",
                                  fontSize: "0.65rem",
                                  borderRadius: "3px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: productForm.cost_price_mode === "CS" ? "#0284c7" : "transparent",
                                  color: productForm.cost_price_mode === "CS" ? "#fff" : "#64748b",
                                  fontWeight: 700,
                                }}
                                title="Enter Purchase Cost per full bulk case"
                              >
                                1 {productForm.secondary_unit || "CS"}
                              </button>
                            </div>
                          </div>
                          <div style={{ position: "relative" }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-field"
                              value={productForm.purchase_price}
                              onChange={(e) => setProductForm({ ...productForm, purchase_price: e.target.value })}
                              style={{ paddingRight: "48px" }}
                            />
                            <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                              /{productForm.cost_price_mode === "CS" ? (productForm.secondary_unit || "CS") : (productForm.unit || "EA")}
                            </span>
                          </div>
                        </div>

                        {/* GST Rate */}
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                            GST Rate (%)
                          </label>
                          <select
                            className="input-field"
                            value={productForm.gst_rate}
                            onChange={(e) => setProductForm({ ...productForm, gst_rate: e.target.value })}
                          >
                            <option value="0">0% (Exempt / Nil)</option>
                            <option value="5">5% GST</option>
                            <option value="12">12% GST</option>
                            <option value="18">18% GST (Standard)</option>
                            <option value="28">28% GST</option>
                          </select>
                        </div>
                      </div>

                      {/* Live Bidirectional Conversion Helper Bar */}
                      {uPerCase > 1 && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", flexWrap: "wrap", gap: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "#64748b" }}>🏷️ Selling Price:</span>
                              <strong style={{ color: "#059669" }}>₹{eaSale.toFixed(2)} / {productForm.unit || "EA"}</strong>
                              <span style={{ color: "#64748b" }}>⇄</span>
                              <strong style={{ color: "#059669" }}>₹{csSale.toFixed(2)} / {productForm.secondary_unit || "CS"} ({uPerCase} {productForm.unit || "EA"})</strong>
                            </div>
                            {rawCost > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ color: "#64748b" }}>📦 Purchase Cost:</span>
                                <strong style={{ color: "#0284c7" }}>₹{eaCost.toFixed(2)} / {productForm.unit || "EA"}</strong>
                                <span style={{ color: "#64748b" }}>⇄</span>
                                <strong style={{ color: "#0284c7" }}>₹{csCost.toFixed(2)} / {productForm.secondary_unit || "CS"}</strong>
                              </div>
                            )}
                          </div>
                          {rawCost > 0 && rawSale > 0 && (
                            <div style={{ fontSize: "0.72rem", color: profitPerEa >= 0 ? "#047857" : "#b91c1c", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>📈 Gross Profit:</span>
                              <strong>₹{profitPerEa.toFixed(2)} / {productForm.unit || "EA"} (₹{profitPerCs.toFixed(2)} / {productForm.secondary_unit || "CS"})</strong>
                              <span>• Margin: {marginPct}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.82rem", color: "#0f172a" }}>
                          <input
                            type="checkbox"
                            checked={productForm.is_tax_inclusive}
                            onChange={(e) => setProductForm({ ...productForm, is_tax_inclusive: e.target.checked })}
                          />
                          Price already includes GST (Tax-Inclusive / MRP)
                        </label>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Min Stock Alert */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Minimum Stock Alert Level (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="5"
                  className="input-field"
                  value={productForm.min_stock_alert}
                  onChange={(e) => setProductForm({ ...productForm, min_stock_alert: e.target.value })}
                />
                <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                  Dashboard will trigger low stock alert when on-hand quantity drops below this level.
                </span>
              </div>

              {/* Opening Stock (Only when creating new item) */}
              {!editingProduct && (
                <div style={{ background: "#f0f9ff", padding: "12px", borderRadius: "10px", border: "1px dashed #7dd3fc" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7", marginBottom: "8px" }}>
                    📦 Initial Opening Stock (Optional)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                        Initial Quantity
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        className="input-field"
                        value={productForm.opening_stock}
                        onChange={(e) => setProductForm({ ...productForm, opening_stock: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                        Assign to Godown
                      </label>
                      <select
                        className="input-field"
                        value={productForm.opening_godown_id}
                        onChange={(e) => setProductForm({ ...productForm, opening_godown_id: e.target.value })}
                      >
                        {godowns.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} {g.is_default ? "★ (Default)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn-secondary"
                  disabled={isSubmittingProduct}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingProduct}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {isSubmittingProduct ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : editingProduct ? (
                    "Update Product Master"
                  ) : (
                    "Create Product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT GODOWN --- */}
      {showGodownModal && (
        <div className="modal-overlay" onClick={() => setShowGodownModal(false)}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                {editingGodown ? "Edit Godown Location" : "Add New Godown / Warehouse"}
              </h3>
              <button onClick={() => setShowGodownModal(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGodown} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={godownForm.is_default}
                    onChange={(e) => setGodownForm({ ...godownForm, is_default: e.target.checked })}
                  />
                  Default Counter Warehouse
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: "#0f172a" }}>
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
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "450px",
              padding: "24px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Adjust Item Stock</h3>
                <div style={{ fontSize: "0.8rem", color: "#0284c7" }}>{adjustTargetItem.item_name}</div>
              </div>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
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

      {/* --- MODAL: PURCHASE VOUCHER DETAILS & PRINT --- */}
      {selectedPurchaseBill && (
        <div className="modal-overlay" onClick={() => setSelectedPurchaseBill(null)}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "750px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Receipt size={20} color="#0284c7" />
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                    Purchase Voucher — {selectedPurchaseBill.bill_number}
                  </h3>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
                  Recorded on {new Date(selectedPurchaseBill.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <button
                onClick={() => setSelectedPurchaseBill(null)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Vendor & General Details Box */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px", fontSize: "0.85rem" }}>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Supplier / Vendor</div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem", marginTop: "2px" }}>{selectedPurchaseBill.party_name}</div>
                {selectedPurchaseBill.party_gst && (
                  <div style={{ color: "#475569", fontSize: "0.8rem", marginTop: "2px" }}>GSTIN: {selectedPurchaseBill.party_gst}</div>
                )}
                {selectedPurchaseBill.party_address && (
                  <div style={{ color: "#475569", fontSize: "0.8rem", marginTop: "2px" }}>Address: {selectedPurchaseBill.party_address}</div>
                )}
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Voucher Info & Audit</div>
                <div style={{ color: "#0f172a", marginTop: "2px" }}>
                  Status: <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Recorded</span>
                </div>
                <div style={{ color: "#475569", fontSize: "0.8rem", marginTop: "2px" }}>
                  Billed By: {selectedPurchaseBill.creator_name || "Admin"}
                </div>
                {selectedPurchaseBill.notes && (
                  <div style={{ color: "#334155", fontSize: "0.8rem", marginTop: "4px", background: "#f1f5f9", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <strong>Notes:</strong> {selectedPurchaseBill.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                    <th style={{ padding: "8px 12px" }}>#</th>
                    <th style={{ padding: "8px 12px" }}>Item Description</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Cost Rate (₹)</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Taxable (₹)</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>GST</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPurchaseBill.items || []).map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{idx + 1}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0f172a" }}>
                        {it.item_name}
                        {it.hsn_code && <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: "6px" }}>HSN: {it.hsn_code}</span>}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>
                        {it.quantity} {it.unit || "EA"}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#334155" }}>
                        ₹{(it.rate || it.purchase_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#334155" }}>
                        ₹{(it.taxable_amount || (it.quantity * (it.rate || it.purchase_price || 0))).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#b45309", fontWeight: 600 }}>
                        {it.gst_rate}% (₹{(it.cgst_amount + it.sgst_amount || it.gst_amount || 0).toFixed(2)})
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                        ₹{(it.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
              <div style={{ width: "280px", background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>Taxable Subtotal:</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>₹{(selectedPurchaseBill.taxable_amount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>CGST (Central):</span>
                  <span style={{ color: "#b45309", fontWeight: 600 }}>₹{(selectedPurchaseBill.cgst_amount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>SGST (State):</span>
                  <span style={{ color: "#b45309", fontWeight: 600 }}>₹{(selectedPurchaseBill.sgst_amount || 0).toFixed(2)}</span>
                </div>
                {selectedPurchaseBill.round_off !== 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                    <span>Round Off:</span>
                    <span style={{ color: "#0f172a" }}>{selectedPurchaseBill.round_off > 0 ? `+₹${selectedPurchaseBill.round_off.toFixed(2)}` : `-₹${Math.abs(selectedPurchaseBill.round_off).toFixed(2)}`}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #cbd5e1", paddingTop: "6px", marginTop: "4px", fontSize: "1rem", fontWeight: 700 }}>
                  <span style={{ color: "#0f172a" }}>Grand Total:</span>
                  <span style={{ color: "#059669" }}>₹{(selectedPurchaseBill.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedPurchaseBill(null)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPurchasePdf(selectedPurchaseBill.id, selectedPurchaseBill.bill_number)}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                disabled={isDownloadingPurchasePdf}
              >
                <Printer size={16} />
                <span>{isDownloadingPurchasePdf ? "Generating PDF..." : "Print / Download PDF Voucher"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        entityType="items"
        onSuccess={loadAllData}
      />
    </div>
  );
}
