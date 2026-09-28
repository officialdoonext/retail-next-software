"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  categoryName?: string;
  price?: number;
  stock?: number;
  hasVariations?: boolean;
  variants?: Array<{
    id: string;
    name: string;
    barcode?: string;
    sku?: string;
    price?: number;
    stock?: number;
  }>;
}

interface QueuedItem {
  id: string;
  productName: string;
  barcodeValue: string;
  barcodeFormat: string;
  price: string;
  mrp?: string;
  storeName: string;
  quantity: number;
  labelPreset: string;
  showStoreName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  showBarcodeText: boolean;
  showSku: boolean;
  sku: string;
}

const BARCODE_FORMATS = [
  { id: "CODE128", name: "CODE 128 (Standard Retail & Inventory)" },
  { id: "EAN13", name: "EAN-13 (International 13-digit Retail)" },
  { id: "UPC", name: "UPC-A (12-digit Retail Barcode)" },
  { id: "CODE39", name: "CODE 39 (Alphanumeric Warehouse)" },
  { id: "ITF14", name: "ITF-14 (Packaging & Master Cartons)" },
  { id: "QR", name: "QR Code (2D Matrix Scanner)" },
];

const LABEL_PRESETS = [
  { id: "50x25", name: "50×25mm", sub: "Standard Roll", width: "50mm", height: "25mm", pxW: 240, pxH: 120 },
  { id: "40x30", name: "40×30mm", sub: "Compact Tag", width: "40mm", height: "30mm", pxW: 210, pxH: 140 },
  { id: "50x38", name: "50×38mm", sub: "Garment Tag", width: "50mm", height: "38mm", pxW: 250, pxH: 180 },
  { id: "38x25", name: "38×25mm", sub: "Small Item", width: "38mm", height: "25mm", pxW: 190, pxH: 120 },
  { id: "100x50", name: "100×50mm", sub: "Shipping Box", width: "100mm", height: "50mm", pxW: 380, pxH: 190 },
];

export default function BarcodeGeneratorPage() {
  // Store products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  // Mode: 'catalog' | 'custom'
  const [mode, setMode] = useState<"catalog" | "custom">("catalog");

  // Barcode content settings
  const [barcodeValue, setBarcodeValue] = useState("RN-1002948");
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [storeName, setStoreName] = useState("Retail Next");
  const [productName, setProductName] = useState("Fortune Sunlite Sunflower Oil 1L");
  const [price, setPrice] = useState("145.00");
  const [mrp, setMrp] = useState("160.00");
  const [sku, setSku] = useState("GRO-SUN-1L");

  // Display toggles
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(false);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showSku, setShowSku] = useState(true);

  // Label size & layout settings
  const [selectedPreset, setSelectedPreset] = useState("50x25");
  const [barWidth, setBarWidth] = useState(1.6);
  const [barHeight, setBarHeight] = useState(42);
  const [fontSize, setFontSize] = useState(11);
  const [printQuantity, setPrintQuantity] = useState(1);

  // QR Code Image Data URL (when format is QR)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Print Queue
  const [printQueue, setPrintQueue] = useState<QueuedItem[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Feedback toast
  const [toastMsg, setToastMsg] = useState("");

  // Barcode SVG reference
  const svgRef = useRef<SVGSVGElement | null>(null);
  const labelPreviewRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Fetch active store name & products
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingProducts(true);
        // Fetch active store info
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.activeStore?.name) {
            setStoreName(meData.activeStore.name);
          }
        }

        // Fetch products
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products)) {
            setProducts(data.products);
            if (data.products.length > 0) {
              const first = data.products[0];
              setSelectedProductId(first.id);
              setProductName(first.name);
              setPrice(String(first.price || 0));
              setSku(first.sku || "");
              const initialBarcode = first.barcode || first.sku || `RN-${Math.floor(100000 + Math.random() * 900000)}`;
              setBarcodeValue(initialBarcode);
            }
          }
        }
      } catch (err) {
        console.error("Error loading barcode studio data:", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadData();
  }, []);

  // Update barcode value when selecting a product or variant
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedVariantId("");
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setProductName(prod.name);
    setPrice(String(prod.price || 0));
    setSku(prod.sku || "");
    const code = prod.barcode || prod.sku || `RN-${Math.floor(100000 + Math.random() * 900000)}`;
    setBarcodeValue(code);
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod || !prod.variants) return;

    const variant = prod.variants.find((v) => v.id === variantId);
    if (!variant) return;

    setProductName(`${prod.name} (${variant.name})`);
    setPrice(String(variant.price || prod.price || 0));
    setSku(variant.sku || prod.sku || "");
    const code = variant.barcode || variant.sku || prod.barcode || `RN-${Math.floor(100000 + Math.random() * 900000)}`;
    setBarcodeValue(code);
  };

  // Generate random barcode utility
  const generateRandomCode = (type: "EAN13" | "CODE128") => {
    if (type === "EAN13") {
      // 12 random digits + valid check digit
      let code = "890" + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const fullEan = code + checkDigit;
      setBarcodeFormat("EAN13");
      setBarcodeValue(fullEan);
      showToast(`Generated EAN-13: ${fullEan}`);
    } else {
      const code = "RN-" + Math.floor(100000 + Math.random() * 900000);
      setBarcodeFormat("CODE128");
      setBarcodeValue(code);
      showToast(`Generated CODE 128: ${code}`);
    }
  };

  // Render Barcode dynamically whenever value, format, or dimensions change
  useEffect(() => {
    if (!barcodeValue) return;

    if (barcodeFormat === "QR") {
      QRCode.toDataURL(
        barcodeValue,
        {
          width: 140,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        },
        (err, url) => {
          if (!err && url) {
            setQrCodeDataUrl(url);
          }
        }
      );
      return;
    }

    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: barcodeFormat,
          width: barWidth,
          height: barHeight,
          displayValue: showBarcodeText,
          fontSize: fontSize,
          margin: 2,
          textMargin: 2,
          font: "Inter, sans-serif",
          lineColor: "#000000",
          background: "transparent",
        });
      } catch (err: any) {
        console.warn("JsBarcode generation error (fallback to CODE128):", err?.message);
        // If EAN13 or format fails due to invalid characters or length, fallback to CODE128
        try {
          JsBarcode(svgRef.current, barcodeValue, {
            format: "CODE128",
            width: barWidth,
            height: barHeight,
            displayValue: showBarcodeText,
            fontSize: fontSize,
            margin: 2,
            textMargin: 2,
            font: "Inter, sans-serif",
            lineColor: "#000000",
            background: "transparent",
          });
        } catch {
          // invalid barcode content
        }
      }
    }
  }, [barcodeValue, barcodeFormat, barWidth, barHeight, showBarcodeText, fontSize]);

  // Current selected label preset specs
  const activePreset = useMemo(() => {
    return LABEL_PRESETS.find((p) => p.id === selectedPreset) || LABEL_PRESETS[0];
  }, [selectedPreset]);

  // Filtered products for dropdown search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [products, productSearch]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Add to Print Queue
  const handleAddToQueue = () => {
    const newItem: QueuedItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productName: productName.trim() || "Item",
      barcodeValue: barcodeValue.trim(),
      barcodeFormat,
      price: price.trim(),
      mrp: showMrp ? mrp.trim() : undefined,
      storeName: storeName.trim(),
      quantity: Math.max(1, printQuantity),
      labelPreset: selectedPreset,
      showStoreName,
      showProductName,
      showPrice,
      showBarcodeText,
      showSku,
      sku,
    };

    setPrintQueue((prev) => [...prev, newItem]);
    showToast(`Added ${printQuantity} label(s) for "${productName}" to Print Queue`);
  };

  // Remove from Print Queue
  const handleRemoveFromQueue = (id: string) => {
    setPrintQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item quantity in queue
  const handleUpdateQueueQty = (id: string, delta: number) => {
    setPrintQueue((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as QueuedItem[]
    );
  };

  // Download SVG
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barcode_${barcodeValue}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Barcode downloaded as SVG!");
  };

  // Download Label as PNG
  const handleDownloadPNG = () => {
    if (!labelPreviewRef.current) return;

    // Use HTML Canvas to export
    const previewEl = labelPreviewRef.current;
    const svgEl = previewEl.querySelector("svg");

    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      canvas.width = activePreset.pxW * 2;
      canvas.height = activePreset.pxH * 2;

      img.onload = () => {
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

        // Header store name
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px Inter, sans-serif";
        ctx.textAlign = "center";
        let yOffset = 32;

        if (showStoreName) {
          ctx.fillText(storeName, canvas.width / 2, yOffset);
          yOffset += 24;
        }

        // Product title
        if (showProductName) {
          ctx.font = "600 18px Inter, sans-serif";
          ctx.fillStyle = "#334155";
          const title = productName.length > 32 ? productName.slice(0, 30) + "..." : productName;
          ctx.fillText(title, canvas.width / 2, yOffset);
          yOffset += 10;
        }

        // Draw barcode image
        const svgW = img.width * 1.5;
        const svgH = img.height * 1.5;
        ctx.drawImage(img, (canvas.width - svgW) / 2, yOffset, svgW, svgH);
        yOffset += svgH + 18;

        // Draw price
        if (showPrice) {
          ctx.font = "bold 24px Inter, sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(`MRP ₹ ${price}`, canvas.width / 2, yOffset);
        }

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `label_${barcodeValue}.png`;
        link.click();
        showToast("High-resolution label downloaded as PNG!");
      };

      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } else {
      showToast("Unable to export canvas");
    }
  };

  // Direct Print function for current single label
  const handlePrintCurrentLabel = () => {
    window.print();
  };

  // Total labels in queue
  const totalQueueLabels = useMemo(() => {
    return printQueue.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [printQueue]);

  return (
    <SoftwareLayout>
      <div className="space-y-4 pb-12">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1e1b4b] text-white px-4 py-3 rounded-[6px] shadow-lg flex items-center gap-2.5 text-xs font-medium border border-purple-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Page Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span>Product Manager</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Barcode Generator</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Barcode Generator & Label Studio
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-purple-50 text-[#5e2b9d] border border-purple-200">
                PRO Studio
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Design, customize, and print high-precision barcode stickers for thermal roll printers and A4 sticker sheets.
            </p>
          </div>

          {/* Top Actions: Queue Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQueueOpen(true)}
              className="h-[34px] max-h-[34px] px-3.5 bg-white border border-slate-200 hover:border-[#5e2b9d] hover:text-[#5e2b9d] text-slate-700 text-xs font-semibold rounded-[6px] transition-all flex items-center gap-2 shadow-2xs cursor-pointer relative"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Batch Print Queue</span>
              {totalQueueLabels > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-[6px] text-[10px] font-bold bg-[#5e2b9d] text-white">
                  {totalQueueLabels}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintCurrentLabel}
              className="h-[34px] max-h-[34px] px-4 bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print Label</span>
            </button>
          </div>
        </div>

        {/* Source Switcher Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setMode("catalog")}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              mode === "catalog"
                ? "border-[#5e2b9d] text-[#5e2b9d]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Select From Products</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              mode === "custom"
                ? "border-[#5e2b9d] text-[#5e2b9d]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Custom / Manual Barcode</span>
          </button>
        </div>

        {/* Main 2-Column Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Controls & Settings (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Catalog Selector Box (when in Catalog mode) */}
            {mode === "catalog" && (
              <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Select Store Product
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {products.length} products available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Search Product
                    </label>
                    <input
                      type="text"
                      placeholder="Type name, SKU or barcode..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Choose from List
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    >
                      {filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₹{p.price} {p.sku ? `(${p.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If selected product has variants, allow selecting variant */}
                {selectedProduct?.hasVariations && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                      Product Variant:
                    </span>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => handleVariantSelect(e.target.value)}
                      className="flex-1 h-[34px] max-h-[34px] bg-purple-50/50 border border-purple-200 rounded-[6px] px-2.5 text-xs text-purple-900 font-medium focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                    >
                      <option value="">Base Product (All Variants)</option>
                      {selectedProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — ₹{v.price || selectedProduct.price} {v.sku ? `[${v.sku}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Barcode & Content Settings Card */}
            <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Barcode Data & Symbology
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => generateRandomCode("CODE128")}
                    className="h-[28px] max-h-[34px] px-2 text-[10.5px] font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-[6px] transition-colors cursor-pointer"
                  >
                    + Random Code128
                  </button>
                  <button
                    type="button"
                    onClick={() => generateRandomCode("EAN13")}
                    className="h-[28px] max-h-[34px] px-2 text-[10.5px] font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-[6px] transition-colors cursor-pointer"
                  >
                    + Random EAN-13
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Barcode Value / SKU String
                  </label>
                  <input
                    type="text"
                    required
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    placeholder="e.g. 8901030864789 or PROD-991"
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 font-mono text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must be valid format for chosen symbology
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Barcode Symbology
                  </label>
                  <select
                    value={barcodeFormat}
                    onChange={(e) => setBarcodeFormat(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  >
                    {BARCODE_FORMATS.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>
                        {fmt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Store / Brand Header
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Retail Next Supermarket"
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Sunlite Sunflower Oil 1L"
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="145.00"
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    MRP / Cross-out Price (₹)
                  </label>
                  <input
                    type="text"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="160.00"
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>
              </div>

              {/* Display Element Toggles */}
              <div className="pt-3 border-t border-slate-100">
                <span className="block text-[11px] font-semibold text-slate-700 mb-2">
                  Label Elements Visibility:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">Store Name</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => setShowProductName(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">Product Name</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">Price (₹)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showMrp}
                      onChange={(e) => setShowMrp(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">MRP Striated</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showBarcodeText}
                      onChange={(e) => setShowBarcodeText(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">Barcode Text</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSku}
                      onChange={(e) => setShowSku(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span className="text-slate-700">SKU Code</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Label Size & Thermal Sticker Dimensions */}
            <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
              <span className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
                Sticker Size & Thermal Presets
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LABEL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border flex items-center justify-between transition-all cursor-pointer ${
                      selectedPreset === preset.id
                        ? "border-[#5e2b9d] bg-purple-50/60 ring-1 ring-[#5e2b9d]"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 shrink-0">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium truncate ml-1.5">
                      {preset.sub}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sliders for Bar Height and Density */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Bar Density</span>
                    <span className="text-[#5e2b9d]">{barWidth}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.1"
                    value={barWidth}
                    onChange={(e) => setBarWidth(parseFloat(e.target.value))}
                    className="w-full accent-[#5e2b9d] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Barcode Height</span>
                    <span className="text-[#5e2b9d]">{barHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="65"
                    step="2"
                    value={barHeight}
                    onChange={(e) => setBarHeight(parseInt(e.target.value, 10))}
                    className="w-full accent-[#5e2b9d] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Font Size</span>
                    <span className="text-[#5e2b9d]">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="9"
                    max="14"
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="w-full accent-[#5e2b9d] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Visual Preview & Action Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4 sticky top-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Live Label Preview
                  </span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {activePreset.width} × {activePreset.height}
                </span>
              </div>

              {/* The Realistic Physical Sticker Card */}
              <div className="bg-slate-100/70 p-6 rounded-[6px] flex items-center justify-center border border-dashed border-slate-300">
                <div
                  ref={labelPreviewRef}
                  id="barcode-sticker-preview"
                  style={{
                    width: `${activePreset.pxW}px`,
                    minHeight: `${activePreset.pxH}px`,
                  }}
                  className="bg-white border-2 border-slate-800 rounded-[6px] p-2.5 flex flex-col items-center justify-between text-center shadow-md select-none transition-all"
                >
                  {/* Store Name Header */}
                  {showStoreName && (
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5 w-full truncate">
                      {storeName || "Retail Next"}
                    </div>
                  )}

                  {/* Product Title */}
                  {showProductName && (
                    <div className="text-[11px] font-bold text-slate-800 leading-tight my-1 line-clamp-2 px-1">
                      {productName || "Product Name"}
                    </div>
                  )}

                  {/* Barcode Graphic or QR Code */}
                  <div className="my-1 flex items-center justify-center w-full overflow-hidden">
                    {barcodeFormat === "QR" ? (
                      qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code"
                          className="w-24 h-24 object-contain mx-auto"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                          QR Loading
                        </div>
                      )
                    ) : (
                      <svg ref={svgRef} className="max-w-full h-auto" />
                    )}
                  </div>

                  {/* Price & SKU Bottom Row */}
                  <div className="w-full flex items-center justify-between border-t border-slate-200 pt-1 mt-0.5 px-0.5">
                    {showSku ? (
                      <span className="text-[9.5px] font-mono text-slate-500 truncate max-w-[80px]">
                        {sku || barcodeValue}
                      </span>
                    ) : <span />}

                    {showPrice && (
                      <div className="flex items-baseline gap-1 ml-auto">
                        {showMrp && mrp && (
                          <span className="text-[9.5px] line-through text-slate-400 font-medium">
                            ₹{mrp}
                          </span>
                        )}
                        <span className="text-[13px] font-black text-slate-900">
                          ₹{price || "0.00"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Below Preview */}
              <div className="mt-4 space-y-2.5">
                {/* Add to Queue Row */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-[6px] overflow-hidden bg-slate-50 h-[34px] max-h-[34px] w-[110px] shrink-0">
                    <button
                      type="button"
                      onClick={() => setPrintQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={printQuantity}
                      onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setPrintQuantity((q) => q + 1)}
                      className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    className="flex-1 h-[34px] max-h-[34px] bg-purple-50 hover:bg-purple-100 text-[#5e2b9d] border border-purple-200 text-xs font-semibold rounded-[6px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add to Print Queue</span>
                  </button>
                </div>

                {/* Primary Print Button */}
                <button
                  type="button"
                  onClick={handlePrintCurrentLabel}
                  className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-bold rounded-[6px] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Single Sticker Now</span>
                </button>

                {/* Secondary Export Options */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadPNG}
                    className="h-[34px] max-h-[34px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-[6px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSVG}
                    className="h-[34px] max-h-[34px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-[6px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Download SVG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BATCH PRINT QUEUE MODAL / DRAWER */}
        {isQueueOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-2xl rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-purple-100 text-[#5e2b9d] flex items-center justify-center font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Batch Barcode Print Queue
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {printQueue.length} unique item(s) • {totalQueueLabels} total label stickers
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQueueOpen(false)}
                  className="w-8 h-8 rounded-[6px] hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body / Items List */}
              <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-3">
                {printQueue.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <div className="w-12 h-12 rounded-[6px] bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Print queue is currently empty</p>
                    <p className="text-[11px] text-slate-400">
                      Click "+ Add to Print Queue" in the customizer to queue labels for printing.
                    </p>
                  </div>
                ) : (
                  printQueue.map((item) => (
                    <div key={item.id} className="pt-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.productName}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-medium text-slate-700">
                            {item.barcodeValue}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">
                            ₹{item.price}
                          </span>
                          <span>•</span>
                          <span className="text-slate-400">{item.barcodeFormat}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-[6px] overflow-hidden bg-slate-50 h-[30px] max-h-[34px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateQueueQty(item.id, -1)}
                            className="w-7 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-10 text-center text-xs font-bold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQueueQty(item.id, 1)}
                            className="w-7 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="w-7 h-7 rounded-[6px] hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPrintQueue([])}
                  disabled={printQueue.length === 0}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear Queue
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQueueOpen(false)}
                    className="h-[34px] px-4 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-[6px] transition-colors cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsQueueOpen(false);
                      setTimeout(() => window.print(), 200);
                    }}
                    disabled={printQueue.length === 0}
                    className="h-[34px] px-5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-bold rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print All ({totalQueueLabels} Stickers)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE AREA FOR BROWSER PRINT (Hidden on screen, visible only during window.print()) */}
        <div id="print-sheet-container" className="hidden print:block">
          <style jsx global>{`
            @media print {
              @page {
                size: auto;
                margin: 4mm;
              }
              body * {
                visibility: hidden;
              }
              #print-sheet-container,
              #print-sheet-container * {
                visibility: visible;
              }
              #print-sheet-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                display: block !important;
              }
              .print-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 4mm;
                justify-content: flex-start;
              }
              .print-label-item {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
          `}</style>

          <div className="print-grid">
            {printQueue.length > 0
              ? printQueue.flatMap((item) =>
                  Array.from({ length: item.quantity }).map((_, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="print-label-item border border-black p-2 flex flex-col items-center justify-between text-center"
                      style={{
                        width: activePreset.width,
                        height: activePreset.height,
                      }}
                    >
                      {item.showStoreName && (
                        <div className="text-[10px] font-black uppercase tracking-wider truncate w-full border-b border-black pb-0.5">
                          {item.storeName}
                        </div>
                      )}
                      {item.showProductName && (
                        <div className="text-[9px] font-bold leading-tight truncate w-full">
                          {item.productName}
                        </div>
                      )}
                      <div className="my-0.5 flex items-center justify-center">
                        <svg
                          ref={(el) => {
                            if (el && item.barcodeValue) {
                              try {
                                JsBarcode(el, item.barcodeValue, {
                                  format: item.barcodeFormat === "QR" ? "CODE128" : item.barcodeFormat,
                                  width: barWidth,
                                  height: barHeight * 0.75,
                                  displayValue: item.showBarcodeText,
                                  fontSize: 9,
                                  margin: 0,
                                });
                              } catch {}
                            }
                          }}
                        />
                      </div>
                      {item.showPrice && (
                        <div className="text-[11px] font-black w-full border-t border-black pt-0.5">
                          MRP ₹{item.price}
                        </div>
                      )}
                    </div>
                  ))
                )
              : Array.from({ length: printQuantity }).map((_, idx) => (
                  <div
                    key={`single-${idx}`}
                    className="print-label-item border border-black p-2 flex flex-col items-center justify-between text-center"
                    style={{
                      width: activePreset.width,
                      height: activePreset.height,
                    }}
                  >
                    {showStoreName && (
                      <div className="text-[10px] font-black uppercase tracking-wider truncate w-full border-b border-black pb-0.5">
                        {storeName}
                      </div>
                    )}
                    {showProductName && (
                      <div className="text-[9px] font-bold leading-tight truncate w-full">
                        {productName}
                      </div>
                    )}
                    <div className="my-0.5 flex items-center justify-center">
                      <svg
                        ref={(el) => {
                          if (el && barcodeValue) {
                            try {
                              JsBarcode(el, barcodeValue, {
                                format: barcodeFormat === "QR" ? "CODE128" : barcodeFormat,
                                width: barWidth,
                                height: barHeight * 0.75,
                                displayValue: showBarcodeText,
                                fontSize: 9,
                                margin: 0,
                              });
                            } catch {}
                          }
                        }}
                      />
                    </div>
                    {showPrice && (
                      <div className="text-[11px] font-black w-full border-t border-black pt-0.5">
                        MRP ₹{price}
                      </div>
                    )}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </SoftwareLayout>
  );
}
