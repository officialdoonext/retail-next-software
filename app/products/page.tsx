"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { download80MasterProductsSampleExcel } from "@/lib/dummyProducts80";
import * as XLSX from "xlsx";

interface StoreItem {
  id: string;
  name: string;
  city?: string;
  location?: string;
}

interface WarehouseItem {
  id: string;
  name: string;
  city?: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface VariationOptionItem {
  id: string;
  name: string;
  values: string[];
}

interface LocationStock {
  stores: { storeId: string; storeName: string; stock: number }[];
  warehouses: { warehouseId: string; warehouseName: string; stock: number }[];
}

interface VariantItem {
  id: string;
  name: string;
  attributes: Record<string, string>;
  shortCode: string;
  sku: string;
  barcode: string; // Strictly numeric only
  listPrice: number;
  salesPrice: number;
  taxRate?: number; // GST rate percentage (e.g. 0, 5, 12, 18, 28)
  isTaxInclusive?: boolean; // true = GST Inclusive, false = GST Exclusive
  stock: number;
  locationStocks: LocationStock;
}

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  shortCode?: string;
  sku: string;
  barcode: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  hasVariations: boolean;
  listPrice: number;
  salesPrice: number;
  price: number;
  mrp: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
  stock: number;
  minStock?: number;
  locationStocks?: LocationStock;
  variants?: VariantItem[];
  createdAt?: number;
}

// Generate numeric-only unique barcode
function generateNumericBarcode(): string {
  const prefix = "890";
  const middle = Math.floor(100000000 + Math.random() * 900000000).toString();
  const suffix = Math.floor(10 + Math.random() * 90).toString();
  return `${prefix}${middle}${suffix}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  // Metadata
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [availableVariations, setAvailableVariations] = useState<VariationOptionItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  // Pagination (Strictly 24 items per page)
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State (Full Screen Modal)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [sku, setSku] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Simple vs Variation Toggle
  const [hasVariations, setHasVariations] = useState(false);

  // Simple Product Pricing, Barcode & GST
  const [simpleListPrice, setSimpleListPrice] = useState<number | "">("");
  const [simpleSalesPrice, setSimpleSalesPrice] = useState<number | "">("");
  const [simpleBarcode, setSimpleBarcode] = useState("");
  const [simpleTaxRate, setSimpleTaxRate] = useState<number>(18);
  const [simpleIsTaxInclusive, setSimpleIsTaxInclusive] = useState<boolean>(true);

  // Simple Product Multi-Location Stocks
  const [simpleStoreStocks, setSimpleStoreStocks] = useState<Record<string, number>>({});
  const [simpleWarehouseStocks, setSimpleWarehouseStocks] = useState<Record<string, number>>({});

  // Variation Product State
  const [selectedVariationNames, setSelectedVariationNames] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);

  // Sub-modal for configuring stock per variant
  const [activeVariantForStock, setActiveVariantForStock] = useState<VariantItem | null>(null);

  // Form Validation & Feedback
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Delete Modal
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Upload State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkProgress, setBulkProgress] = useState("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load product metadata (Categories, Variations, Stores, Warehouses)
  const loadMetadata = useCallback(async () => {
    try {
      const res = await fetch("/api/products/meta");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
          setAvailableVariations(data.variations || []);
          setStores(data.stores || []);
          setWarehouses(data.warehouses || []);
        }
      }
    } catch (err) {
      console.error("Failed to load metadata:", err);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load products list (24 per page)
  const loadProducts = useCallback(
    async (page: number, search: string, catId: string) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (search) params.set("search", search);
        if (catId && catId !== "ALL") params.set("categoryId", catId);

        const res = await fetch(`/api/products?${params.toString()}&_t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products)) {
            setProducts(data.products);
            if (data.pagination) {
              setTotalCount(data.pagination.total || 0);
              setTotalPages(data.pagination.totalPages || 1);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProducts(currentPage, debouncedSearch, selectedCategoryFilter);
  }, [loadProducts, currentPage, debouncedSearch, selectedCategoryFilter]);

  // ESC key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeVariantForStock) {
          setActiveVariantForStock(null);
        } else if (isBulkModalOpen) {
          setIsBulkModalOpen(false);
        } else {
          setIsFormModalOpen(false);
          setDeletingProduct(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeVariantForStock, isBulkModalOpen]);

  // Calculate Simple Product Total Stock
  const simpleTotalStock = useMemo(() => {
    const storeSum = Object.values(simpleStoreStocks).reduce((a, b) => a + (Number(b) || 0), 0);
    const whSum = Object.values(simpleWarehouseStocks).reduce((a, b) => a + (Number(b) || 0), 0);
    return storeSum + whSum;
  }, [simpleStoreStocks, simpleWarehouseStocks]);

  // Open "Add Product" Modal with clean initial state
  const handleOpenAddProduct = () => {
    setFormMode("add");
    setEditingProductId(null);
    setName("");
    setDescription("");
    const newSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    setSku(newSku);
    setShortCode(`PRD-${Math.floor(100 + Math.random() * 900)}`);
    setImageUrl("");
    setSelectedImageFile(null);
    setImagePreviewUrl("");
    setCategoryId(categories[0]?.id || "");
    setHasVariations(false);

    // Simple fields
    setSimpleListPrice("");
    setSimpleSalesPrice("");
    setSimpleBarcode(generateNumericBarcode());
    setSimpleTaxRate(18);
    setSimpleIsTaxInclusive(true);
    setSimpleStoreStocks({});
    setSimpleWarehouseStocks({});

    // Variation fields
    setSelectedVariationNames([]);
    setVariants([]);

    setFormError("");
    setIsFormModalOpen(true);
  };

  // Open "Edit Product" Modal
  const handleOpenEditProduct = (p: ProductItem) => {
    setFormMode("edit");
    setEditingProductId(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setShortCode(p.shortCode || "");
    setSku(p.sku);
    setImageUrl(p.imageUrl || "");
    setSelectedImageFile(null);
    setImagePreviewUrl(p.imageUrl || "");
    setCategoryId(p.categoryId || "");
    setHasVariations(p.hasVariations);

    const defaultTaxRate = p.taxRate !== undefined ? Number(p.taxRate) : 18;
    const defaultIsTaxInclusive = p.isTaxInclusive !== undefined ? Boolean(p.isTaxInclusive) : true;
    setSimpleTaxRate(defaultTaxRate);
    setSimpleIsTaxInclusive(defaultIsTaxInclusive);

    if (p.hasVariations) {
      const mappedVariants = (p.variants || []).map((v) => ({
        ...v,
        taxRate: v.taxRate !== undefined ? Number(v.taxRate) : defaultTaxRate,
        isTaxInclusive: v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : defaultIsTaxInclusive,
      }));
      setVariants(mappedVariants);
      const varNames = new Set<string>();
      (p.variants || []).forEach((v) => {
        Object.keys(v.attributes || {}).forEach((k) => varNames.add(k));
      });
      setSelectedVariationNames(Array.from(varNames));
    } else {
      setSimpleListPrice(p.listPrice !== undefined && p.listPrice !== null ? p.listPrice : (p.mrp ?? ""));
      setSimpleSalesPrice(p.salesPrice !== undefined && p.salesPrice !== null ? p.salesPrice : (p.price ?? ""));
      setSimpleBarcode(p.barcode || generateNumericBarcode());

      const stMap: Record<string, number> = {};
      const whMap: Record<string, number> = {};
      (p.locationStocks?.stores || []).forEach((s) => {
        stMap[s.storeId] = s.stock;
      });
      (p.locationStocks?.warehouses || []).forEach((w) => {
        whMap[w.warehouseId] = w.stock;
      });
      if (Object.keys(stMap).length === 0 && Object.keys(whMap).length === 0 && p.stock > 0 && stores[0]?.id) {
        stMap[stores[0].id] = p.stock;
      }
      setSimpleStoreStocks(stMap);
      setSimpleWarehouseStocks(whMap);
    }

    setFormError("");
    setIsFormModalOpen(true);
  };

  // Handle local image file choice (Upload occurs ONLY on "Save Product")
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  // Remove chosen or existing image
  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl("");
    setImageUrl("");
  };

  // Add a new empty variant row
  const handleAddCustomVariant = () => {
    const newIndex = variants.length + 1;
    const initialAttrs: Record<string, string> = {};
    selectedVariationNames.forEach((vName) => {
      initialAttrs[vName] = "";
    });

    const newVar: VariantItem = {
      id: `var_${Date.now()}_${newIndex}`,
      name: `Variant ${newIndex}`,
      attributes: initialAttrs,
      shortCode: `${shortCode || "PRD"}-${newIndex}`,
      sku: `${sku || "SKU"}-${newIndex}`,
      barcode: generateNumericBarcode(),
      listPrice: Number(simpleListPrice) || 0,
      salesPrice: Number(simpleSalesPrice) || 0,
      taxRate: simpleTaxRate || 18,
      isTaxInclusive: simpleIsTaxInclusive !== undefined ? simpleIsTaxInclusive : true,
      stock: 0,
      locationStocks: { stores: [], warehouses: [] },
    };
    setVariants([...variants, newVar]);
  };

  // Bulk Apply Tax Rate to all variants
  const handleApplyTaxRateToAllVariants = (rate: number) => {
    setVariants((prev) => prev.map((v) => ({ ...v, taxRate: rate })));
    setToastMsg(`Applied ${rate}% GST to all variants.`);
    setTimeout(() => setToastMsg(""), 2500);
  };

  // Bulk Apply Tax Mode (Inclusive vs Exclusive) to all variants
  const handleApplyTaxModeToAllVariants = (isInclusive: boolean) => {
    setVariants((prev) => prev.map((v) => ({ ...v, isTaxInclusive: isInclusive })));
    setToastMsg(`Applied ${isInclusive ? "GST Inclusive" : "GST Exclusive"} to all variants.`);
    setTimeout(() => setToastMsg(""), 2500);
  };

  // Remove a variant row
  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Update specific variant field
  const handleUpdateVariantField = (
    index: number,
    field: keyof VariantItem,
    value: any
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== index) return v;
        if (field === "barcode") {
          const numericOnly = String(value).replace(/\D/g, "");
          return { ...v, barcode: numericOnly };
        }
        return { ...v, [field]: value };
      })
    );
  };

  // Update specific variant attribute value
  const handleUpdateVariantAttribute = (
    index: number,
    attrName: string,
    attrValue: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== index) return v;
        const updatedAttrs = { ...v.attributes, [attrName]: attrValue };
        const label = Object.values(updatedAttrs).filter(Boolean).join(" / ") || `Variant ${i + 1}`;
        return {
          ...v,
          attributes: updatedAttrs,
          name: label,
        };
      })
    );
  };

  // Save stocks for active variant in sub-modal
  const handleSaveVariantStock = (updatedStocks: LocationStock) => {
    if (!activeVariantForStock) return;
    const storeTotal = updatedStocks.stores.reduce((a, b) => a + (Number(b.stock) || 0), 0);
    const whTotal = updatedStocks.warehouses.reduce((a, b) => a + (Number(b.stock) || 0), 0);
    const total = storeTotal + whTotal;

    setVariants((prev) =>
      prev.map((v) =>
        v.id === activeVariantForStock.id
          ? { ...v, locationStocks: updatedStocks, stock: total }
          : v
      )
    );
    setActiveVariantForStock(null);
  };

  // Save or Update Product
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Product Name is required.");
      return;
    }

    if (!hasVariations) {
      const numericBarcode = simpleBarcode.replace(/\D/g, "");
      if (!numericBarcode) {
        setFormError("A numeric barcode is required.");
        return;
      }
      if (simpleSalesPrice === "" || Number(simpleSalesPrice) < 0) {
        setFormError("Please enter a valid Sales Price.");
        return;
      }
    } else {
      if (variants.length === 0) {
        setFormError("Please add at least one variant combination.");
        return;
      }

      const barcodeSet = new Set<string>();
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const bc = String(v.barcode || "").replace(/\D/g, "");
        if (!bc) {
          setFormError(`Variant #${i + 1} (${v.name}) requires a numeric barcode.`);
          return;
        }
        if (barcodeSet.has(bc)) {
          setFormError(`Duplicate barcode "${bc}" detected on Variant #${i + 1}. Each variant must have a unique numeric barcode.`);
          return;
        }
        barcodeSet.add(bc);
      }
    }

    setSubmitting(true);
    setFormError("");

    try {
      let finalImageUrl = imageUrl;

      // 1. If an image file was selected, upload it to ImageKit first
      if (selectedImageFile) {
        const fd = new FormData();
        fd.append("file", selectedImageFile);
        fd.append("folder", "products");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
          setFormError(uploadData.error || "Failed to upload image to ImageKit.");
          setSubmitting(false);
          return;
        }
        finalImageUrl = uploadData.url;
        setImageUrl(finalImageUrl);
      }

      const selectedCat = categories.find((c) => c.id === categoryId);

      const simpleLocationStocks: LocationStock = {
        stores: stores.map((s) => ({
          storeId: s.id,
          storeName: s.name,
          stock: Number(simpleStoreStocks[s.id]) || 0,
        })),
        warehouses: warehouses.map((w) => ({
          warehouseId: w.id,
          warehouseName: w.name,
          stock: Number(simpleWarehouseStocks[w.id]) || 0,
        })),
      };

      const payload: any = {
        name: trimmedName,
        description,
        shortCode,
        sku,
        imageUrl: finalImageUrl,
        categoryId: categoryId || null,
        categoryName: selectedCat ? selectedCat.name : "Uncategorized",
        hasVariations,
      };

      if (!hasVariations) {
        payload.listPrice = Number(simpleListPrice) || Number(simpleSalesPrice) || 0;
        payload.salesPrice = Number(simpleSalesPrice) || 0;
        payload.price = payload.salesPrice;
        payload.mrp = payload.listPrice;
        payload.barcode = simpleBarcode.replace(/\D/g, "");
        payload.taxRate = Number(simpleTaxRate) || 0;
        payload.isTaxInclusive = Boolean(simpleIsTaxInclusive);
        payload.locationStocks = simpleLocationStocks;
        payload.stock = simpleTotalStock;
      } else {
        payload.variationTypes = selectedVariationNames;
        payload.taxRate = Number(variants[0]?.taxRate ?? 18);
        payload.isTaxInclusive = variants[0]?.isTaxInclusive !== undefined ? Boolean(variants[0]?.isTaxInclusive) : true;
        payload.variants = variants.map((v) => ({
          id: v.id,
          name: v.name,
          attributes: v.attributes,
          shortCode: v.shortCode,
          sku: v.sku,
          barcode: String(v.barcode).replace(/\D/g, ""),
          listPrice: Number(v.listPrice) || Number(v.salesPrice) || 0,
          salesPrice: Number(v.salesPrice) || 0,
          price: Number(v.salesPrice) || 0,
          mrp: Number(v.listPrice) || 0,
          taxRate: v.taxRate !== undefined ? Number(v.taxRate) : 18,
          isTaxInclusive: v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : true,
          stock: Number(v.stock) || 0,
          locationStocks: v.locationStocks,
        }));
      }

      const isEdit = formMode === "edit" && editingProductId;
      const url = "/api/products";
      const method = isEdit ? "PUT" : "POST";
      if (isEdit) payload.id = editingProductId;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || "Failed to save product.");
      } else {
        setIsFormModalOpen(false);
        setToastMsg(
          isEdit
            ? `Product "${trimmedName}" updated successfully!`
            : `Product "${trimmedName}" added successfully!`
        );
        setTimeout(() => setToastMsg(""), 3500);

        // Optimistically update products state immediately so the table updates without any stale-cache delay
        if (isEdit && data.product) {
          setProducts((prev) =>
            prev.map((item) => (item.id === data.product.id ? data.product : item))
          );
        }

        if (!isEdit) {
          setCurrentPage(1);
          loadProducts(1, debouncedSearch, selectedCategoryFilter);
        } else {
          loadProducts(currentPage, debouncedSearch, selectedCategoryFilter);
        }
      }
    } catch {
      setFormError("Network error while saving product.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete product
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/products?id=${deletingProduct.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete product.");
      } else {
        setToastMsg(`Product "${deletingProduct.name}" deleted.`);
        setDeletingProduct(null);
        setTimeout(() => setToastMsg(""), 3500);
        loadProducts(currentPage, debouncedSearch, selectedCategoryFilter);
      }
    } catch {
      alert("Network error while deleting product.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Bulk Excel File Choice
  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkError("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonRows.length === 0) {
        setBulkError("The selected Excel file contains no data rows.");
        setBulkParsedRows([]);
        return;
      }

      setBulkParsedRows(jsonRows);
    } catch (err: any) {
      setBulkError("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.");
    }
  };

  // Execute Bulk Upload to API
  const handleExecuteBulkUpload = async () => {
    if (bulkParsedRows.length === 0) {
      setBulkError("Please choose an Excel file with valid product rows.");
      return;
    }

    setBulkUploading(true);
    setBulkError("");
    setBulkProgress(`Uploading ${bulkParsedRows.length} rows to catalog...`);

    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: bulkParsedRows }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setBulkError(data.error || "Bulk upload failed.");
      } else {
        setIsBulkModalOpen(false);
        setBulkFile(null);
        setBulkParsedRows([]);
        setToastMsg(data.message || `Successfully imported products!`);
        setTimeout(() => setToastMsg(""), 4500);
        setCurrentPage(1);
        loadProducts(1, debouncedSearch, selectedCategoryFilter);
      }
    } catch {
      setBulkError("Network error during bulk upload.");
    } finally {
      setBulkUploading(false);
      setBulkProgress("");
    }
  };

  const fromRecord = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const toRecord = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="p-3 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 stroke-[2.5] text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{toastMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg("")}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span>Product Manager</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Products Master</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Products
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Manage simple and variation items, numeric barcodes, multi-location stock across stores and warehouses.
            </p>
          </div>

          {/* Action Buttons: Bulk Upload & Add Product */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkFile(null);
                setBulkParsedRows([]);
                setBulkError("");
                setIsBulkModalOpen(true);
              }}
              className="h-[36px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4 text-emerald-600 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>Bulk Upload</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="h-[36px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-1 items-center gap-2.5 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 stroke-[2]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, barcode, SKU, shortcode..."
                className="w-full h-[34px] pl-9 pr-3 rounded-[6px] border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-[#5e2b9d] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              Showing {fromRecord}–{toRecord}
            </span>
            <span>of</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-purple-50 text-[#5e2b9d] font-bold text-xs">
              {totalCount} Total
            </span>
            <span className="text-slate-400 text-[11px] ml-1">(Latest 24 per page)</span>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-[#5e2b9d] rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-400 font-medium">Fetching catalog products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                {debouncedSearch ? "No products found" : "No Products in Catalog"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 font-normal">
                {debouncedSearch
                  ? `No products match the search query "${debouncedSearch}".`
                  : "Click '+ Add Product' to create your first item or use 'Bulk Upload' to import 80 master products."}
              </p>
              {!debouncedSearch && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkFile(null);
                      setBulkParsedRows([]);
                      setBulkError("");
                      setIsBulkModalOpen(true);
                    }}
                    className="h-[32px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Bulk Upload 80 Products</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddProduct}
                    className="h-[32px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add First Product</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="py-3 px-3 w-10 text-center text-slate-400 font-normal">#</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">SKU & Shortcode</th>
                    <th className="py-3 px-3">Barcode (Numeric)</th>
                    <th className="py-3 px-3">Price (List / Sale)</th>
                    <th className="py-3 px-3">Stock Available</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p, index) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                    const variantCount = p.variants?.length || 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-9 h-9 rounded-[5px] object-cover border border-slate-200 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-[5px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                                {p.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-800 group-hover:text-[#5e2b9d] transition-colors block text-xs">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {p.categoryName || "Uncategorized"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {p.hasVariations ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-purple-50 text-[#5e2b9d] border border-purple-200/70 text-[11px] font-semibold">
                              Variation ({variantCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-sky-50 text-sky-700 border border-sky-200/70 text-[11px] font-semibold">
                              Simple
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-700 text-xs">{p.sku}</div>
                          {p.shortCode && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Code: {p.shortCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {p.barcode ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 text-[11px]">
                              <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m-4-16v16m8-16v16M4 4v16m16-16v16" />
                              </svg>
                              <span>{p.barcode}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {p.hasVariations && p.variants && p.variants.length > 0 ? (
                            <div>
                              <span className="font-bold text-slate-800">
                                ₹{Math.min(...p.variants.map((v) => v.salesPrice))}
                                {Math.min(...p.variants.map((v) => v.salesPrice)) !==
                                  Math.max(...p.variants.map((v) => v.salesPrice)) &&
                                  ` – ₹${Math.max(...p.variants.map((v) => v.salesPrice))}`}
                              </span>
                              {p.listPrice > 0 && (
                                <span className="text-[10px] text-slate-400 line-through ml-1.5">
                                  ₹{p.listPrice}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800">₹{p.salesPrice}</span>
                              {p.listPrice > p.salesPrice && (
                                <span className="text-[10px] text-slate-400 line-through ml-1.5">
                                  ₹{p.listPrice}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-bold text-xs ${
                                p.stock > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : "bg-rose-50 text-rose-700 border border-rose-200/60"
                              }`}
                            >
                              {p.stock} units
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(p)}
                              className="h-7 px-2.5 rounded-[4px] border border-slate-200 hover:border-[#5e2b9d] hover:bg-purple-50 hover:text-[#5e2b9d] text-slate-600 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                              title="Edit product"
                            >
                              <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(p)}
                              className="h-7 w-7 rounded-[4px] border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete product"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-500">
                Page <span className="font-bold text-slate-800">{currentPage}</span> of{" "}
                <span className="font-bold text-slate-800">{totalPages}</span>
                <span className="text-slate-400 text-[11px] ml-1.5">
                  ({totalCount} products total)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 rounded-[4px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;

                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`h-7 min-w-[28px] px-2 rounded-[4px] font-medium text-xs transition-colors cursor-pointer ${
                            currentPage === p
                              ? "bg-[#5e2b9d] text-white font-bold shadow-xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 rounded-[4px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FULL SCREEN MODAL: ADD / EDIT PRODUCT ── */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-150">
          {/* Top Sticky Header */}
          <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-[6px] border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Back to Catalog"
              >
                <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  {formMode === "edit" ? "Edit Product" : "Add New Product"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Full product master configuration with multi-location inventory & numeric barcodes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsFormModalOpen(false)}
                className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={submitting}
                className="h-[34px] px-4.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {submitting && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>
                  {submitting
                    ? "Saving..."
                    : formMode === "edit"
                    ? "Update Product"
                    : "Save Product"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors ml-1"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full Screen Scrollable Body with centered max-w-7xl container */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50">
            <div className="max-w-7xl mx-auto p-6 lg:p-8">
              <form
                id="product-form"
                onSubmit={handleSubmitProduct}
                className="space-y-6 bg-white rounded-[10px] border border-slate-200/90 shadow-sm p-6 lg:p-8"
              >
                {formError && (
                  <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* SECTION 1: Product Basics */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                    <span>1. General Details</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Image Picker */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Product Image
                      </label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-[#5e2b9d] rounded-[8px] p-3 text-center transition-colors bg-slate-50/50 flex flex-col items-center justify-center min-h-[160px] relative">
                        {imagePreviewUrl || imageUrl ? (
                          <div className="relative group w-full flex flex-col items-center">
                            <img
                              src={imagePreviewUrl || imageUrl}
                              alt="Product preview"
                              className="w-28 h-28 object-cover rounded-[6px] border border-slate-200 shadow-xs mb-1.5 bg-white"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                            >
                              Remove Image
                            </button>
                            {selectedImageFile && (
                              <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                Ready to upload on save
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <svg className="w-8 h-8 text-slate-400 mx-auto mb-1 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <label className="cursor-pointer text-xs font-semibold text-[#5e2b9d] hover:underline block">
                              Choose Image
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileChange}
                                className="hidden"
                              />
                            </label>
                            <span className="text-[10px] text-slate-400 block mt-0.5">PNG, JPG, WebP</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Name, Category, SKU, Shortcode */}
                    <div className="md:col-span-3 space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Product Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Classic Cotton Crew Neck T-Shirt"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full h-[38px] px-3.5 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Category
                          </label>
                          <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                          >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Shortcode
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TSH-01"
                            value={shortCode}
                            onChange={(e) => setShortCode(e.target.value)}
                            className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 font-mono focus:outline-none focus:border-[#5e2b9d]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            SKU <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="e.g. SKU-10492"
                              value={sku}
                              onChange={(e) => setSku(e.target.value)}
                              className="w-full h-[36px] pl-3 pr-8 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 font-mono focus:outline-none focus:border-[#5e2b9d]"
                            />
                            <button
                              type="button"
                              title="Generate new SKU"
                              onClick={() => setSku(`SKU-${Math.floor(100000 + Math.random() * 900000)}`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#5e2b9d] text-xs cursor-pointer"
                            >
                              ↻
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Enter item description, specifications, fabric, materials..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full p-2.5 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Product Type Toggle */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                    <span>2. Product Type</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4 max-w-lg">
                    <button
                      type="button"
                      onClick={() => setHasVariations(false)}
                      className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                        !hasVariations
                          ? "border-[#5e2b9d] bg-purple-50/70 shadow-xs ring-1 ring-[#5e2b9d]"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          !hasVariations ? "border-[#5e2b9d]" : "border-slate-400"
                        }`}>
                          {!hasVariations && <span className="w-1.5 h-1.5 rounded-full bg-[#5e2b9d]" />}
                        </span>
                        <span className="text-xs font-bold text-slate-900">Simple Product</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-5.5">
                        Single item with uniform price, numeric barcode & stock
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHasVariations(true);
                        if (variants.length === 0) {
                          handleAddCustomVariant();
                        }
                      }}
                      className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                        hasVariations
                          ? "border-[#5e2b9d] bg-purple-50/70 shadow-xs ring-1 ring-[#5e2b9d]"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          hasVariations ? "border-[#5e2b9d]" : "border-slate-400"
                        }`}>
                          {hasVariations && <span className="w-1.5 h-1.5 rounded-full bg-[#5e2b9d]" />}
                        </span>
                        <span className="text-xs font-bold text-slate-900">Variation Product</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-5.5">
                        Multiple variants (Colors, Sizes) with individual pricing & barcodes
                      </p>
                    </button>
                  </div>
                </div>

                {/* SECTION 3A: Simple Product Pricing, Numeric Barcode & Stocks */}
                {!hasVariations && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                      <span>3. Pricing, Numeric Barcode & Stock Availability</span>
                    </h3>

                    {/* Pricing, Tax & Numeric Barcode */}
                    <div className="p-4 bg-slate-50/80 rounded-[8px] border border-slate-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            List Price (MRP) ₹
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 999"
                            value={simpleListPrice}
                            onChange={(e) =>
                              setSimpleListPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Sales Price ₹ <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            step="any"
                            placeholder="e.g. 799"
                            value={simpleSalesPrice}
                            onChange={(e) =>
                              setSimpleSalesPrice(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-[#5e2b9d]"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Barcode <span className="text-slate-400 font-normal">(Numeric only)</span> <span className="text-rose-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setSimpleBarcode(generateNumericBarcode())}
                              className="text-[10px] text-[#5e2b9d] hover:underline font-semibold cursor-pointer"
                            >
                              Auto Generate
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="e.g. 8901234567890"
                              value={simpleBarcode}
                              onChange={(e) => {
                                const numeric = e.target.value.replace(/\D/g, "");
                                setSimpleBarcode(numeric);
                              }}
                              className="w-full h-[36px] pl-3 pr-8 rounded-[6px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 tracking-wider focus:outline-none focus:border-[#5e2b9d]"
                            />
                            <button
                              type="button"
                              title="Generate numeric barcode"
                              onClick={() => setSimpleBarcode(generateNumericBarcode())}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#5e2b9d] text-xs cursor-pointer"
                            >
                              ↻
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* GST Tax Rate & Inclusive / Exclusive Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2.5 border-t border-slate-200/80">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            GST Percentage (%)
                          </label>
                          <select
                            value={simpleTaxRate}
                            onChange={(e) => setSimpleTaxRate(Number(e.target.value))}
                            className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                          >
                            <option value={0}>0% (Tax Exempt)</option>
                            <option value={3}>3% (Gold & Precious Metals)</option>
                            <option value={5}>5% (Apparel & Essentials)</option>
                            <option value={12}>12% (Standard 12%)</option>
                            <option value={18}>18% (Standard 18%)</option>
                            <option value={28}>28% (Luxury / De-merit 28%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            GST Tax Calculation Mode
                          </label>
                          <div className="grid grid-cols-2 gap-2 h-[36px]">
                            <button
                              type="button"
                              onClick={() => setSimpleIsTaxInclusive(true)}
                              className={`rounded-[6px] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                simpleIsTaxInclusive
                                  ? "bg-purple-100 border-[#5e2b9d] text-[#5e2b9d]"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span>{simpleIsTaxInclusive ? "✓" : ""}</span>
                              <span>GST Inclusive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSimpleIsTaxInclusive(false)}
                              className={`rounded-[6px] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                !simpleIsTaxInclusive
                                  ? "bg-purple-100 border-[#5e2b9d] text-[#5e2b9d]"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span>{!simpleIsTaxInclusive ? "✓" : ""}</span>
                              <span>GST Exclusive</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stock Availability: Stores & Warehouses */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Stock Availability by Location
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-[4px] bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          Total Stock: {simpleTotalStock} units
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Stores Stock Card */}
                        <div className="border border-slate-200 rounded-[8px] p-4 bg-white shadow-2xs">
                          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-800">
                            <span className="w-6 h-6 rounded-[4px] bg-blue-50 text-blue-600 flex items-center justify-center">
                              🏬
                            </span>
                            <span>Retail Stores ({stores.length})</span>
                          </div>

                          {stores.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                              No retail stores found. Stores can be added manually in Stores Manager.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {stores.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between gap-3 p-2.5 rounded-[5px] bg-slate-50 border border-slate-100"
                                >
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-slate-800 block truncate">
                                      {s.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {s.city || s.location || "Store"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] text-slate-500 font-medium">Qty:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={simpleStoreStocks[s.id] ?? 0}
                                      onChange={(e) =>
                                        setSimpleStoreStocks({
                                          ...simpleStoreStocks,
                                          [s.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                        })
                                      }
                                      className="w-24 h-[32px] px-2 text-right rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Warehouses Stock Card */}
                        <div className="border border-slate-200 rounded-[8px] p-4 bg-white shadow-2xs">
                          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-800">
                            <span className="w-6 h-6 rounded-[4px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                              🏭
                            </span>
                            <span>Central Warehouses ({warehouses.length})</span>
                          </div>

                          {warehouses.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                              No warehouses created yet. You can create warehouses in Stock ➔ Warehouse.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {warehouses.map((w) => (
                                <div
                                  key={w.id}
                                  className="flex items-center justify-between gap-3 p-2.5 rounded-[5px] bg-slate-50 border border-slate-100"
                                >
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-slate-800 block truncate">
                                      {w.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {w.city || "Storage Hub"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] text-slate-500 font-medium">Qty:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={simpleWarehouseStocks[w.id] ?? 0}
                                      onChange={(e) =>
                                        setSimpleWarehouseStocks({
                                          ...simpleWarehouseStocks,
                                          [w.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                        })
                                      }
                                      className="w-24 h-[32px] px-2 text-right rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 3B: Variation Product Configuration */}
                {hasVariations && (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                        <span>3. Variations Matrix & Pricing</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddCustomVariant}
                          className="h-8 px-3.5 rounded-[5px] bg-[#5e2b9d] text-white hover:bg-[#4e2284] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Add Variant Combination</span>
                        </button>
                      </div>
                    </div>

                    {/* Select Variations / Attributes to use */}
                    <div className="p-3.5 bg-slate-50 rounded-[8px] border border-slate-200 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Select Variation Types (e.g. Color, Size):
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {availableVariations.map((v) => {
                          const isSelected = selectedVariationNames.includes(v.name);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedVariationNames(selectedVariationNames.filter((n) => n !== v.name));
                                } else {
                                  setSelectedVariationNames([...selectedVariationNames, v.name]);
                                }
                              }}
                              className={`h-7 px-3 rounded-[4px] text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-purple-100 border-[#5e2b9d] text-[#5e2b9d] font-bold"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{v.name}</span>
                              {v.values?.length > 0 && (
                                <span className="text-[10px] text-slate-400">({v.values.length})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Bulk GST actions */}
                    {variants.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50/80 border border-slate-200 rounded-[6px] text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5e2b9d]" />
                          <span>Quick Set GST for All Variants:</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[0, 3, 5, 12, 18, 28].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => handleApplyTaxRateToAllVariants(rate)}
                              className="px-2 py-0.5 rounded-[4px] bg-white border border-slate-200 text-slate-700 hover:border-[#5e2b9d] hover:text-[#5e2b9d] font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              {rate}%
                            </button>
                          ))}
                          <span className="text-slate-300 mx-1">|</span>
                          <button
                            type="button"
                            onClick={() => handleApplyTaxModeToAllVariants(true)}
                            className="px-2.5 py-0.5 rounded-[4px] bg-white border border-slate-200 text-slate-700 hover:border-[#5e2b9d] hover:text-[#5e2b9d] font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            All Incl.
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyTaxModeToAllVariants(false)}
                            className="px-2.5 py-0.5 rounded-[4px] bg-white border border-slate-200 text-slate-700 hover:border-[#5e2b9d] hover:text-[#5e2b9d] font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            All Excl.
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Variants List Table */}
                    <div className="border border-slate-200 rounded-[8px] overflow-hidden bg-white shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold select-none">
                              <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                              <th className="py-2.5 px-3 min-w-[160px]">Variant / Attributes</th>
                              <th className="py-2.5 px-3 min-w-[110px]">Shortcode</th>
                              <th className="py-2.5 px-3 min-w-[120px]">SKU</th>
                              <th className="py-2.5 px-3 min-w-[170px]">Barcode (Numeric)</th>
                              <th className="py-2.5 px-3 min-w-[100px]">List (₹)</th>
                              <th className="py-2.5 px-3 min-w-[100px]">Sale (₹)*</th>
                              <th className="py-2.5 px-3 min-w-[95px]">GST %</th>
                              <th className="py-2.5 px-3 min-w-[115px]">Tax Mode</th>
                              <th className="py-2.5 px-3 min-w-[130px]">Stock Distribution</th>
                              <th className="py-2.5 px-2 w-8 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {variants.map((v, idx) => (
                              <tr key={v.id || idx} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>

                                {/* Attributes Inputs or Label */}
                                <td className="py-2 px-3">
                                  {selectedVariationNames.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {selectedVariationNames.map((attrName) => {
                                        const matchingVarDef = availableVariations.find((av) => av.name === attrName);
                                        const options = matchingVarDef?.values || [];

                                        return (
                                          <div key={attrName} className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-slate-400 w-12 truncate" title={attrName}>
                                              {attrName}:
                                            </span>
                                            {options.length > 0 ? (
                                              <input
                                                list={`options-${attrName}`}
                                                placeholder={attrName}
                                                value={v.attributes[attrName] || ""}
                                                onChange={(e) =>
                                                  handleUpdateVariantAttribute(idx, attrName, e.target.value)
                                                }
                                                className="h-6 px-1.5 rounded-[4px] border border-slate-200 bg-white text-xs text-slate-800 w-32 focus:outline-none focus:border-[#5e2b9d]"
                                              />
                                            ) : (
                                              <input
                                                type="text"
                                                placeholder={attrName}
                                                value={v.attributes[attrName] || ""}
                                                onChange={(e) =>
                                                  handleUpdateVariantAttribute(idx, attrName, e.target.value)
                                                }
                                                className="h-6 px-1.5 rounded-[4px] border border-slate-200 bg-white text-xs text-slate-800 w-32 focus:outline-none focus:border-[#5e2b9d]"
                                              />
                                            )}
                                            {options.length > 0 && (
                                              <datalist id={`options-${attrName}`}>
                                                {options.map((opt) => (
                                                  <option key={opt} value={opt} />
                                                ))}
                                              </datalist>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder="e.g. Green - XL"
                                      value={v.name}
                                      onChange={(e) => handleUpdateVariantField(idx, "name", e.target.value)}
                                      className="h-7 px-2 rounded-[4px] border border-slate-200 bg-white text-xs font-semibold text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                    />
                                  )}
                                </td>

                                {/* Shortcode */}
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder="Code"
                                    value={v.shortCode}
                                    onChange={(e) => handleUpdateVariantField(idx, "shortCode", e.target.value)}
                                    className="h-7 px-2 rounded-[4px] border border-slate-200 bg-white text-xs font-mono text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </td>

                                {/* SKU */}
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder="SKU"
                                    value={v.sku}
                                    onChange={(e) => handleUpdateVariantField(idx, "sku", e.target.value)}
                                    className="h-7 px-2 rounded-[4px] border border-slate-200 bg-white text-xs font-mono text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </td>

                                {/* Barcode (Strictly Numeric Only) */}
                                <td className="py-2 px-3">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      placeholder="Numeric barcode"
                                      value={v.barcode}
                                      onChange={(e) => handleUpdateVariantField(idx, "barcode", e.target.value)}
                                      className="h-7 pl-2 pr-6 rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                    />
                                    <button
                                      type="button"
                                      title="Auto-generate numeric barcode"
                                      onClick={() => handleUpdateVariantField(idx, "barcode", generateNumericBarcode())}
                                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#5e2b9d] text-xs cursor-pointer"
                                    >
                                      ↻
                                    </button>
                                  </div>
                                </td>

                                {/* List Price */}
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="MRP"
                                    value={v.listPrice || ""}
                                    onChange={(e) =>
                                      handleUpdateVariantField(
                                        idx,
                                        "listPrice",
                                        e.target.value === "" ? 0 : Number(e.target.value)
                                      )
                                    }
                                    className="h-7 px-2 rounded-[4px] border border-slate-200 bg-white text-xs font-mono text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </td>

                                {/* Sales Price */}
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder="Price"
                                    value={v.salesPrice || ""}
                                    onChange={(e) =>
                                      handleUpdateVariantField(
                                        idx,
                                        "salesPrice",
                                        e.target.value === "" ? 0 : Number(e.target.value)
                                      )
                                    }
                                    className="h-7 px-2 rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-emerald-700 w-full focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </td>

                                {/* GST % */}
                                <td className="py-2 px-3">
                                  <select
                                    value={v.taxRate !== undefined ? v.taxRate : 18}
                                    onChange={(e) =>
                                      handleUpdateVariantField(idx, "taxRate", Number(e.target.value))
                                    }
                                    className="h-7 px-1.5 rounded-[4px] border border-slate-200 bg-white text-xs font-semibold text-slate-800 w-full focus:outline-none focus:border-[#5e2b9d]"
                                  >
                                    <option value={0}>0%</option>
                                    <option value={3}>3%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                </td>

                                {/* Tax Mode (Inclusive / Exclusive) */}
                                <td className="py-2 px-3">
                                  <select
                                    value={v.isTaxInclusive !== false ? "inclusive" : "exclusive"}
                                    onChange={(e) =>
                                      handleUpdateVariantField(idx, "isTaxInclusive", e.target.value === "inclusive")
                                    }
                                    className={`h-7 px-1 rounded-[4px] border text-xs font-semibold w-full focus:outline-none focus:border-[#5e2b9d] ${
                                      v.isTaxInclusive !== false
                                        ? "bg-purple-50/70 border-purple-200 text-[#5e2b9d]"
                                        : "bg-amber-50/70 border-amber-200 text-amber-800"
                                    }`}
                                  >
                                    <option value="inclusive">GST Incl.</option>
                                    <option value="exclusive">GST Excl.</option>
                                  </select>
                                </td>

                                {/* Stock Distribution Button */}
                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    onClick={() => setActiveVariantForStock(v)}
                                    className={`h-7 px-2.5 rounded-[4px] text-xs font-semibold border flex items-center justify-between gap-1.5 w-full cursor-pointer transition-colors ${
                                      v.stock > 0
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span>{v.stock} units</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Edit ⚙</span>
                                  </button>
                                </td>

                                {/* Delete Variant */}
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(idx)}
                                    className="w-6 h-6 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                                    title="Remove variant"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="px-8 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="text-xs text-slate-500 font-medium">
              {hasVariations
                ? `${variants.length} variant combinations defined`
                : `Total available stock: ${simpleTotalStock} units across all stores & warehouses`}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsFormModalOpen(false)}
                className="h-[36px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={submitting}
                className="h-[36px] px-5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>
                  {submitting
                    ? "Saving Product..."
                    : formMode === "edit"
                    ? "Update Product"
                    : "Save Product"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-[10px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Upload Products</h3>
                  <p className="text-xs text-slate-400">
                    Import multiple master products & variations at once via Excel (.xlsx)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {bulkError && (
                <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{bulkError}</span>
                </div>
              )}

              {/* Step 1: Download Sample Excel Template */}
              <div className="p-4 rounded-[8px] bg-purple-50/60 border border-purple-200/80 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#5e2b9d] mb-0.5">
                    Download Master Products Sample Template
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Includes 80 complete dummy master products (Simple & Variations) with default image testing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={download80MasterProductsSampleExcel}
                  className="h-[32px] px-3.5 rounded-[5px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Template</span>
                </button>
              </div>

              {/* Step 2: Choose Excel File */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Choose Excel File (.xlsx, .xls, .csv)
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-[#5e2b9d] rounded-[8px] p-6 text-center transition-colors bg-slate-50/50 flex flex-col items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-600 mx-auto mb-2 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>

                  {bulkFile ? (
                    <div>
                      <div className="text-xs font-bold text-slate-800 mb-1">
                        {bulkFile.name}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold mb-2">
                        ✓ {bulkParsedRows.length} rows loaded and ready to import!
                      </div>
                      <label className="text-[11px] text-[#5e2b9d] hover:underline cursor-pointer font-medium">
                        Change File
                        <input
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          onChange={handleBulkFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <label className="cursor-pointer text-xs font-semibold text-[#5e2b9d] hover:underline block mb-1">
                        Click to select an Excel spreadsheet
                        <input
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          onChange={handleBulkFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Drop file here or browse from computer
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Default Image Rule Notice */}
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Default Image Notice:</strong> Any product row without an Image URL will automatically receive a high-resolution default product image placeholder in your catalog.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {bulkParsedRows.length > 0 && `${bulkParsedRows.length} rows selected`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkUploading}
                  onClick={() => setIsBulkModalOpen(false)}
                  className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkUploading || bulkParsedRows.length === 0}
                  onClick={handleExecuteBulkUpload}
                  className="h-[34px] px-4.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {bulkUploading && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{bulkUploading ? bulkProgress || "Importing..." : "Upload Products"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL: VARIANT STOCK AVAILABILITY PER STORE & WAREHOUSE ── */}
      {activeVariantForStock && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-[10px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Stock for &ldquo;{activeVariantForStock.name}&rdquo;
                </h3>
                <p className="text-[11px] text-slate-400">
                  Assign available stock counts across all stores and warehouses
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVariantForStock(null)}
                className="w-7 h-7 rounded-[4px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <VariantStockEditor
              stores={stores}
              warehouses={warehouses}
              initialStocks={activeVariantForStock.locationStocks}
              onSave={handleSaveVariantStock}
              onCancel={() => setActiveVariantForStock(null)}
            />
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE PRODUCT CONFIRMATION ── */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Delete Product?</h3>
              <p className="text-xs text-slate-500 font-normal">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-800">
                  &ldquo;{deletingProduct.name}&rdquo;
                </span>
                ? This will remove all associated variant data and stocks.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingProduct(null)}
                className="h-8 px-3 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="h-8 px-3.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5"
              >
                {isDeleting && (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}

// Sub-component for editing stock per variant across all stores and warehouses
function VariantStockEditor({
  stores,
  warehouses,
  initialStocks,
  onSave,
  onCancel,
}: {
  stores: StoreItem[];
  warehouses: WarehouseItem[];
  initialStocks?: LocationStock;
  onSave: (stocks: LocationStock) => void;
  onCancel: () => void;
}) {
  const [storeStockMap, setStoreStockMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    (initialStocks?.stores || []).forEach((s) => {
      map[s.storeId] = s.stock;
    });
    return map;
  });

  const [whStockMap, setWhStockMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    (initialStocks?.warehouses || []).forEach((w) => {
      map[w.warehouseId] = w.stock;
    });
    return map;
  });

  const totalCalculatedStock = useMemo(() => {
    const storeSum = Object.values(storeStockMap).reduce((a, b) => a + (Number(b) || 0), 0);
    const whSum = Object.values(whStockMap).reduce((a, b) => a + (Number(b) || 0), 0);
    return storeSum + whSum;
  }, [storeStockMap, whStockMap]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: LocationStock = {
      stores: stores.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        stock: Number(storeStockMap[s.id]) || 0,
      })),
      warehouses: warehouses.map((w) => ({
        warehouseId: w.id,
        warehouseName: w.name,
        stock: Number(whStockMap[w.id]) || 0,
      })),
    };
    onSave(updated);
  };

  return (
    <form onSubmit={handleApply} className="flex flex-col flex-1 overflow-hidden">
      <div className="p-5 overflow-y-auto space-y-4 flex-1">
        {/* Stores Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏬</span>
              <span>Retail Stores ({stores.length})</span>
            </span>
          </div>

          {stores.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No stores created yet.</p>
          ) : (
            <div className="space-y-1.5">
              {stores.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-[5px] bg-slate-50 border border-slate-100"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-800 block truncate">
                      {s.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {s.city || s.location || "Branch"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500 font-medium">Qty:</span>
                    <input
                      type="number"
                      min="0"
                      value={storeStockMap[s.id] ?? 0}
                      onChange={(e) =>
                        setStoreStockMap({
                          ...storeStockMap,
                          [s.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-20 h-7 px-2 text-right rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warehouses Card */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏭</span>
              <span>Central Warehouses ({warehouses.length})</span>
            </span>
          </div>

          {warehouses.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No warehouses created yet.</p>
          ) : (
            <div className="space-y-1.5">
              {warehouses.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-[5px] bg-slate-50 border border-slate-100"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-800 block truncate">
                      {w.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{w.city || "Hub"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500 font-medium">Qty:</span>
                    <input
                      type="number"
                      min="0"
                      value={whStockMap[w.id] ?? 0}
                      onChange={(e) =>
                        setWhStockMap({
                          ...whStockMap,
                          [w.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-20 h-7 px-2 text-right rounded-[4px] border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-700">
          Total Variant Stock:{" "}
          <span className="text-emerald-700 font-mono text-sm">{totalCalculatedStock} units</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 rounded-[4px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-8 px-4 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Apply Stock
          </button>
        </div>
      </div>
    </form>
  );
}
