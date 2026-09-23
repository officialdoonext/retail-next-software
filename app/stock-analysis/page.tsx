"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

interface GodownItem {
  id: string;
  name: string;
  address?: string;
  createdAt: number;
}

interface ProductVariant {
  id: string;
  name: string;
  attributes?: Record<string, string>;
  price: number;
  barcode?: string;
  sku?: string;
  bufferStock?: number;
  storeStock: number;
  godownStock: Record<string, number>;
  totalStock: number;
}

interface ProductItem {
  id: string;
  name: string;
  imageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  barcode?: string;
  sku?: string;
  price?: number;
  bufferStock?: number;
  hasVariations: boolean;
  variationTypes?: Array<{ id: string; name: string }>;
  variants?: ProductVariant[];
  storeStock: number;
  godownStock: Record<string, number>;
  totalStock: number;
  minPrice?: number;
  maxPrice?: number;
  createdAt?: number;
}

interface StockMetrics {
  totalProducts: number;
  totalStoreStock: number;
  totalGodownStock: number;
  totalCombinedStock: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export default function StockAnalysisPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [godowns, setGodowns] = useState<GodownItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [metrics, setMetrics] = useState<StockMetrics>({
    totalProducts: 0,
    totalStoreStock: 0,
    totalGodownStock: 0,
    totalCombinedStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  // Accordion open/close map (productId -> boolean)
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});

  // ── INLINE EDITING STATE ──
  // Key format: productId for simple product, or `${productId}__${variantId}` for variant
  const [editedStocks, setEditedStocks] = useState<
    Record<string, { storeStock: number; godownStock: Record<string, number> }>
  >({});
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Stock Adjustment Modal State
  const [adjustTarget, setAdjustTarget] = useState<{
    product: ProductItem;
    variant?: ProductVariant;
  } | null>(null);
  const [adjStoreStock, setAdjStoreStock] = useState<number | "">(0);
  const [adjGodownStock, setAdjGodownStock] = useState<Record<string, number>>({});
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  // Stock Transfer Modal State
  const [transferTarget, setTransferTarget] = useState<{
    product: ProductItem;
    variant?: ProductVariant;
  } | null>(null);
  const [transferFrom, setTransferFrom] = useState("STORE");
  const [transferTo, setTransferTo] = useState("");
  const [transferQty, setTransferQty] = useState<number | "">(1);
  const [isTransferring, setIsTransferring] = useState(false);

  // Load Data
  const loadStockData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-analysis");
      const data = await res.json();
      if (data.success) {
        setGodowns(data.godowns || []);
        setProducts(data.products || []);
        setCategories(data.categories || []);
        if (data.metrics) setMetrics(data.metrics);
        setEditedStocks({});
      } else {
        toast.error(data.error || "Failed to load stock analysis data.");
      }
    } catch {
      toast.error("Network error loading stock analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, []);

  // Item Key helper
  const getItemKey = (productId: string, variantId?: string) =>
    variantId ? `${productId}__${variantId}` : productId;

  // Resolve current effective stock for an item (either edited or baseline)
  const getEffectiveStock = (
    productId: string,
    variantId: string | undefined,
    defaultStoreStock: number = 0,
    defaultGodownStock: Record<string, number> = {}
  ) => {
    const key = getItemKey(productId, variantId);
    if (editedStocks[key]) {
      return editedStocks[key];
    }
    return {
      storeStock: defaultStoreStock,
      godownStock: defaultGodownStock || {},
    };
  };

  // Handle cell stock change
  const handleCellStockChange = (
    productId: string,
    variantId: string | undefined,
    location: "STORE" | string, // "STORE" or godownId
    newValue: number,
    baselineStoreStock: number,
    baselineGodownStock: Record<string, number>
  ) => {
    const key = getItemKey(productId, variantId);
    const current = editedStocks[key] || {
      storeStock: baselineStoreStock,
      godownStock: { ...baselineGodownStock },
    };

    const updated = {
      storeStock: location === "STORE" ? Math.max(0, newValue) : current.storeStock,
      godownStock: {
        ...current.godownStock,
        ...(location !== "STORE" ? { [location]: Math.max(0, newValue) } : {}),
      },
    };

    setEditedStocks((prev) => ({
      ...prev,
      [key]: updated,
    }));
  };

  // Discard edits for a single row
  const handleDiscardRow = (productId: string, variantId?: string) => {
    const key = getItemKey(productId, variantId);
    setEditedStocks((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Single Save for a single product or variant
  const handleSaveRow = async (productId: string, variantId?: string, itemName?: string) => {
    const key = getItemKey(productId, variantId);
    const dataToSave = editedStocks[key];
    if (!dataToSave) return;

    try {
      setSavingRowKey(key);
      const res = await fetch("/api/stock-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId,
          storeStock: dataToSave.storeStock,
          godownStock: dataToSave.godownStock,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Stock for "${itemName || "item"}" saved successfully!`);
        // Remove from edited state
        setEditedStocks((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        loadStockData();
      } else {
        toast.error(data.error || "Failed to save stock.");
      }
    } catch {
      toast.error("Network error while saving stock.");
    } finally {
      setSavingRowKey(null);
    }
  };

  // Bulk Save all modified rows
  const handleBulkSave = async () => {
    const keys = Object.keys(editedStocks);
    if (keys.length === 0) return;

    const items = keys.map((key) => {
      const parts = key.split("__");
      const productId = parts[0];
      const variantId = parts.length > 1 ? parts[1] : undefined;
      const val = editedStocks[key];
      return {
        productId,
        variantId,
        storeStock: val.storeStock,
        godownStock: val.godownStock,
      };
    });

    try {
      setIsBulkSaving(true);
      const res = await fetch("/api/stock-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Bulk updated stock for ${data.count || items.length} item(s)!`);
        setEditedStocks({});
        loadStockData();
      } else {
        toast.error(data.error || "Failed to bulk update stock.");
      }
    } catch {
      toast.error("Network error while bulk saving stock.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Discard all unsaved edits
  const handleDiscardAll = () => {
    setEditedStocks({});
    toast.info("All unsaved stock edits discarded.");
  };

  const dirtyCount = Object.keys(editedStocks).length;

  // Accordion toggle
  const toggleAccordion = (productId: string) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const expandAllAccordions = () => {
    const allExpanded: Record<string, boolean> = {};
    products.forEach((p) => {
      if (p.hasVariations) allExpanded[p.id] = true;
    });
    setExpandedAccordions(allExpanded);
  };

  const collapseAllAccordions = () => {
    setExpandedAccordions({});
  };

  // Dynamic live sum for parent product with variants
  const computeParentEffectiveStock = (prod: ProductItem) => {
    let parentStore = 0;
    const parentGodowns: Record<string, number> = {};
    godowns.forEach((g) => {
      parentGodowns[g.id] = 0;
    });

    let hasAnyVariantEdited = false;

    if (prod.variants) {
      prod.variants.forEach((v) => {
        const vKey = getItemKey(prod.id, v.id);
        if (editedStocks[vKey]) hasAnyVariantEdited = true;

        const effective = getEffectiveStock(prod.id, v.id, v.storeStock, v.godownStock);
        parentStore += effective.storeStock;
        godowns.forEach((g) => {
          parentGodowns[g.id] += effective.godownStock[g.id] ?? 0;
        });
      });
    }

    const parentTotal = parentStore + Object.values(parentGodowns).reduce((s, q) => s + q, 0);

    return {
      storeStock: parentStore,
      godownStock: parentGodowns,
      totalStock: parentTotal,
      hasAnyVariantEdited,
    };
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const barcodeMatch = p.barcode?.toLowerCase().includes(q);
        const variantMatch =
          p.hasVariations &&
          p.variants?.some(
            (v) =>
              v.name.toLowerCase().includes(q) ||
              v.sku?.toLowerCase().includes(q) ||
              v.barcode?.toLowerCase().includes(q)
          );

        if (!nameMatch && !skuMatch && !barcodeMatch && !variantMatch) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
        return false;
      }

      // 3. Stock Status Filter
      if (stockStatusFilter === "OUT_OF_STOCK" && p.totalStock > 0) return false;
      if (stockStatusFilter === "IN_STOCK" && p.totalStock === 0) return false;
      if (stockStatusFilter === "LOW_STOCK") {
        const buffer = p.bufferStock || 5;
        if (p.totalStock === 0 || p.totalStock > buffer) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, stockStatusFilter]);

  // Open Adjust Modal
  const openAdjustModal = (product: ProductItem, variant?: ProductVariant) => {
    setAdjustTarget({ product, variant });
    const targetStore = variant ? variant.storeStock : product.storeStock;
    const targetGodowns = variant ? variant.godownStock : product.godownStock;

    setAdjStoreStock(targetStore);
    const initialGodowns: Record<string, number> = {};
    godowns.forEach((g) => {
      initialGodowns[g.id] = targetGodowns?.[g.id] ?? 0;
    });
    setAdjGodownStock(initialGodowns);
  };

  // Save Adjust Stock via Modal
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;

    try {
      setIsSavingAdjust(true);
      const res = await fetch("/api/stock-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustTarget.product.id,
          variantId: adjustTarget.variant?.id,
          storeStock: Number(adjStoreStock) || 0,
          godownStock: adjGodownStock,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Stock adjusted successfully.");
        setAdjustTarget(null);
        loadStockData();
      } else {
        toast.error(data.error || "Failed to adjust stock.");
      }
    } catch {
      toast.error("Network error while adjusting stock.");
    } finally {
      setIsSavingAdjust(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (product: ProductItem, variant?: ProductVariant) => {
    setTransferTarget({ product, variant });
    setTransferFrom("STORE");
    const firstGodown = godowns[0]?.id || "";
    setTransferTo(firstGodown);
    setTransferQty(1);
  };

  // Execute Transfer via Modal
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;

    if (!transferTo) {
      toast.warning("Please choose a destination location.");
      return;
    }
    if (transferFrom === transferTo) {
      toast.warning("Source and destination locations cannot be the same.");
      return;
    }
    if (!transferQty || Number(transferQty) < 1) {
      toast.warning("Please enter a valid transfer quantity of at least 1.");
      return;
    }

    try {
      setIsTransferring(true);
      const res = await fetch("/api/stock-analysis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: transferTarget.product.id,
          variantId: transferTarget.variant?.id,
          fromLocation: transferFrom,
          toLocation: transferTo,
          quantity: Number(transferQty),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Stock transferred successfully.");
        setTransferTarget(null);
        loadStockData();
      } else {
        toast.error(data.error || "Failed to transfer stock.");
      }
    } catch {
      toast.error("Network error while transferring stock.");
    } finally {
      setIsTransferring(false);
    }
  };

  // Category options for CustomSelect
  const categoryOptions = useMemo(() => {
    const opts = [{ value: "ALL", label: "All Categories" }];
    categories.forEach((c) => {
      opts.push({ value: c.id, label: c.name });
    });
    return opts;
  }, [categories]);

  // Transfer Location Choices
  const transferLocations = useMemo(() => {
    const list = [{ value: "STORE", label: "Store Shelf (Counter / Rack)" }];
    godowns.forEach((g, idx) => {
      list.push({
        value: g.id,
        label: `${g.name} (${idx === 0 ? "1st Godown" : idx === 1 ? "2nd Godown" : `${idx + 1}th Godown`})`,
      });
    });
    return list;
  }, [godowns]);

  // Computed max available quantity for transfer
  const maxAvailableForTransfer = useMemo(() => {
    if (!transferTarget) return 0;
    const item = transferTarget.variant || transferTarget.product;
    if (transferFrom === "STORE") {
      return item.storeStock || 0;
    }
    return item.godownStock?.[transferFrom] || 0;
  }, [transferTarget, transferFrom]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans p-4 sm:p-6 space-y-4 max-w-full">
        {/* ══════════════════════════════════════════════════════
            HEADER & TOP ACTIONS
        ══════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-[6px] p-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <h1 className="text-base font-medium text-slate-900 tracking-tight">Stock Analysis</h1>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-[4px] bg-purple-50 text-[#5e2b9d] border border-purple-200/60">
                {products.length} Products
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live multi-location inventory across front-store shelves and warehouse godowns with waterfall billing deduction.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Save Button in Header */}
            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={isBulkSaving}
                className="h-[34px] px-3.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isBulkSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving All...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Bulk Save ({dirtyCount})</span>
                  </>
                )}
              </button>
            )}

            <Link
              href="/utilities"
              className="h-[34px] px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title="Add or manage godowns in Warehouse Utilities"
            >
              <svg className="w-3.5 h-3.5 text-[#5e2b9d] stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Manage Godowns ({godowns.length})</span>
            </Link>

            <button
              type="button"
              onClick={loadStockData}
              disabled={loading}
              className="h-[34px] px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh stock analysis"
            >
              <svg className={`w-3.5 h-3.5 text-slate-500 stroke-[2] ${loading ? "animate-spin text-[#5e2b9d]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            BULK SAVE FLOATING NOTIFICATION BAR (When dirty)
        ══════════════════════════════════════════════════════ */}
        {dirtyCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 border border-[#5e2b9d]/30 rounded-[6px] shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5e2b9d] animate-pulse shrink-0" />
              <div>
                <span className="text-xs font-medium text-slate-900 block">
                  You have unsaved stock changes in <span className="font-mono text-[#5e2b9d]">{dirtyCount}</span> item(s).
                </span>
                <span className="text-[11px] text-slate-500 block">
                  You can save items individually row-by-row or click &quot;Bulk Save All&quot; to apply all stock counts together.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardAll}
                disabled={isBulkSaving}
                className="h-[32px] px-3 rounded-[5px] border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
              >
                Discard All
              </button>
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={isBulkSaving}
                className="h-[32px] px-4 rounded-[5px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isBulkSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Bulk Save All ({dirtyCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            KPI METRIC CARDS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card 1: Store Stock */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Store Shelf Stock</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-medium text-[#5e2b9d] tracking-tight">
                {metrics.totalStoreStock.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] font-medium text-slate-400">units</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Front shelf &amp; counter</span>
          </div>

          {/* Card 2: Godown Stock */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              Warehouse Stock ({godowns.length} Godowns)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-medium text-indigo-700 tracking-tight">
                {metrics.totalGodownStock.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] font-medium text-slate-400">units</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Backroom &amp; depots</span>
          </div>

          {/* Card 3: Combined Total */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Total Combined Stock</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-medium text-slate-900 tracking-tight">
                {metrics.totalCombinedStock.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] font-medium text-slate-400">units</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Store + All Godowns</span>
          </div>

          {/* Card 4: Low Stock */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-amber-700 block truncate">Low Stock Alert</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-medium text-amber-600 tracking-tight">{metrics.lowStockCount}</span>
              <span className="text-[11px] font-medium text-slate-400">items</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">&le; Buffer stock</span>
          </div>

          {/* Card 5: Out of Stock */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-rose-700 block truncate">Out of Stock</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-medium text-rose-600 tracking-tight">{metrics.outOfStockCount}</span>
              <span className="text-[11px] font-medium text-slate-400">items</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">0 Total stock</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SEARCH, FILTERS & ACCORDION CONTROLS
        ══════════════════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU, or barcode..."
                className="w-full h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="w-full sm:w-48 shrink-0">
              <CustomSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                placeholder="Category"
              />
            </div>
          </div>

          {/* Right: Status Filters & Accordion Toggle */}
          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
            <div className="flex items-center bg-[#f8fafc] border border-slate-200/90 rounded-[6px] p-0.5">
              {(
                [
                  { id: "ALL", label: "All" },
                  { id: "IN_STOCK", label: "In Stock" },
                  { id: "LOW_STOCK", label: "Low Stock" },
                  { id: "OUT_OF_STOCK", label: "Out of Stock" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition-all cursor-pointer ${
                    stockStatusFilter === tab.id
                      ? "bg-[#5e2b9d] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAllAccordions}
                className="h-[30px] px-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-[5px] text-[11px] font-medium cursor-pointer transition-colors"
                title="Expand all product variant accordions"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllAccordions}
                className="h-[30px] px-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-[5px] text-[11px] font-medium cursor-pointer transition-colors"
                title="Collapse all variant accordions"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            STOCK BREAKDOWN TABLE WITH INLINE EDIT & SAVE
        ══════════════════════════════════════════════════════ */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3 min-w-[220px]">Product / Variant</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">SKU / Barcode</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Price</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center bg-purple-50/60 text-[#5e2b9d] border-x border-purple-100 min-w-[110px]">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">Store Shelf</span>
                      <span className="text-[9px] text-[#5e2b9d]/80 font-normal">1st Deducted in POS</span>
                    </div>
                  </th>

                  {/* Dynamic Godowns Columns */}
                  {godowns.map((g, idx) => (
                    <th
                      key={g.id}
                      className="py-2.5 px-3 whitespace-nowrap text-center border-r border-slate-200/80 min-w-[110px]"
                      title={g.address ? `Address: ${g.address}` : undefined}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium text-slate-800 truncate max-w-[120px]">{g.name}</span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          {idx === 0 ? "2nd in Billing" : idx === 1 ? "3rd in Billing" : `${idx + 2}th in Billing`}
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="py-2.5 px-3 whitespace-nowrap text-center min-w-[100px]">Total Stock</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right min-w-[150px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6 + godowns.length} className="p-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs font-medium">Loading stock analysis and godown records...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6 + godowns.length} className="p-12 text-center text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2 text-lg">
                        📦
                      </div>
                      <p className="text-xs font-medium text-slate-600">No products found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Try clearing search terms or check category filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const isExpanded = !!expandedAccordions[prod.id];
                    const hasVariants = prod.hasVariations && Array.isArray(prod.variants) && prod.variants.length > 0;

                    // Simple product row stock values
                    const simpleKey = getItemKey(prod.id);
                    const isSimpleDirty = !hasVariants && !!editedStocks[simpleKey];
                    const simpleStock = getEffectiveStock(prod.id, undefined, prod.storeStock, prod.godownStock);
                    const simpleGodownSum = Object.values(simpleStock.godownStock).reduce((s, q) => s + (Number(q) || 0), 0);
                    const simpleTotal = simpleStock.storeStock + simpleGodownSum;

                    // Parent variation stock values (computed from its variants)
                    const parentVariationStock = hasVariants ? computeParentEffectiveStock(prod) : null;

                    return (
                      <React.Fragment key={prod.id}>
                        {/* ── PARENT PRODUCT ROW ── */}
                        <tr
                          className={`transition-colors ${
                            hasVariants
                              ? "hover:bg-purple-50/20 cursor-pointer bg-white"
                              : isSimpleDirty
                              ? "bg-purple-50/30 hover:bg-purple-50/40"
                              : "hover:bg-slate-50/70"
                          } ${isExpanded ? "bg-purple-50/20" : ""}`}
                          onClick={() => hasVariants && toggleAccordion(prod.id)}
                        >
                          {/* Product Name + Image + Accordion Caret */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {hasVariants ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAccordion(prod.id);
                                  }}
                                  className="w-5 h-5 rounded-[4px] hover:bg-purple-100/70 text-[#5e2b9d] flex items-center justify-center transition-transform shrink-0 cursor-pointer"
                                  title={isExpanded ? "Collapse variants" : "Expand variants"}
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="w-5 shrink-0" />
                              )}

                              {/* Product Thumbnail */}
                              {prod.imageUrl ? (
                                <div className="w-8 h-8 rounded-[4px] overflow-hidden border border-slate-200 shrink-0 bg-white">
                                  <img
                                    src={prod.imageUrl}
                                    alt={prod.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-[4px] bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400 text-xs font-medium">
                                  {prod.name.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-slate-900 truncate block">
                                    {prod.name}
                                  </span>
                                  {hasVariants ? (
                                    <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-medium bg-[#5e2b9d]/10 text-[#5e2b9d] shrink-0">
                                      {prod.variants?.length} Variants
                                    </span>
                                  ) : isSimpleDirty ? (
                                    <span className="px-1.5 py-0.2 rounded-[3px] text-[9.5px] font-medium bg-amber-100 text-amber-800 shrink-0">
                                      Unsaved
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {prod.categoryName || "Uncategorized"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* SKU / Barcode */}
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {hasVariants ? (
                              <span className="text-slate-400 italic">Multi-SKU</span>
                            ) : (
                              <div>
                                <span className="block">{prod.sku || "—"}</span>
                                {prod.barcode && (
                                  <span className="text-[10px] text-slate-400 block">{prod.barcode}</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Price */}
                          <td className="py-2 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                            {hasVariants ? (
                              prod.minPrice !== undefined && prod.maxPrice !== undefined ? (
                                prod.minPrice === prod.maxPrice ? (
                                  `₹${prod.minPrice.toLocaleString("en-IN")}`
                                ) : (
                                  `₹${prod.minPrice} - ₹${prod.maxPrice}`
                                )
                              ) : (
                                "—"
                              )
                            ) : (
                              `₹${(prod.price || 0).toLocaleString("en-IN")}`
                            )}
                          </td>

                          {/* Store Shelf Stock (Inline Editable for Simple Products) */}
                          <td
                            className="py-2 px-3 text-center bg-purple-50/20 border-x border-purple-100/80"
                            onClick={(e) => !hasVariants && e.stopPropagation()}
                          >
                            {!hasVariants ? (
                              <input
                                type="number"
                                min="0"
                                value={simpleStock.storeStock}
                                onChange={(e) =>
                                  handleCellStockChange(
                                    prod.id,
                                    undefined,
                                    "STORE",
                                    Number(e.target.value) || 0,
                                    prod.storeStock,
                                    prod.godownStock
                                  )
                                }
                                className={`w-20 h-[30px] text-center font-mono text-xs rounded-[5px] border transition-all focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-medium ${
                                  isSimpleDirty
                                    ? "bg-white border-[#5e2b9d] text-[#5e2b9d] shadow-2xs"
                                    : "bg-white/80 border-purple-200 text-[#5e2b9d]"
                                }`}
                              />
                            ) : (
                              <span className="font-mono text-xs font-medium text-[#5e2b9d] px-2 py-1 rounded-[4px] bg-purple-100/60 inline-block">
                                {parentVariationStock?.storeStock}
                              </span>
                            )}
                          </td>

                          {/* Dynamic Godowns Columns (Inline Editable for Simple Products) */}
                          {godowns.map((g) => {
                            const val = !hasVariants
                              ? simpleStock.godownStock[g.id] ?? 0
                              : parentVariationStock?.godownStock[g.id] ?? 0;

                            return (
                              <td
                                key={g.id}
                                className="py-2 px-3 text-center border-r border-slate-100"
                                onClick={(e) => !hasVariants && e.stopPropagation()}
                              >
                                {!hasVariants ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={val}
                                    onChange={(e) =>
                                      handleCellStockChange(
                                        prod.id,
                                        undefined,
                                        g.id,
                                        Number(e.target.value) || 0,
                                        prod.storeStock,
                                        prod.godownStock
                                      )
                                    }
                                    className={`w-20 h-[30px] text-center font-mono text-xs rounded-[5px] border transition-all focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-medium ${
                                      isSimpleDirty
                                        ? "bg-white border-slate-400 text-slate-900 shadow-2xs"
                                        : "bg-[#f8fafc] border-slate-200 text-slate-800"
                                    }`}
                                  />
                                ) : (
                                  <span
                                    className={`font-mono text-xs ${
                                      val === 0 ? "text-slate-300" : "font-medium text-slate-800"
                                    }`}
                                  >
                                    {val}
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Stock */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {hasVariants ? (
                              <span
                                className={`px-2 py-0.5 rounded-[4px] text-xs font-mono font-medium inline-block ${
                                  (parentVariationStock?.totalStock || 0) === 0
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : (parentVariationStock?.totalStock || 0) <= (prod.bufferStock || 5)
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {parentVariationStock?.totalStock} units
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-[4px] text-xs font-mono font-medium inline-block ${
                                  simpleTotal === 0
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : simpleTotal <= (prod.bufferStock || 5)
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {simpleTotal} units
                              </span>
                            )}
                          </td>

                          {/* Actions: Single Save / Discard / Adjust / Transfer */}
                          <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {!hasVariants ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {isSimpleDirty ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRow(prod.id, undefined, prod.name)}
                                      disabled={savingRowKey === simpleKey}
                                      className="h-[28px] px-2.5 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                      title="Save stock changes for this product"
                                    >
                                      {savingRowKey === simpleKey ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <svg className="w-3 h-3 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                      )}
                                      <span>Save</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDiscardRow(prod.id)}
                                      className="h-[28px] px-2 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-xs font-medium transition-colors cursor-pointer"
                                      title="Discard changes"
                                    >
                                      ✕
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openAdjustModal(prod)}
                                      className="h-[28px] px-2 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                                      title="Adjust stock in modal"
                                    >
                                      Adjust
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openTransferModal(prod)}
                                      className="h-[28px] px-2.5 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                      title="Transfer stock between Store and Godowns"
                                    >
                                      Transfer
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleAccordion(prod.id)}
                                className="text-xs text-[#5e2b9d] hover:underline font-medium cursor-pointer"
                              >
                                {isExpanded ? "Hide Variants" : "Expand Variants"}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* ── EXPANDED ACCORDION: VARIANT ROWS (Inline Editable) ── */}
                        {hasVariants && isExpanded && (
                          prod.variants?.map((v) => {
                            const vKey = getItemKey(prod.id, v.id);
                            const isVDirty = !!editedStocks[vKey];
                            const vStock = getEffectiveStock(prod.id, v.id, v.storeStock, v.godownStock);
                            const vGodownSum = Object.values(vStock.godownStock).reduce((s, q) => s + (Number(q) || 0), 0);
                            const vTotal = vStock.storeStock + vGodownSum;

                            return (
                              <tr
                                key={v.id}
                                className={`transition-colors border-l-2 border-[#5e2b9d] ${
                                  isVDirty
                                    ? "bg-purple-50/40 hover:bg-purple-50/50"
                                    : "bg-purple-50/15 hover:bg-purple-50/30"
                                }`}
                              >
                                {/* Indented Variant details */}
                                <td className="py-2 px-3 pl-9">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-300">↳</span>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-800 block text-xs">
                                          {v.name}
                                        </span>
                                        {isVDirty && (
                                          <span className="px-1.5 py-0.2 rounded-[3px] text-[9px] font-medium bg-amber-100 text-amber-800">
                                            Unsaved
                                          </span>
                                        )}
                                      </div>
                                      {v.attributes && Object.keys(v.attributes).length > 0 && (
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                          {Object.entries(v.attributes).map(([k, val]) => (
                                            <span
                                              key={k}
                                              className="px-1.5 py-0.2 rounded text-[10px] bg-white border border-purple-100 text-slate-600 font-medium"
                                            >
                                              {k}: {val}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Variant SKU / Barcode */}
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                  <span className="block">{v.sku || "—"}</span>
                                  {v.barcode && <span className="text-[10px] text-slate-400 block">{v.barcode}</span>}
                                </td>

                                {/* Variant Price */}
                                <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                  ₹{v.price.toLocaleString("en-IN")}
                                </td>

                                {/* Variant Store Stock (Inline Editable) */}
                                <td className="py-2 px-3 text-center bg-purple-50/40 border-x border-purple-100">
                                  <input
                                    type="number"
                                    min="0"
                                    value={vStock.storeStock}
                                    onChange={(e) =>
                                      handleCellStockChange(
                                        prod.id,
                                        v.id,
                                        "STORE",
                                        Number(e.target.value) || 0,
                                        v.storeStock,
                                        v.godownStock
                                      )
                                    }
                                    className={`w-20 h-[28px] text-center font-mono text-xs rounded-[5px] border transition-all focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-medium ${
                                      isVDirty
                                        ? "bg-white border-[#5e2b9d] text-[#5e2b9d] shadow-2xs"
                                        : "bg-white/90 border-purple-200 text-[#5e2b9d]"
                                    }`}
                                  />
                                </td>

                                {/* Variant Godowns Columns (Inline Editable) */}
                                {godowns.map((g) => {
                                  const val = vStock.godownStock[g.id] ?? 0;
                                  return (
                                    <td key={g.id} className="py-2 px-3 text-center border-r border-slate-100">
                                      <input
                                        type="number"
                                        min="0"
                                        value={val}
                                        onChange={(e) =>
                                          handleCellStockChange(
                                            prod.id,
                                            v.id,
                                            g.id,
                                            Number(e.target.value) || 0,
                                            v.storeStock,
                                            v.godownStock
                                          )
                                        }
                                        className={`w-20 h-[28px] text-center font-mono text-xs rounded-[5px] border transition-all focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-medium ${
                                          isVDirty
                                            ? "bg-white border-slate-400 text-slate-900 shadow-2xs"
                                            : "bg-[#f8fafc] border-slate-200 text-slate-800"
                                        }`}
                                      />
                                    </td>
                                  );
                                })}

                                {/* Variant Total Stock */}
                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-[4px] text-xs font-mono font-medium inline-block ${
                                      vTotal === 0
                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                        : vTotal <= (v.bufferStock || 5)
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {vTotal} units
                                  </span>
                                </td>

                                {/* Variant Actions: Single Save / Discard / Adjust / Transfer */}
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isVDirty ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveRow(prod.id, v.id, `${prod.name} (${v.name})`)}
                                          disabled={savingRowKey === vKey}
                                          className="h-[26px] px-2 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                          title="Save stock for this variant"
                                        >
                                          {savingRowKey === vKey ? (
                                            <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <svg className="w-3 h-3 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                          )}
                                          <span>Save</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDiscardRow(prod.id, v.id)}
                                          className="h-[26px] px-1.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-[11px] font-medium transition-colors cursor-pointer"
                                          title="Discard variant changes"
                                        >
                                          ✕
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openAdjustModal(prod, v)}
                                          className="h-[26px] px-2 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                                          title="Adjust variant stock in modal"
                                        >
                                          Adjust
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openTransferModal(prod, v)}
                                          className="h-[26px] px-2 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                          title="Transfer variant stock"
                                        >
                                          Transfer
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            MODAL 1: ADJUST STOCK (STORE & EACH GODOWN)
        ══════════════════════════════════════════════════════ */}
        {adjustTarget && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-md overflow-visible relative">
              {/* Header */}
              <div className="h-[48px] bg-[#f8fafc] border-b border-slate-200 px-4 flex items-center justify-between rounded-t-[6px]">
                <div className="flex items-center gap-2">
                  <span className="text-base">📝</span>
                  <div>
                    <h3 className="text-xs font-medium text-slate-900">Adjust Stock Quantities</h3>
                    <p className="text-[10px] text-slate-400">Set quantities across store shelf and godowns.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveAdjust} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Target Item Info */}
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-[6px] flex items-center gap-2.5">
                  {adjustTarget.product.imageUrl ? (
                    <div className="w-9 h-9 rounded-[4px] overflow-hidden border border-slate-200 shrink-0 bg-white">
                      <img
                        src={adjustTarget.product.imageUrl}
                        alt={adjustTarget.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-[4px] bg-white border border-slate-200 shrink-0 flex items-center justify-center text-slate-400 text-xs font-medium">
                      {adjustTarget.product.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-slate-900 truncate">
                      {adjustTarget.product.name}
                    </h4>
                    {adjustTarget.variant && (
                      <span className="text-[11px] text-[#5e2b9d] font-medium block">
                        Variant: {adjustTarget.variant.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 1. Store Shelf Stock */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-800">
                    Store Shelf Stock (1st Deducted in Billing) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjStoreStock}
                    onChange={(e) => setAdjStoreStock(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                    className="w-full h-[34px] px-3 bg-[#f8fafc] border border-purple-200/80 rounded-[6px] text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-mono"
                    placeholder="0"
                  />
                  <p className="text-[10.5px] text-slate-500">
                    Quantity physically placed on store counters/shelves for immediate billing.
                  </p>
                </div>

                {/* 2. Godowns Stock Inputs */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">Godowns &amp; Warehouse Stock</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {godowns.length} Godowns Available
                    </span>
                  </div>

                  {godowns.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-[6px] text-center border border-slate-200 text-slate-500 text-xs">
                      No godowns configured yet. You can create godowns in{" "}
                      <Link href="/utilities" className="text-[#5e2b9d] underline font-medium">
                        Utilities
                      </Link>
                      .
                    </div>
                  ) : (
                    godowns.map((g, idx) => (
                      <div key={g.id} className="flex items-center justify-between gap-3 p-2 bg-slate-50/70 border border-slate-200/70 rounded-[6px]">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-800 block truncate">{g.name}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {idx === 0 ? "2nd in Billing" : idx === 1 ? "3rd in Billing" : `${idx + 2}th in Billing`}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={adjGodownStock[g.id] ?? 0}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                            setAdjGodownStock((prev) => ({
                              ...prev,
                              [g.id]: val,
                            }));
                          }}
                          className="w-24 h-[32px] px-2 text-center bg-white border border-slate-300 rounded-[5px] text-xs font-medium font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                        />
                      </div>
                    ))
                  )}
                </div>

                {/* Total Calculated Summary */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-600">Calculated Total Stock:</span>
                  <span className="font-mono text-slate-900 text-sm">
                    {(Number(adjStoreStock) || 0) + Object.values(adjGodownStock).reduce((s, q) => s + (Number(q) || 0), 0)}{" "}
                    units
                  </span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAdjustTarget(null)}
                    disabled={isSavingAdjust}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAdjust}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {isSavingAdjust ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Stock Adjustments</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MODAL 2: TRANSFER STOCK (STORE <-> GODOWN)
        ══════════════════════════════════════════════════════ */}
        {transferTarget && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-md overflow-visible relative">
              {/* Header */}
              <div className="h-[48px] bg-[#f8fafc] border-b border-slate-200 px-4 flex items-center justify-between rounded-t-[6px]">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔄</span>
                  <div>
                    <h3 className="text-xs font-medium text-slate-900">Transfer Stock Between Locations</h3>
                    <p className="text-[10px] text-slate-400">Move inventory between Store shelf and godowns.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleExecuteTransfer} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Target Item Info */}
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-[6px] flex items-center gap-2.5">
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-slate-900 truncate">
                      {transferTarget.product.name}
                    </h4>
                    {transferTarget.variant && (
                      <span className="text-[11px] text-[#5e2b9d] font-medium block">
                        Variant: {transferTarget.variant.name}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono block">
                      Total Inventory: {transferTarget.variant ? transferTarget.variant.totalStock : transferTarget.product.totalStock} units
                    </span>
                  </div>
                </div>

                {/* From Location */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    From Source Location <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    options={transferLocations}
                    value={transferFrom}
                    onChange={(val) => setTransferFrom(val)}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Available at source:</span>
                    <span className="font-mono font-medium text-slate-900">
                      {maxAvailableForTransfer} units
                    </span>
                  </div>
                </div>

                {/* To Location */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    To Destination Location <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    options={transferLocations.filter((l) => l.value !== transferFrom)}
                    value={transferTo}
                    onChange={(val) => setTransferTo(val)}
                    placeholder="Choose destination"
                  />
                </div>

                {/* Transfer Quantity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700">
                      Transfer Quantity <span className="text-rose-500">*</span>
                    </label>
                    {maxAvailableForTransfer > 0 && (
                      <button
                        type="button"
                        onClick={() => setTransferQty(maxAvailableForTransfer)}
                        className="text-[10.5px] text-[#5e2b9d] hover:underline font-medium cursor-pointer"
                      >
                        Transfer Max ({maxAvailableForTransfer})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={maxAvailableForTransfer || 1}
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                    className="w-full h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] font-mono"
                    placeholder="1"
                  />
                  {maxAvailableForTransfer === 0 && (
                    <p className="text-[10.5px] text-rose-500">
                      Selected source location has 0 units available to transfer.
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTransferTarget(null)}
                    disabled={isTransferring}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTransferring || maxAvailableForTransfer === 0}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {isTransferring ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Transferring...</span>
                      </>
                    ) : (
                      <span>Confirm Transfer</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
