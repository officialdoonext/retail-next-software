"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import BulkUploadModal from "@/components/BulkUploadModal";

interface ProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
  bufferStock: number;
  barcode: string;
  sku: string;
  isDiscountAvailable?: boolean;
  discountType?: "PERCENTAGE" | "RUPEES";
  discountValue?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  subCategory?: string;
  imageUrl?: string;
  hasVariations: boolean;
  price?: number;
  stock?: number;
  bufferStock?: number;
  barcode?: string;
  sku?: string;
  isDiscountAvailable?: boolean;
  discountType?: "PERCENTAGE" | "RUPEES";
  discountValue?: number;
  variationTypes?: string[];
  variants?: ProductVariant[];
  totalStock?: number;
  minPrice?: number;
  maxPrice?: number;
  createdAt: number;
}

interface Category {
  id: string;
  name: string;
}

interface StoreVariation {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeVariations, setStoreVariations] = useState<StoreVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [modalError, setModalError] = useState("");

  // Product Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [hasVariations, setHasVariations] = useState(false);

  // Simple Product Fields
  const [simplePrice, setSimplePrice] = useState<number | "">("");
  const [simpleStock, setSimpleStock] = useState<number | "">("");
  const [simpleBufferStock, setSimpleBufferStock] = useState<number | "">("");
  const [simpleBarcode, setSimpleBarcode] = useState("");
  const [simpleSku, setSimpleSku] = useState("");

  // Product Discount Fields
  const [isDiscountAvailable, setIsDiscountAvailable] = useState(false);
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "RUPEES">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<number | "">("");

  // Hierarchical Variations Builder Fields
  const [primaryVariation, setPrimaryVariation] = useState("Color");
  const [primaryCustomInput, setPrimaryCustomInput] = useState("");
  const [primaryValues, setPrimaryValues] = useState<string[]>([]);
  const [newPrimaryInput, setNewPrimaryInput] = useState("");

  const [enableSubVariation, setEnableSubVariation] = useState(false);
  const [subVariation, setSubVariation] = useState("Size");
  const [subCustomInput, setSubCustomInput] = useState("");
  const [subValuesByPrimary, setSubValuesByPrimary] = useState<Record<string, string[]>>({});
  const [newSubInputByPrimary, setNewSubInputByPrimary] = useState<Record<string, string>>({});

  const [generatedVariants, setGeneratedVariants] = useState<ProductVariant[]>([]);

  // Bulk Variant Updates
  const [bulkPrice, setBulkPrice] = useState<number | "">("");
  const [bulkStock, setBulkStock] = useState<number | "">("");
  const [bulkBufferStock, setBulkBufferStock] = useState<number | "">("");

  // Computed display names for variations
  const primaryDisplayName = useMemo(() => {
    if (primaryVariation === "__custom__") {
      return primaryCustomInput.trim() || "Variation 1";
    }
    return primaryVariation || "Variation 1";
  }, [primaryVariation, primaryCustomInput]);

  const subDisplayName = useMemo(() => {
    if (subVariation === "__custom__") {
      return subCustomInput.trim() || "Variation 2";
    }
    return subVariation || "Variation 2";
  }, [subVariation, subCustomInput]);

  // Pagination state (24 products per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<{
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }>({ total: 0, totalPages: 1, page: 1, limit: 24 });

  // Generate random 12-digit barcode number
  const generateRandomBarcode = () => {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  };

  // Fetch products with pagination (24 items), search, and category filter
  const loadProducts = async (page = currentPage, queryStr = searchQuery, catFilter = selectedCategoryFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
      });
      if (queryStr.trim()) params.set("search", queryStr.trim());
      if (catFilter && catFilter !== "ALL") params.set("categoryId", catFilter);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
        if (data.pagination) {
          setPaginationInfo(data.pagination);
        }
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial categories and variations
  const loadInitialMeta = async () => {
    try {
      const [catRes, varRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/variations"),
      ]);
      const catData = await catRes.json();
      const varData = await varRes.json();
      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }
      if (varData.success && Array.isArray(varData.variations)) {
        setStoreVariations(varData.variations);
        if (varData.variations.length > 0) {
          setPrimaryVariation(varData.variations[0].name);
          if (varData.variations.length > 1) {
            setSubVariation(varData.variations[1].name);
          }
        }
      }
    } catch (err) {
      console.error("Error loading metadata:", err);
    }
  };

  useEffect(() => {
    loadInitialMeta();
  }, []);

  // Fetch products whenever page, search, or category filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(currentPage, searchQuery, selectedCategoryFilter);
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPage, searchQuery, selectedCategoryFilter]);

  const loadData = () => {
    loadProducts(currentPage, searchQuery, selectedCategoryFilter);
  };

  // Sync generated variants preserving entered price, stock, buffer stock, and barcodes
  const syncVariants = (
    pVals: string[],
    subMap: Record<string, string[]>,
    isSub: boolean,
    pName: string,
    sName: string
  ) => {
    setGeneratedVariants((currentVariants) => {
      const nextVariants: ProductVariant[] = [];

      pVals.forEach((pv) => {
        if (!isSub) {
          const variantName = `${pName}: ${pv}`;
          const existing = currentVariants.find(
            (v) => v.name === variantName || v.attributes[pName] === pv
          );
          nextVariants.push({
            id: existing?.id || `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: variantName,
            attributes: { [pName]: pv },
            price: existing ? existing.price : (Number(bulkPrice) || 0),
            stock: existing ? existing.stock : (Number(bulkStock) || 0),
            bufferStock: existing ? existing.bufferStock : (Number(bulkBufferStock) || 0),
            barcode: existing?.barcode || generateRandomBarcode(),
            sku: existing?.sku || `SKU-${Date.now().toString().slice(-4)}-${nextVariants.length + 1}`,
          });
        } else {
          const subs = subMap[pv] || [];
          if (subs.length === 0) {
            const variantName = `${pv}`;
            const existing = currentVariants.find(
              (v) => v.name === variantName || (v.attributes[pName] === pv && Object.keys(v.attributes).length === 1)
            );
            nextVariants.push({
              id: existing?.id || `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: variantName,
              attributes: { [pName]: pv },
              price: existing ? existing.price : (Number(bulkPrice) || 0),
              stock: existing ? existing.stock : (Number(bulkStock) || 0),
              bufferStock: existing ? existing.bufferStock : (Number(bulkBufferStock) || 0),
              barcode: existing?.barcode || generateRandomBarcode(),
              sku: existing?.sku || `SKU-${Date.now().toString().slice(-4)}-${nextVariants.length + 1}`,
            });
          } else {
            subs.forEach((sv) => {
              const variantName = `${pv} / ${sv}`;
              const existing = currentVariants.find(
                (v) =>
                  v.name === variantName ||
                  (v.attributes[pName] === pv && v.attributes[sName] === sv)
              );
              nextVariants.push({
                id: existing?.id || `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: variantName,
                attributes: { [pName]: pv, [sName]: sv },
                price: existing ? existing.price : (Number(bulkPrice) || 0),
                stock: existing ? existing.stock : (Number(bulkStock) || 0),
                bufferStock: existing ? existing.bufferStock : (Number(bulkBufferStock) || 0),
                barcode: existing?.barcode || generateRandomBarcode(),
                sku: existing?.sku || `SKU-${Date.now().toString().slice(-4)}-${nextVariants.length + 1}`,
              });
            });
          }
        }
      });

      return nextVariants;
    });
  };

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setEditingProductId(null);
    setName("");
    setDescription("");
    setCategoryId(categories[0]?.id || "");
    setImageUrl("");
    setHasVariations(false);
    setSimplePrice("");
    setSimpleStock(0);
    setSimpleBufferStock("");
    setSimpleBarcode(generateRandomBarcode());
    setSimpleSku(`SKU-${Date.now().toString().slice(-6)}`);
    setIsDiscountAvailable(false);
    setDiscountType("PERCENTAGE");
    setDiscountValue("");

    const initialPrimary = storeVariations[0]?.name || "Color";
    const initialSub = storeVariations[1]?.name || "Size";
    setPrimaryVariation(initialPrimary);
    setPrimaryCustomInput("");
    setPrimaryValues([]);
    setNewPrimaryInput("");

    setEnableSubVariation(false);
    setSubVariation(initialSub);
    setSubCustomInput("");
    setSubValuesByPrimary({});
    setNewSubInputByPrimary({});

    setGeneratedVariants([]);
    setModalError("");
    setIsModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name);
    setDescription(product.description || "");
    setCategoryId(product.categoryId || "");
    setImageUrl(product.imageUrl || "");
    setHasVariations(product.hasVariations);
    setIsDiscountAvailable(product.isDiscountAvailable ?? false);
    setDiscountType(product.discountType || "PERCENTAGE");
    setDiscountValue(
      product.discountValue !== undefined && product.discountValue !== null
        ? product.discountValue
        : ""
    );

    if (product.hasVariations && product.variants) {
      setGeneratedVariants(product.variants);

      const types = product.variationTypes || [];
      const pType = types[0] || storeVariations[0]?.name || "Color";
      const sType = types[1] || (types.length > 1 ? types[1] : "");

      setPrimaryVariation(pType);
      setPrimaryCustomInput("");

      // Reconstruct primary and sub values from variants
      const pValsSet = new Set<string>();
      const subMap: Record<string, string[]> = {};

      product.variants.forEach((v) => {
        const pVal = v.attributes[pType] || (v.name.includes(":") ? v.name.split(":")[1]?.trim() : v.name.split("/")[0]?.trim());
        if (pVal) {
          pValsSet.add(pVal);
          if (sType && v.attributes[sType]) {
            if (!subMap[pVal]) subMap[pVal] = [];
            if (!subMap[pVal].includes(v.attributes[sType])) {
              subMap[pVal].push(v.attributes[sType]);
            }
          } else if (v.name.includes("/")) {
            const sVal = v.name.split("/")[1]?.trim();
            if (sVal) {
              if (!subMap[pVal]) subMap[pVal] = [];
              if (!subMap[pVal].includes(sVal)) {
                subMap[pVal].push(sVal);
              }
            }
          }
        }
      });

      const pArr = Array.from(pValsSet);
      setPrimaryValues(pArr);
      setEnableSubVariation(Boolean(sType || Object.keys(subMap).some((k) => subMap[k]?.length > 0)));
      setSubVariation(sType || storeVariations[1]?.name || "Size");
      setSubCustomInput("");
      setSubValuesByPrimary(subMap);
      setNewSubInputByPrimary({});
    } else {
      setSimplePrice(product.price ?? "");
      setSimpleStock(product.stock ?? 0);
      setSimpleBufferStock(product.bufferStock ?? "");
      setSimpleBarcode(product.barcode || generateRandomBarcode());
      setSimpleSku(product.sku || "");
      setGeneratedVariants([]);
    }

    setModalError("");
    setIsModalOpen(true);
  };

  // Image Upload to ImageKit
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setModalError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error || "Failed to upload image to ImageKit.");
      } else {
        setImageUrl(data.url);
      }
    } catch {
      setModalError("Network error uploading image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Primary Variation Handlers
  const handleAddPrimaryValue = () => {
    const val = newPrimaryInput.trim();
    if (!val || primaryValues.includes(val)) return;

    const updated = [...primaryValues, val];
    setPrimaryValues(updated);
    setNewPrimaryInput("");
    syncVariants(updated, subValuesByPrimary, enableSubVariation, primaryDisplayName, subDisplayName);
  };

  const handleRemovePrimaryValue = (valToRemove: string) => {
    const updated = primaryValues.filter((v) => v !== valToRemove);
    const updatedSub = { ...subValuesByPrimary };
    delete updatedSub[valToRemove];

    setPrimaryValues(updated);
    setSubValuesByPrimary(updatedSub);
    syncVariants(updated, updatedSub, enableSubVariation, primaryDisplayName, subDisplayName);
  };

  // Sub Variation Handlers per Primary Value
  const handleAddSubValue = (pv: string) => {
    const inputVal = (newSubInputByPrimary[pv] || "").trim();
    if (!inputVal) return;

    const currentSubs = subValuesByPrimary[pv] || [];
    if (currentSubs.includes(inputVal)) return;

    const updatedSubs = [...currentSubs, inputVal];
    const updatedSubMap = { ...subValuesByPrimary, [pv]: updatedSubs };

    setSubValuesByPrimary(updatedSubMap);
    setNewSubInputByPrimary({ ...newSubInputByPrimary, [pv]: "" });
    syncVariants(primaryValues, updatedSubMap, enableSubVariation, primaryDisplayName, subDisplayName);
  };

  const handleRemoveSubValue = (pv: string, svToRemove: string) => {
    const currentSubs = subValuesByPrimary[pv] || [];
    const updatedSubs = currentSubs.filter((s) => s !== svToRemove);
    const updatedSubMap = { ...subValuesByPrimary, [pv]: updatedSubs };

    setSubValuesByPrimary(updatedSubMap);
    syncVariants(primaryValues, updatedSubMap, enableSubVariation, primaryDisplayName, subDisplayName);
  };

  const handleCopySubValuesToAll = (sourcePv: string) => {
    const sourceSubs = subValuesByPrimary[sourcePv] || [];
    if (sourceSubs.length === 0) return;

    const updatedSubMap = { ...subValuesByPrimary };
    primaryValues.forEach((pv) => {
      updatedSubMap[pv] = [...sourceSubs];
    });

    setSubValuesByPrimary(updatedSubMap);
    syncVariants(primaryValues, updatedSubMap, enableSubVariation, primaryDisplayName, subDisplayName);
  };

  const handleDeleteVariantRow = (variantId: string) => {
    setGeneratedVariants((prev) => prev.filter((v) => v.id !== variantId));
  };

  // Bulk Apply
  const handleApplyBulkPrice = () => {
    if (bulkPrice === "") return;
    setGeneratedVariants((prev) =>
      prev.map((v) => ({ ...v, price: Number(bulkPrice) }))
    );
  };

  const handleApplyBulkStock = () => {
    if (bulkStock === "") return;
    setGeneratedVariants((prev) =>
      prev.map((v) => ({ ...v, stock: Number(bulkStock) }))
    );
  };

  const handleApplyBulkBuffer = () => {
    if (bulkBufferStock === "") return;
    setGeneratedVariants((prev) =>
      prev.map((v) => ({ ...v, bufferStock: Number(bulkBufferStock) }))
    );
  };

  // Update specific variant field
  const handleVariantFieldChange = (
    index: number,
    field: "price" | "stock" | "bufferStock" | "barcode",
    value: any
  ) => {
    const updated = [...generatedVariants];
    if (field === "barcode") {
      updated[index][field] = String(value);
    } else {
      updated[index][field] = Number(value) || 0;
    }
    setGeneratedVariants(updated);
  };

  // Save product (POST or PUT)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError("Product name is required.");
      return;
    }

    if (hasVariations && generatedVariants.length === 0) {
      setModalError("Please add at least one variation value to generate variants.");
      return;
    }

    setSubmitting(true);
    setModalError("");

    const selectedCategory = categories.find((c) => c.id === categoryId);

    const payload: any = {
      name: name.trim(),
      description: description.trim(),
      categoryId: categoryId || "",
      categoryName: selectedCategory ? selectedCategory.name : "Uncategorized",
      imageUrl: imageUrl.trim(),
      hasVariations,
      isDiscountAvailable,
      discountType,
      discountValue: isDiscountAvailable ? (Number(discountValue) || 0) : 0,
    };

    if (hasVariations) {
      payload.variationTypes = enableSubVariation
        ? [primaryDisplayName, subDisplayName]
        : [primaryDisplayName];
      payload.variants = generatedVariants.map((v) => ({
        ...v,
        isDiscountAvailable: v.isDiscountAvailable !== undefined ? v.isDiscountAvailable : isDiscountAvailable,
        discountType: v.discountType || discountType,
        discountValue: v.discountValue !== undefined ? v.discountValue : (isDiscountAvailable ? Number(discountValue) || 0 : 0),
      }));
    } else {
      payload.price = Number(simplePrice) || 0;
      payload.stock = Number(simpleStock) || 0;
      payload.bufferStock = Number(simpleBufferStock) || 0;
      payload.barcode = simpleBarcode.trim() || generateRandomBarcode();
      payload.sku = simpleSku.trim() || `SKU-${Date.now().toString().slice(-6)}`;
    }

    try {
      const url = "/api/products";
      const method = editingProductId ? "PUT" : "POST";
      const body = editingProductId ? { id: editingProductId, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const err = data.error || "Failed to save product.";
        setModalError(err);
        toast.error(err);
      } else {
        setIsModalOpen(false);
        toast.success(editingProductId ? "Product updated successfully!" : "Product created successfully!");
        loadData();
      }
    } catch {
      setModalError("Network error while saving product.");
      toast.error("Network error while saving product.");
    } finally {
      setSubmitting(false);
    }
  };

  // Custom Modal Delete product handler
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeletingProduct(true);

    try {
      const res = await fetch(`/api/products?id=${productToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
        toast.success(`Product "${productToDelete.name}" deleted successfully.`);
        setProductToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete product.");
      }
    } catch {
      toast.error("Network error while deleting product.");
    } finally {
      setDeletingProduct(false);
    }
  };

  // Filter products by search and category
  // Products are already paginated and filtered by the server
  const filteredProducts = products;

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans space-y-3.5">
        {/* Dedicated Page Header with Compact Spacing - matching Categories/Variations */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Products
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {paginationInfo.total} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage store-specific products, multi-level variants, and inventory.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="h-[34px] max-h-[34px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs px-3 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Bulk Upload</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs">
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
              placeholder="Search product by name, barcode, or variant..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
              className="h-[34px] max-h-[34px] w-full sm:w-44 bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Table View */}
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-normal">Loading store products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No products found</h3>
            <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mb-4">
              {searchQuery || selectedCategoryFilter !== "ALL"
                ? "No products match your search or filter criteria."
                : "Your store does not have any products yet. Click below to add your first product."}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="h-[34px] max-h-[34px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 text-emerald-600 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span>Bulk Upload</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                + Add First Product
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Structure</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Total Stock</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const stockNum = p.totalStock ?? p.stock ?? 0;
                  const bufferNum = p.bufferStock ?? 0;
                  const isLowStock = bufferNum > 0 && stockNum <= bufferNum;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Thumbnail */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-8 h-8 rounded-[4px] object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-[4px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-slate-900 block leading-tight">
                              {p.name}
                            </span>
                            {p.hasVariations && p.variants && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {p.variants.length} combinations
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Sub Category */}
                      <td className="py-2.5 px-3 text-slate-600 font-normal">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="bg-slate-100 text-slate-700 text-[10.5px] px-2 py-0.5 rounded-[4px]">
                            {p.categoryName || "Uncategorized"}
                          </span>
                          {p.subCategory && (
                            <span className="text-[9.5px] text-slate-400 font-medium pl-0.5">
                              ↳ {p.subCategory}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Structure Badge */}
                      <td className="py-2.5 px-3">
                        {p.hasVariations ? (
                          <span className="bg-purple-50 text-[#5e2b9d] border border-purple-100 text-[10.5px] font-medium px-1.5 py-0.5 rounded-[4px]">
                            Multi-Variant
                          </span>
                        ) : (
                          <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[10.5px] font-normal px-1.5 py-0.5 rounded-[4px]">
                            Simple
                          </span>
                        )}
                      </td>

                      {/* Price & Discount */}
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div>
                          <span>
                            {p.hasVariations ? (
                              p.minPrice === p.maxPrice ? (
                                `₹${p.minPrice?.toFixed(2)}`
                              ) : (
                                `₹${p.minPrice?.toFixed(2)} - ₹${p.maxPrice?.toFixed(2)}`
                              )
                            ) : (
                              `₹${(p.price || 0).toFixed(2)}`
                            )}
                          </span>
                          {p.isDiscountAvailable && (
                            <span className="block mt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded w-fit">
                              {p.discountType === "RUPEES" ? `₹${p.discountValue} OFF` : `${p.discountValue}% OFF`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock & Buffer Status */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900">
                            {stockNum}
                          </span>
                          {isLowStock && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9.5px] font-medium px-1.5 py-0.2 rounded-[3px]">
                              Low Stock
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {p.hasVariations && p.variants && p.variants.length > 0
                          ? `${p.variants[0].barcode} (+${p.variants.length - 1})`
                          : p.barcode || "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingProduct(p)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="View Product Details"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1 rounded text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Pagination Controls (24 items per page) */}
            {paginationInfo && paginationInfo.totalPages > 1 && (
              <div className="bg-[#f8fafc] border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                {/* Summary */}
                <div className="text-slate-500 font-normal">
                  Showing <span className="font-medium text-slate-800">{(currentPage - 1) * 24 + 1}</span> to{" "}
                  <span className="font-medium text-slate-800">
                    {Math.min(currentPage * 24, paginationInfo.total)}
                  </span>{" "}
                  of <span className="font-medium text-slate-800">{paginationInfo.total}</span> products
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-[32px] max-h-[32px] px-2.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <span>Prev</span>
                  </button>

                  {Array.from({ length: paginationInfo.totalPages }, (_, i) => i + 1).map((pg) => {
                    if (
                      pg === 1 ||
                      pg === paginationInfo.totalPages ||
                      (pg >= currentPage - 1 && pg <= currentPage + 1)
                    ) {
                      const isActive = pg === currentPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setCurrentPage(pg);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`h-[32px] w-[32px] max-h-[32px] rounded-[6px] text-xs font-medium transition-colors cursor-pointer flex items-center justify-center ${
                            isActive
                              ? "bg-[#5e2b9d] text-white shadow-2xs"
                              : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    } else if (
                      (pg === currentPage - 2 && pg > 1) ||
                      (pg === currentPage + 2 && pg < paginationInfo.totalPages)
                    ) {
                      return (
                        <span key={pg} className="px-1 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    disabled={currentPage >= paginationInfo.totalPages || loading}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(paginationInfo.totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-[32px] max-h-[32px] px-2.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>Next</span>
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FULL-SCREEN PRODUCT ADD/EDIT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full h-[95vh] max-w-5xl flex flex-col overflow-hidden">
              {/* Modal Top Header */}
              <div className="h-[52px] bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-slate-900">
                    {editingProductId ? "Edit Product" : "Add New Product"}
                  </h2>
                  <span className="text-[11px] text-slate-400 font-normal">
                    &bull; Store-specific Inventory
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Error Alert */}
              {modalError && (
                <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs font-medium text-rose-700 flex items-center gap-2">
                  <svg className="w-4 h-4 stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              {/* Modal Scrollable Body */}
              <form id="productForm" onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* SECTION 1: General Details & ImageKit Media */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Left 2 Cols: Name, Category, Description */}
                  <div className="md:col-span-2 space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Premium Cotton T-Shirt, Organic Milk, Wireless Headphones"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Category
                        </label>
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value)}
                          className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Product Structure
                        </label>
                        <div className="flex items-center gap-2 h-[34px]">
                          <button
                            type="button"
                            onClick={() => setHasVariations(false)}
                            className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                              !hasVariations
                                ? "bg-[#5e2b9d] text-white border-[#5e2b9d]"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            Simple Product
                          </button>
                          <button
                            type="button"
                            onClick={() => setHasVariations(true)}
                            className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                              hasVariations
                                ? "bg-[#5e2b9d] text-white border-[#5e2b9d]"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            Has Variations
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Detailed product specifications, materials, or instructions..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-[#f8fafc] border border-slate-200 rounded-[6px] p-2.5 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none"
                      />
                    </div>
                  </div>

                  {/* Right 1 Col: ImageKit Upload */}
                  <div className="bg-[#f8fafc] border border-slate-200 rounded-[6px] p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1">
                        Product Image (ImageKit CDN)
                      </span>
                      <p className="text-[11px] text-slate-400 font-normal mb-2.5">
                        Uploaded directly to ImageKit cloud CDN.
                      </p>

                      {imageUrl ? (
                        <div className="relative w-full h-32 rounded-[6px] overflow-hidden border border-slate-200 mb-2 bg-white flex items-center justify-center">
                          <img
                            src={imageUrl}
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setImageUrl("")}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-[4px] p-1 hover:bg-rose-600 transition-colors cursor-pointer"
                            title="Remove Image"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-28 border border-dashed border-slate-300 rounded-[6px] bg-white flex flex-col items-center justify-center p-3 text-center mb-2">
                          <svg className="w-6 h-6 text-slate-400 stroke-[1.5] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[11px] text-slate-400 font-normal">
                            No image selected
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="w-full h-[34px] max-h-[34px] border border-slate-200 bg-white hover:bg-slate-50 rounded-[6px] text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>{uploadingImage ? "Uploading to CDN..." : imageUrl ? "Change Image" : "Upload Image"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Pricing & Inventory / Variations Matrix */}
                {!hasVariations ? (
                  /* Mode A: Simple Product */
                  <div className="bg-[#f8fafc] border border-slate-200 rounded-[6px] p-4">
                    <h3 className="text-xs font-medium text-slate-900 mb-3 pb-2 border-b border-slate-200">
                      Pricing & Barcode Settings
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Price (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required={!hasVariations}
                          placeholder="0.00"
                          value={simplePrice}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => setSimplePrice(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Buffer Stock (Alert Threshold)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 5"
                          value={simpleBufferStock}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => setSimpleBufferStock(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Unique Barcode Number *
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            required={!hasVariations}
                            placeholder="e.g. 890123456789"
                            value={simpleBarcode}
                            onChange={(e) => setSimpleBarcode(e.target.value)}
                            className="flex-1 h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                          />
                          <button
                            type="button"
                            onClick={() => setSimpleBarcode(generateRandomBarcode())}
                            className="h-[34px] max-h-[34px] px-2 bg-white border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-100 text-xs cursor-pointer"
                            title="Generate Unique Barcode"
                          >
                            🎲
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dedicated Discount Settings Section */}
                    <div className="mt-4 pt-3.5 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[6px] border border-slate-200 shadow-2xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-800">
                              Is Discount Available?
                            </span>
                            {isDiscountAvailable && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Enable if this item offers an optional discount that can be toggled during billing in POS.
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsDiscountAvailable(false)}
                            className={`h-[30px] px-3 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer ${
                              !isDiscountAvailable
                                ? "bg-slate-700 text-white border-slate-700 shadow-2xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            No Discount
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsDiscountAvailable(true)}
                            className={`h-[30px] px-3 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer flex items-center gap-1.5 ${
                              isDiscountAvailable
                                ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span>Discount Available</span>
                          </button>
                        </div>
                      </div>

                      {isDiscountAvailable && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3.5 bg-purple-50/40 rounded-[6px] border border-purple-100 animate-in fade-in duration-150">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Discount Type *
                            </label>
                            <div className="flex items-center gap-1.5 h-[34px]">
                              <button
                                type="button"
                                onClick={() => setDiscountType("PERCENTAGE")}
                                className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                                  discountType === "PERCENTAGE"
                                    ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Percentage (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountType("RUPEES")}
                                className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                                  discountType === "RUPEES"
                                    ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Rupees (₹)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Discount Value {discountType === "PERCENTAGE" ? "(%)" : "(₹)"} *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step={discountType === "PERCENTAGE" ? "1" : "0.5"}
                                max={discountType === "PERCENTAGE" ? "100" : undefined}
                                required={isDiscountAvailable}
                                placeholder={discountType === "PERCENTAGE" ? "e.g. 10 (for 10% off)" : "e.g. 50 (for ₹50 off)"}
                                value={discountValue}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setDiscountValue(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 pr-8 text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                {discountType === "PERCENTAGE" ? "%" : "₹"}
                              </span>
                            </div>
                            {Number(discountValue) > 0 && (
                              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                                ✓ In POS billing, cashiers can toggle {discountType === "PERCENTAGE" ? `${discountValue}% OFF` : `₹${discountValue} OFF`} on this item.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Mode B: Hierarchical Product Variations */
                  <div className="space-y-4">
                    {/* Discount Configuration for Variable Product */}
                    <div className="bg-[#f8fafc] border border-slate-200 rounded-[6px] p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[6px] border border-slate-200 shadow-2xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-800">
                              Is Discount Available for this Product?
                            </span>
                            {isDiscountAvailable && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Enable if this item's variants offer an optional discount that can be toggled during billing in POS.
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsDiscountAvailable(false)}
                            className={`h-[30px] px-3 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer ${
                              !isDiscountAvailable
                                ? "bg-slate-700 text-white border-slate-700 shadow-2xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            No Discount
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsDiscountAvailable(true)}
                            className={`h-[30px] px-3 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer flex items-center gap-1.5 ${
                              isDiscountAvailable
                                ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span>Discount Available</span>
                          </button>
                        </div>
                      </div>

                      {isDiscountAvailable && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3.5 bg-purple-50/40 rounded-[6px] border border-purple-100 animate-in fade-in duration-150">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Discount Type *
                            </label>
                            <div className="flex items-center gap-1.5 h-[34px]">
                              <button
                                type="button"
                                onClick={() => setDiscountType("PERCENTAGE")}
                                className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                                  discountType === "PERCENTAGE"
                                    ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Percentage (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountType("RUPEES")}
                                className={`flex-1 h-[34px] text-xs font-medium rounded-[6px] border transition-colors cursor-pointer ${
                                  discountType === "RUPEES"
                                    ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Rupees (₹)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Discount Value {discountType === "PERCENTAGE" ? "(%)" : "(₹)"} *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step={discountType === "PERCENTAGE" ? "1" : "0.5"}
                                max={discountType === "PERCENTAGE" ? "100" : undefined}
                                required={isDiscountAvailable}
                                placeholder={discountType === "PERCENTAGE" ? "e.g. 10 (for 10% off)" : "e.g. 50 (for ₹50 off)"}
                                value={discountValue}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setDiscountValue(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 pr-8 text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                {discountType === "PERCENTAGE" ? "%" : "₹"}
                              </span>
                            </div>
                            {Number(discountValue) > 0 && (
                              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                                ✓ In POS billing, cashiers can toggle {discountType === "PERCENTAGE" ? `${discountValue}% OFF` : `₹${discountValue} OFF`} on this item's variants.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 1: Select First Variation Type & Add Values */}
                    <div className="bg-[#f8fafc] border border-slate-200 rounded-[6px] p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
                        <div>
                          <h3 className="text-xs font-medium text-slate-900">
                            Step 1: Select First Variation Type
                          </h3>
                          <p className="text-[11px] text-slate-500 font-normal">
                            Choose which variation you want to add first (e.g. Color, Size, Flavor).
                          </p>
                        </div>

                        {/* Dropdown to select variation from store's variations */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">First Variation:</span>
                          <select
                            value={primaryVariation}
                            onChange={(e) => {
                              setPrimaryVariation(e.target.value);
                              syncVariants(primaryValues, subValuesByPrimary, enableSubVariation, e.target.value === "__custom__" ? (primaryCustomInput.trim() || "Variation 1") : e.target.value, subDisplayName);
                            }}
                            className="h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] cursor-pointer"
                          >
                            {storeVariations.map((v) => (
                              <option key={v.id} value={v.name}>
                                {v.name}
                              </option>
                            ))}
                            <option value="__custom__">+ Custom Variation...</option>
                          </select>
                          {primaryVariation === "__custom__" && (
                            <input
                              type="text"
                              placeholder="e.g. Material"
                              value={primaryCustomInput}
                              onChange={(e) => setPrimaryCustomInput(e.target.value)}
                              className="h-[34px] max-h-[34px] w-28 bg-white border border-slate-200 rounded-[6px] px-2.5 text-xs font-medium text-slate-800"
                            />
                          )}
                        </div>
                      </div>

                      {/* Values for First Variation */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1.5">
                          Add Values for <strong>{primaryDisplayName}</strong> (e.g. Green, Pink, Blue)
                        </label>
                        <div className="flex items-center gap-2 mb-2.5">
                          <input
                            type="text"
                            value={newPrimaryInput}
                            onChange={(e) => setNewPrimaryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddPrimaryValue();
                              }
                            }}
                            placeholder={`Type ${primaryDisplayName} value and press Enter or Add`}
                            className="flex-1 h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                          />
                          <button
                            type="button"
                            onClick={handleAddPrimaryValue}
                            className="h-[34px] max-h-[34px] px-3.5 bg-[#5e2b9d] text-white hover:bg-[#4e2284] text-xs font-medium rounded-[6px] cursor-pointer transition-colors"
                          >
                            + Add {primaryDisplayName}
                          </button>
                        </div>

                        {/* Chips for First Variation Values */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {primaryValues.length === 0 ? (
                            <span className="text-[11px] text-slate-400 font-normal italic">
                              No {primaryDisplayName.toLowerCase()} values added yet. Add at least one above.
                            </span>
                          ) : (
                            primaryValues.map((pv, idx) => (
                              <span
                                key={idx}
                                className="bg-purple-50 text-[#5e2b9d] border border-purple-200 text-xs font-medium px-2.5 py-1 rounded-[4px] flex items-center gap-1.5"
                              >
                                <span>{pv}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePrimaryValue(pv)}
                                  className="text-purple-400 hover:text-rose-600 cursor-pointer font-bold ml-0.5"
                                  title={`Remove ${pv}`}
                                >
                                  &times;
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Optional Sub-Variation with Independent Branching */}
                    {primaryValues.length > 0 && (
                      <div className="bg-[#f8fafc] border border-slate-200 rounded-[6px] p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="enableSubVar"
                                checked={enableSubVariation}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEnableSubVariation(checked);
                                  syncVariants(primaryValues, subValuesByPrimary, checked, primaryDisplayName, subDisplayName);
                                }}
                                className="w-4 h-4 rounded text-[#5e2b9d] focus:ring-[#5e2b9d] cursor-pointer"
                              />
                              <label htmlFor="enableSubVar" className="text-xs font-medium text-slate-900 cursor-pointer">
                                Step 2: Add Sub-Variation (e.g. Sizes for each {primaryDisplayName})
                              </label>
                            </div>
                            <p className="text-[11px] text-slate-500 font-normal pl-6 mt-0.5">
                              Each {primaryDisplayName.toLowerCase()} can have independent sizes/options (e.g. Green has XL & XXL, Pink has S, M, L, XL).
                            </p>
                          </div>

                          {enableSubVariation && (
                            <div className="flex items-center gap-2 pl-6 sm:pl-0">
                              <span className="text-xs font-medium text-slate-600">Sub-Variation:</span>
                              <select
                                value={subVariation}
                                onChange={(e) => {
                                  setSubVariation(e.target.value);
                                  syncVariants(primaryValues, subValuesByPrimary, enableSubVariation, primaryDisplayName, e.target.value === "__custom__" ? (subCustomInput.trim() || "Variation 2") : e.target.value);
                                }}
                                className="h-[34px] max-h-[34px] bg-white border border-slate-200 rounded-[6px] px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] cursor-pointer"
                              >
                                {storeVariations.map((v) => (
                                  <option key={v.id} value={v.name}>
                                    {v.name}
                                  </option>
                                ))}
                                <option value="__custom__">+ Custom Variation...</option>
                              </select>
                              {subVariation === "__custom__" && (
                                <input
                                  type="text"
                                  placeholder="e.g. Size"
                                  value={subCustomInput}
                                  onChange={(e) => setSubCustomInput(e.target.value)}
                                  className="h-[34px] max-h-[34px] w-28 bg-white border border-slate-200 rounded-[6px] px-2.5 text-xs font-medium text-slate-800"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Individual Branching Cards per Primary Value */}
                        {enableSubVariation && (
                          <div className="space-y-3">
                            {primaryValues.map((pv) => {
                              const currentSubList = subValuesByPrimary[pv] || [];
                              return (
                                <div key={pv} className="bg-white border border-slate-200 rounded-[6px] p-3 shadow-2xs">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#5e2b9d]" />
                                      <span className="text-xs font-medium text-slate-800">
                                        {primaryDisplayName}: <strong className="text-[#5e2b9d]">{pv}</strong>
                                      </span>
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        ({currentSubList.length} {subDisplayName.toLowerCase()}s configured)
                                      </span>
                                    </div>

                                    {/* Input to add sub-value specifically for this parent value */}
                                    <div className="flex items-center gap-1.5 flex-1 max-w-md">
                                      <input
                                        type="text"
                                        value={newSubInputByPrimary[pv] || ""}
                                        onChange={(e) =>
                                          setNewSubInputByPrimary({
                                            ...newSubInputByPrimary,
                                            [pv]: e.target.value,
                                          })
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddSubValue(pv);
                                          }
                                        }}
                                        placeholder={`Add ${subDisplayName} for ${pv} (e.g. ${pv === primaryValues[0] ? "XL, XXL" : "S, M, L"})`}
                                        className="flex-1 h-[32px] max-h-[32px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddSubValue(pv)}
                                        className="h-[32px] max-h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-[6px] cursor-pointer transition-colors"
                                      >
                                        Add
                                      </button>
                                      {currentSubList.length > 0 && primaryValues.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopySubValuesToAll(pv)}
                                          className="h-[32px] max-h-[32px] px-2 bg-purple-50 hover:bg-purple-100 text-[#5e2b9d] text-[10.5px] font-medium rounded-[6px] cursor-pointer whitespace-nowrap"
                                          title={`Apply these ${subDisplayName}s to all other ${primaryDisplayName}s`}
                                        >
                                          Copy to All
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Sub-value chips for this specific primary value */}
                                  <div className="flex flex-wrap items-center gap-1.5 pl-4">
                                    {currentSubList.length === 0 ? (
                                      <span className="text-[11px] text-slate-400 font-normal italic">
                                        No {subDisplayName.toLowerCase()}s added yet for {pv}. (Enter above, e.g. {pv === primaryValues[0] ? "XL, XXL" : "S, M, L"}).
                                      </span>
                                    ) : (
                                      currentSubList.map((sv, sIdx) => (
                                        <span
                                          key={sIdx}
                                          className="bg-purple-50 text-[#5e2b9d] border border-purple-200 text-[11px] font-medium px-2 py-0.5 rounded-[4px] flex items-center gap-1"
                                        >
                                          <span>{sv}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSubValue(pv, sv)}
                                            className="text-purple-400 hover:text-rose-600 cursor-pointer font-bold"
                                            title={`Remove ${sv}`}
                                          >
                                            &times;
                                          </button>
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 3: Combinations Matrix Table */}
                    {generatedVariants.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-[6px] overflow-hidden shadow-2xs">
                        <div className="bg-[#f8fafc] border-b border-slate-200 p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                          <div>
                            <span className="text-xs font-medium text-slate-900 block">
                              Generated Variants ({generatedVariants.length} Combinations)
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-normal">
                              Set individual pricing, stock, buffer stock, and barcodes. Delete any unwanted variant row.
                            </span>
                          </div>

                          {/* Quick Bulk Tools */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                              Bulk Fill:
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="Price"
                                value={bulkPrice}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setBulkPrice(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-16 h-[30px] bg-white border border-slate-200 rounded-[4px] px-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={handleApplyBulkPrice}
                                className="h-[30px] px-2 bg-slate-100 hover:bg-slate-200 rounded-[4px] text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                Set
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="Buffer"
                                value={bulkBufferStock}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setBulkBufferStock(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-16 h-[30px] bg-white border border-slate-200 rounded-[4px] px-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={handleApplyBulkBuffer}
                                className="h-[30px] px-2 bg-slate-100 hover:bg-slate-200 rounded-[4px] text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                Set
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                              <tr>
                                <th className="py-2.5 px-3">Variant</th>
                                <th className="py-2.5 px-3 w-28">Price (₹) *</th>
                                <th className="py-2.5 px-3 w-28">Buffer Stock</th>
                                <th className="py-2.5 px-3 w-44">Unique Barcode *</th>
                                <th className="py-2.5 px-2 w-10 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {generatedVariants.map((variant, vIdx) => (
                                <tr key={variant.id} className="hover:bg-slate-50/70">
                                  <td className="py-2 px-3 font-medium text-slate-900">
                                    <span className="bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded-[4px] border border-purple-100 inline-block text-[11px]">
                                      {variant.name}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="number"
                                      step="0.01"
                                      required
                                      value={variant.price || ""}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => handleVariantFieldChange(vIdx, "price", e.target.value)}
                                      placeholder="0.00"
                                      className="w-full h-[32px] bg-[#f8fafc] border border-slate-200 rounded-[4px] px-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="number"
                                      value={variant.bufferStock || ""}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => handleVariantFieldChange(vIdx, "bufferStock", e.target.value)}
                                      placeholder="0"
                                      className="w-full h-[32px] bg-[#f8fafc] border border-slate-200 rounded-[4px] px-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        required
                                        value={variant.barcode}
                                        onChange={(e) => handleVariantFieldChange(vIdx, "barcode", e.target.value)}
                                        placeholder="Barcode"
                                        className="flex-1 h-[32px] bg-[#f8fafc] border border-slate-200 rounded-[4px] px-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleVariantFieldChange(vIdx, "barcode", generateRandomBarcode())}
                                        className="h-[32px] px-1.5 bg-slate-100 rounded-[4px] text-slate-600 hover:bg-slate-200 cursor-pointer"
                                        title="Regenerate Barcode"
                                      >
                                        🎲
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVariantRow(variant.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="Delete this variant row"
                                    >
                                      <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>

              {/* Modal Fixed Footer */}
              <div className="h-[52px] bg-[#f8fafc] border-t border-slate-200 px-5 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="productForm"
                  disabled={submitting || uploadingImage}
                  className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProductId ? "Update Product" : "Save Product"}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT DETAILS VIEW MODAL */}
        {viewingProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full h-[90vh] max-w-4xl flex flex-col overflow-hidden">
              {/* Modal Top Header */}
              <div className="h-[52px] bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-slate-900">
                    Product Details
                  </h2>
                  <span className="text-[11px] text-slate-400 font-normal">
                    &bull; {viewingProduct.categoryName || "Uncategorized"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Product Overview Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-[#f8fafc] border border-slate-200 rounded-[6px] p-4">
                  {/* Image Column */}
                  <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-[6px] p-2 h-44">
                    {viewingProduct.imageUrl ? (
                      <img
                        src={viewingProduct.imageUrl}
                        alt={viewingProduct.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-10 h-10 stroke-[1.2] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] font-normal">No image uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Details Column */}
                  <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-medium text-slate-900 leading-snug">
                          {viewingProduct.name}
                        </h3>
                        {viewingProduct.hasVariations ? (
                          <span className="bg-purple-50 text-[#5e2b9d] border border-purple-100 text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] whitespace-nowrap">
                            Multi-Variant
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-[10.5px] font-normal px-2 py-0.5 rounded-[4px] whitespace-nowrap">
                            Simple Product
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-normal leading-relaxed">
                        {viewingProduct.description || "No description provided."}
                      </p>

                      {viewingProduct.subCategory && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[11px] text-slate-400 font-normal">Subcategory:</span>
                          <span className="bg-slate-100 text-slate-700 text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                            {viewingProduct.subCategory}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200">
                      <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">
                          Price & Discount
                        </span>
                        <span className="text-xs font-medium text-slate-900 block truncate">
                          {viewingProduct.hasVariations
                            ? viewingProduct.minPrice === viewingProduct.maxPrice
                              ? `₹${viewingProduct.minPrice?.toFixed(2)}`
                              : `₹${viewingProduct.minPrice?.toFixed(2)} - ₹${viewingProduct.maxPrice?.toFixed(2)}`
                            : `₹${(viewingProduct.price || 0).toFixed(2)}`}
                        </span>
                        {viewingProduct.isDiscountAvailable ? (
                          <span className="inline-block mt-0.5 text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            {viewingProduct.discountType === "RUPEES" ? `₹${viewingProduct.discountValue} OFF` : `${viewingProduct.discountValue}% OFF`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">No Discount</span>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">
                          Total Stock
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-900">
                            {viewingProduct.totalStock ?? viewingProduct.stock ?? 0}
                          </span>
                          {(viewingProduct.bufferStock ?? 0) > 0 &&
                            (viewingProduct.totalStock ?? viewingProduct.stock ?? 0) <= (viewingProduct.bufferStock ?? 0) && (
                              <span className="bg-amber-50 text-amber-700 text-[9px] px-1 py-0.2 rounded border border-amber-200">
                                Low
                              </span>
                            )}
                        </div>
                      </div>

                      {!viewingProduct.hasVariations ? (
                        <>
                          <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                            <span className="text-[10px] font-medium text-slate-400 block uppercase">
                              Buffer Stock
                            </span>
                            <span className="text-xs font-medium text-slate-900">
                              {viewingProduct.bufferStock ?? 0}
                            </span>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                            <span className="text-[10px] font-medium text-slate-400 block uppercase">
                              Barcode
                            </span>
                            <span className="text-xs font-mono text-slate-800 truncate block">
                              {viewingProduct.barcode || "—"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                            <span className="text-[10px] font-medium text-slate-400 block uppercase">
                              Variants
                            </span>
                            <span className="text-xs font-medium text-[#5e2b9d]">
                              {viewingProduct.variants?.length || 0} items
                            </span>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-[4px] p-2">
                            <span className="text-[10px] font-medium text-slate-400 block uppercase">
                              Dimensions
                            </span>
                            <span className="text-xs font-medium text-slate-700 truncate block">
                              {viewingProduct.variationTypes?.join(", ") || "—"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* If Multi-Variant Product: Complete Variants Breakdown Table */}
                {viewingProduct.hasVariations && viewingProduct.variants && viewingProduct.variants.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-[6px] overflow-hidden shadow-2xs">
                    <div className="bg-[#f8fafc] border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900">
                        Configured Variant Combinations ({viewingProduct.variants.length})
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Individual pricing, stock count & barcodes
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                          <tr>
                            <th className="py-2.5 px-3.5">Variant Combination</th>
                            <th className="py-2.5 px-3">Price</th>
                            <th className="py-2.5 px-3">Stock Count</th>
                            <th className="py-2.5 px-3">Buffer Stock</th>
                            <th className="py-2.5 px-3">Barcode</th>
                            <th className="py-2.5 px-3">SKU</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingProduct.variants.map((v) => {
                            const isVLow = v.bufferStock > 0 && v.stock <= v.bufferStock;
                            return (
                              <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3.5 font-medium text-slate-900">
                                  <span className="bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded-[4px] border border-purple-100 inline-block text-[11px]">
                                    {v.name}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  ₹{Number(v.price).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-slate-900">{v.stock}</span>
                                    {isVLow && (
                                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-medium px-1.5 py-0.2 rounded">
                                        Low
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-normal">
                                  {v.bufferStock || 0}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                  {v.barcode}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                  {v.sku || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Fixed Footer */}
              <div className="h-[52px] bg-[#f8fafc] border-t border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] text-slate-400 font-normal">
                  ID: {viewingProduct.id}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prod = viewingProduct;
                      setViewingProduct(null);
                      handleOpenEditModal(prod);
                    }}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingProduct(null)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL FOR DELETION */}
        <ConfirmModal
          isOpen={productToDelete !== null}
          title="Delete Product"
          message={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone and will permanently remove this item from your store's inventory.`}
          confirmText="Delete Product"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={deletingProduct}
          onConfirm={handleConfirmDelete}
          onClose={() => setProductToDelete(null)}
        />

        {/* BULK UPLOAD MODAL */}
        <BulkUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={loadData}
        />
      </div>
    </SoftwareLayout>
  );
}
