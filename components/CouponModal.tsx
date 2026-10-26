"use client";

import React, { useState, useEffect } from "react";
import {
  CouponItem,
  CouponType,
  DiscountType,
  generateRandomCouponCode,
  formatDiscountDisplay,
} from "@/lib/coupons";
import { useToast } from "@/components/ToastProvider";

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (coupon: CouponItem) => void;
  initialCoupon?: CouponItem | null;
  defaultType?: CouponType;
}

export default function CouponModal({
  isOpen,
  onClose,
  onSaved,
  initialCoupon,
  defaultType = "order",
}: CouponModalProps) {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"basics" | "rules" | "limits" | "schedule">("basics");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories & Products state for Product Coupons
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form Fields
  const [type, setType] = useState<CouponType>(defaultType);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<number | string>(20);
  const [maxDiscountCap, setMaxDiscountCap] = useState<number | string>(1000);
  const [minOrderValue, setMinOrderValue] = useState<number | string>(999);

  // Product Coupons Specific
  const [targetType, setTargetType] = useState<"all" | "products" | "categories">("categories");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bogoBuyQty, setBogoBuyQty] = useState<number | string>(2);
  const [bogoGetQty, setBogoGetQty] = useState<number | string>(1);
  const [bogoDiscountPercent, setBogoDiscountPercent] = useState<number | string>(100);
  const [bundleQty, setBundleQty] = useState<number | string>(3);
  const [bundlePrice, setBundlePrice] = useState<number | string>(999);

  // Customer Coupons Specific
  const [customerScope, setCustomerScope] = useState<"all" | "individual" | "group" | "milestone">("group");
  const [targetPhonesInput, setTargetPhonesInput] = useState("");
  const [targetCustomerGroup, setTargetCustomerGroup] = useState("VIP");
  const [milestoneType, setMilestoneType] = useState<"birthday" | "anniversary" | "first_order" | "win_back">("birthday");
  const [isSingleUsePerCustomer, setIsSingleUsePerCustomer] = useState(true);

  // Usage Controls
  const [totalUsageLimit, setTotalUsageLimit] = useState<number | string>(500);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | string>(1);
  const [paymentMode, setPaymentMode] = useState<"All" | "Cash" | "UPI" | "Card">("All");
  const [excludeSaleItems, setExcludeSaleItems] = useState(false);
  const [autoApplyAtCheckout, setAutoApplyAtCheckout] = useState(false);

  // Validity
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [endTime, setEndTime] = useState("23:59");
  const [neverExpires, setNeverExpires] = useState(false);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Load Categories & Products when needed
  useEffect(() => {
    if (isOpen) {
      async function loadOptions() {
        try {
          setLoadingOptions(true);
          const [catRes, prodRes] = await Promise.all([
            fetch("/api/categories?limit=100"),
            fetch("/api/products?limit=100"),
          ]);
          if (catRes.ok) {
            const catData = await catRes.json();
            if (catData.categories) setCategories(catData.categories);
          }
          if (prodRes.ok) {
            const prodData = await prodRes.json();
            if (prodData.products) setProducts(prodData.products);
          }
        } catch (e) {
          console.error("Failed loading options:", e);
        } finally {
          setLoadingOptions(false);
        }
      }
      loadOptions();
    }
  }, [isOpen]);

  // Sync initial values when modal opens or coupon changes
  useEffect(() => {
    if (initialCoupon) {
      setType(initialCoupon.type || defaultType);
      setCode(initialCoupon.code);
      setTitle(initialCoupon.title);
      setDescription(initialCoupon.description || "");
      setDiscountType(initialCoupon.discountType);
      setDiscountValue(initialCoupon.discountValue ?? 20);
      setMaxDiscountCap(initialCoupon.maxDiscountCap ?? "");
      setMinOrderValue(initialCoupon.minOrderValue ?? "");

      setTargetType(initialCoupon.targetType || "categories");
      setSelectedCategoryIds(initialCoupon.targetCategoryIds || []);
      setSelectedProductIds(initialCoupon.targetProductIds || []);
      setBogoBuyQty(initialCoupon.bogoBuyQty ?? 2);
      setBogoGetQty(initialCoupon.bogoGetQty ?? 1);
      setBogoDiscountPercent(initialCoupon.bogoDiscountPercent ?? 100);
      setBundleQty(initialCoupon.bundleQty ?? 3);
      setBundlePrice(initialCoupon.bundlePrice ?? 999);

      setCustomerScope(initialCoupon.customerScope || "group");
      setTargetPhonesInput((initialCoupon.targetCustomerPhones || []).join(", "));
      setTargetCustomerGroup(initialCoupon.targetCustomerGroup || "VIP");
      setMilestoneType(initialCoupon.milestoneType || "birthday");
      setIsSingleUsePerCustomer(initialCoupon.isSingleUsePerCustomer ?? true);

      setTotalUsageLimit(initialCoupon.totalUsageLimit ?? "");
      setPerCustomerLimit(initialCoupon.perCustomerLimit ?? 1);
      setPaymentMode((initialCoupon.allowedPaymentModes?.[0] as any) || "All");
      setExcludeSaleItems(Boolean(initialCoupon.excludeSaleItems));
      setAutoApplyAtCheckout(Boolean(initialCoupon.autoApplyAtCheckout));

      setStartDate(initialCoupon.startDate || new Date().toISOString().split("T")[0]);
      setStartTime(initialCoupon.startTime || "00:00");
      setEndDate(initialCoupon.endDate || "2026-12-31");
      setEndTime(initialCoupon.endTime || "23:59");
      setNeverExpires(Boolean(initialCoupon.neverExpires));
      setStatus(initialCoupon.status === "Inactive" ? "Inactive" : "Active");
    } else {
      // Default reset
      setType(defaultType);
      const prefix = defaultType === "order" ? "ORD" : defaultType === "product" ? "PRD" : "VIP";
      setCode(generateRandomCouponCode(prefix));
      setTitle(
        defaultType === "order"
          ? "Special Order Discount"
          : defaultType === "product"
          ? "Featured Product Deal"
          : "Exclusive Customer Voucher"
      );
      setDescription("");
      setDiscountType(defaultType === "product" ? "percentage" : "percentage");
      setDiscountValue(defaultType === "order" ? 20 : defaultType === "product" ? 25 : 500);
      setMaxDiscountCap(defaultType === "order" ? 1000 : 1500);
      setMinOrderValue(defaultType === "order" ? 1499 : 999);

      setTargetType("categories");
      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
      setBogoBuyQty(2);
      setBogoGetQty(1);
      setBogoDiscountPercent(100);
      setBundleQty(3);
      setBundlePrice(999);

      setCustomerScope("group");
      setTargetPhonesInput("");
      setTargetCustomerGroup("VIP");
      setMilestoneType("birthday");
      setIsSingleUsePerCustomer(true);

      setTotalUsageLimit(500);
      setPerCustomerLimit(1);
      setPaymentMode("All");
      setExcludeSaleItems(false);
      setAutoApplyAtCheckout(false);

      setStartDate(new Date().toISOString().split("T")[0]);
      setStartTime("00:00");
      setEndDate("2026-12-31");
      setEndTime("23:59");
      setNeverExpires(false);
      setStatus("Active");
    }
    setActiveTab("basics");
  }, [initialCoupon, defaultType, isOpen]);

  if (!isOpen) return null;

  const handleGenerateCode = () => {
    const prefix = type === "order" ? "ORD" : type === "product" ? "PRD" : "VIP";
    setCode(generateRandomCouponCode(prefix));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error("Please enter a valid coupon code.");
      setActiveTab("basics");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a campaign title.");
      setActiveTab("basics");
      return;
    }

    try {
      setIsSubmitting(true);

      // Parse phones
      const phones = targetPhonesInput
        .split(",")
        .map((p) => p.trim().replace(/\D/g, ""))
        .filter((p) => p.length >= 10);

      const payload = {
        id: initialCoupon?.id,
        type,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim(),
        discountType,
        discountValue: Number(discountValue) || 0,
        maxDiscountCap: maxDiscountCap ? Number(maxDiscountCap) : null,
        minOrderValue: minOrderValue ? Number(minOrderValue) : 0,

        targetType,
        targetProductIds: selectedProductIds,
        targetCategoryIds: selectedCategoryIds,
        bogoBuyQty: bogoBuyQty ? Number(bogoBuyQty) : null,
        bogoGetQty: bogoGetQty ? Number(bogoGetQty) : null,
        bogoDiscountPercent: bogoDiscountPercent ? Number(bogoDiscountPercent) : null,
        bundleQty: bundleQty ? Number(bundleQty) : null,
        bundlePrice: bundlePrice ? Number(bundlePrice) : null,

        customerScope,
        targetCustomerPhones: phones,
        targetCustomerGroup,
        milestoneType,
        isSingleUsePerCustomer,

        totalUsageLimit: totalUsageLimit ? Number(totalUsageLimit) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : 1,
        allowedPaymentModes: [paymentMode],
        excludeSaleItems,
        autoApplyAtCheckout,

        startDate,
        startTime,
        endDate,
        endTime,
        neverExpires,
        status,
      };

      const url = "/api/coupons";
      const method = initialCoupon ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save coupon campaign.");
      }

      toast.success(
        initialCoupon
          ? `Coupon ${data.coupon.code} updated!`
          : `Coupon ${data.coupon.code} created!`
      );
      onSaved(data.coupon);
      onClose();
    } catch (err: any) {
      console.error("Coupon save error:", err);
      toast.error(err?.message || "Failed to save coupon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {initialCoupon ? `Edit Coupon: ${initialCoupon.code}` : "Create New Coupon Promotion"}
              </h3>
              <p className="text-[11px] text-purple-200">
                E-commerce discount rules, minimum order caps, product targeting & validity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Live Coupon Banner Preview */}
        <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 border-b border-purple-100/80 px-5 py-3 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="border-2 border-dashed border-[#5e2b9d]/40 rounded-lg px-3 py-1.5 bg-white shadow-2xs shrink-0 flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-[#5e2b9d] tracking-wider">
                {code || "CODE"}
              </span>
              <button
                type="button"
                onClick={handleGenerateCode}
                title="Generate new random code"
                className="text-[10px] text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
              >
                ↻
              </button>
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-slate-800 block truncate">
                {title || "Campaign Headline"}
              </span>
              <span className="text-[11px] font-medium text-[#5e2b9d]">
                {discountType === "percentage"
                  ? `${discountValue || 0}% OFF${maxDiscountCap ? ` (Max ₹${maxDiscountCap})` : ""}`
                  : discountType === "flat"
                  ? `FLAT ₹${discountValue || 0} OFF`
                  : discountType === "bogo"
                  ? `BUY ${bogoBuyQty} GET ${bogoGetQty} FREE`
                  : `BUY ${bundleQty} FOR ₹${bundlePrice}`}
                {Number(minOrderValue) > 0 && ` on orders above ₹${minOrderValue}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                status === "Active"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/60 px-5 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("basics")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "basics"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            1. Basic Information
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "rules"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            2. Discount & Targeting Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("limits")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "limits"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            3. Usage Limits & Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "schedule"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            4. Validity & Schedule
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === "basics" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              {/* Promotion Type Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Coupon Manager Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType("order");
                      if (discountType === "bogo" || discountType === "bundle") setDiscountType("percentage");
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      type === "order"
                        ? "border-[#5e2b9d] bg-purple-50/50 shadow-2xs ring-1 ring-[#5e2b9d]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Order Coupon</span>
                    <span className="text-[10px] text-slate-500 block">Cart-wide discount at bill checkout</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("product")}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      type === "product"
                        ? "border-[#5e2b9d] bg-purple-50/50 shadow-2xs ring-1 ring-[#5e2b9d]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Product Coupon</span>
                    <span className="text-[10px] text-slate-500 block">SKU, Category, BOGO & Bundles</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType("customer");
                      if (discountType === "bogo" || discountType === "bundle") setDiscountType("flat");
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      type === "customer"
                        ? "border-[#5e2b9d] bg-purple-50/50 shadow-2xs ring-1 ring-[#5e2b9d]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">Customer Coupon</span>
                    <span className="text-[10px] text-slate-500 block">VIP, Birthday & Phone vouchers</span>
                  </button>
                </div>
              </div>

              {/* Coupon Code & Generate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Coupon Code *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="text-[10.5px] font-semibold text-[#5e2b9d] hover:underline cursor-pointer"
                    >
                      Generate Random Code
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                    placeholder="e.g. FESTIVE20, FLAT500"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Uppercase alphanumeric without spaces.</p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Campaign Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Diwali Mega Cart Discount"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Displayed on POS billing screen and shopper receipt.</p>
                </div>
              </div>

              {/* Description & Terms */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Customer Terms & Promo Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Valid on all prepaid and counter orders. Cannot be combined with other ongoing promotions."
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                />
              </div>

              {/* Status & Auto Apply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={status === "Active"}
                    onChange={(e) => setStatus(e.target.checked ? "Active" : "Inactive")}
                    className="w-4 h-4 text-[#5e2b9d] rounded focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">Campaign Active</span>
                    <span className="text-[10px] text-slate-500">Uncheck to temporarily pause coupon redemption</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApplyAtCheckout}
                    onChange={(e) => setAutoApplyAtCheckout(e.target.checked)}
                    className="w-4 h-4 text-[#5e2b9d] rounded focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">Auto-Apply at Checkout</span>
                    <span className="text-[10px] text-slate-500">Automatically applies when qualifying criteria is met</span>
                  </div>
                </label>
              </div>

            </div>
          )}

          {/* TAB 2: DISCOUNT RULES & TARGETING */}
          {activeTab === "rules" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              {/* Discount Type Radio Toggles */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Discount Incentive Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percentage")}
                    className={`py-2 px-3 rounded-lg border text-center cursor-pointer transition-all ${
                      discountType === "percentage"
                        ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Percentage (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`py-2 px-3 rounded-lg border text-center cursor-pointer transition-all ${
                      discountType === "flat"
                        ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Flat Rupees (₹)
                  </button>

                  {type === "product" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDiscountType("bogo")}
                        className={`py-2 px-3 rounded-lg border text-center cursor-pointer transition-all ${
                          discountType === "bogo"
                            ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        BOGO (Buy X Get Y)
                      </button>

                      <button
                        type="button"
                        onClick={() => setDiscountType("bundle")}
                        className={`py-2 px-3 rounded-lg border text-center cursor-pointer transition-all ${
                          discountType === "bundle"
                            ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Quantity Bundle Tier
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Standard Discount Values (Percentage / Flat) */}
              {(discountType === "percentage" || discountType === "flat") && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      {discountType === "percentage" ? "Discount Rate (%) *" : "Discount Amount (₹) *"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={discountType === "percentage" ? 100 : undefined}
                        required
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-300 font-mono text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d]"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">
                        {discountType === "percentage" ? "%" : "₹"}
                      </span>
                    </div>
                  </div>

                  {discountType === "percentage" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Maximum Discount Cap (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxDiscountCap}
                        onChange={(e) => setMaxDiscountCap(e.target.value)}
                        placeholder="e.g. 1000 (No limit if blank)"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Minimum Order Value (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      placeholder="e.g. 999 (0 for no min)"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-slate-900 text-xs focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>
              )}

              {/* BOGO Rules (If Selected) */}
              {discountType === "bogo" && (
                <div className="bg-purple-50/50 p-3.5 rounded-lg border border-purple-100 space-y-3">
                  <span className="font-bold text-xs text-[#5e2b9d] block">
                    BOGO (Buy X Get Y) Configuration
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Customer Buys (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={bogoBuyQty}
                        onChange={(e) => setBogoBuyQty(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Customer Gets (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={bogoGetQty}
                        onChange={(e) => setBogoGetQty(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Discount on Get Items (%)</label>
                      <select
                        value={bogoDiscountPercent}
                        onChange={(e) => setBogoDiscountPercent(Number(e.target.value))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      >
                        <option value={100}>100% (Completely Free)</option>
                        <option value={50}>50% Off on 2nd Item</option>
                        <option value={25}>25% Off on 2nd Item</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Bundle Tier Configuration */}
              {discountType === "bundle" && (
                <div className="bg-purple-50/50 p-3.5 rounded-lg border border-purple-100 space-y-3">
                  <span className="font-bold text-xs text-[#5e2b9d] block">
                    Quantity Bundle Tier Pricing
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Bundle Quantity (Items)</label>
                      <input
                        type="number"
                        min="2"
                        value={bundleQty}
                        onChange={(e) => setBundleQty(e.target.value)}
                        placeholder="e.g. 3"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Total Bundle Price (₹)</label>
                      <input
                        type="number"
                        min="1"
                        value={bundlePrice}
                        onChange={(e) => setBundlePrice(e.target.value)}
                        placeholder="e.g. 999"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PRODUCT COUPON TARGETING: Categories / Products */}
              {type === "product" && (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Eligible Products / Categories</span>
                    <div className="flex items-center gap-2">
                      {(["categories", "products", "all"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTargetType(t)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize cursor-pointer transition-all ${
                            targetType === t
                              ? "bg-[#5e2b9d] text-white"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {targetType === "categories" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Select Eligible Categories (Click to toggle)
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded border border-slate-200">
                        {categories.length > 0 ? (
                          categories.map((cat) => {
                            const isSelected = selectedCategoryIds.includes(cat.name);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryIds((prev) =>
                                    prev.includes(cat.name)
                                      ? prev.filter((n) => n !== cat.name)
                                      : [...prev, cat.name]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#5e2b9d] text-white shadow-2xs"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {isSelected ? "✓ " : "+ "}
                                {cat.name}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-slate-400">Loading store categories...</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Selected: {selectedCategoryIds.length > 0 ? selectedCategoryIds.join(", ") : "All categories"}
                      </span>
                    </div>
                  )}

                  {targetType === "products" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Select Specific Products
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded border border-slate-200">
                        {products.length > 0 ? (
                          products.slice(0, 30).map((prod) => {
                            const isSelected = selectedProductIds.includes(prod.name);
                            return (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProductIds((prev) =>
                                    prev.includes(prod.name)
                                      ? prev.filter((n) => n !== prod.name)
                                      : [...prev, prod.name]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#5e2b9d] text-white shadow-2xs"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {isSelected ? "✓ " : "+ "}
                                {prod.name}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-slate-400">Loading catalog items...</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOMER COUPON TARGETING: Groups, Milestones, Phones */}
              {type === "customer" && (
                <div className="p-3.5 rounded-lg border border-purple-100 bg-purple-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#5e2b9d]">Customer Segmentation & Eligibility</span>
                    <div className="flex items-center gap-1.5">
                      {(["group", "milestone", "individual", "all"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCustomerScope(s)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize cursor-pointer transition-all ${
                            customerScope === s
                              ? "bg-[#5e2b9d] text-white"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {customerScope === "group" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Customer Group</label>
                      <select
                        value={targetCustomerGroup}
                        onChange={(e) => setTargetCustomerGroup(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        <option value="VIP">VIP Loyalty Club Members</option>
                        <option value="Retail">All Regular Retail Shoppers</option>
                        <option value="Wholesale">Wholesale & Trade Clients</option>
                        <option value="Corporate">Corporate Accounts</option>
                      </select>
                    </div>
                  )}

                  {customerScope === "milestone" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Milestone Event Trigger</label>
                      <select
                        value={milestoneType}
                        onChange={(e) => setMilestoneType(e.target.value as any)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        <option value="birthday">Birthday Month Gift Voucher</option>
                        <option value="anniversary">Wedding Anniversary Celebration</option>
                        <option value="win_back">Win-Back Inactive Shoppers (60+ days)</option>
                        <option value="first_order">New Shopper Registration Bonus</option>
                      </select>
                    </div>
                  )}

                  {customerScope === "individual" && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Specific Customer Phone Number(s) (Comma separated 10-digit mobile)
                      </label>
                      <input
                        type="text"
                        value={targetPhonesInput}
                        onChange={(e) => setTargetPhonesInput(e.target.value)}
                        placeholder="e.g. 9811000001, 9811000002"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSingleUsePerCustomer}
                      onChange={(e) => setIsSingleUsePerCustomer(e.target.checked)}
                      className="w-4 h-4 text-[#5e2b9d] rounded focus:ring-0"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Burn voucher after single redemption (Strictly 1-time personal token)
                    </span>
                  </label>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: USAGE LIMITS & PAYMENT RESTRICTIONS */}
          {activeTab === "limits" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Total Campaign Redemption Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalUsageLimit}
                    onChange={(e) => setTotalUsageLimit(e.target.value)}
                    placeholder="e.g. 500 (Blank for unlimited)"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#5e2b9d]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Cap the total number of times this coupon can be redeemed across all customers.</p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Per Customer Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#5e2b9d]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Number of times a single shopper can use this code.</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Applicable Payment Method Restrictions
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["All", "Cash", "UPI", "Card"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                        paymentMode === m
                          ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] shadow-2xs"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m} Payments
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeSaleItems}
                    onChange={(e) => setExcludeSaleItems(e.target.checked)}
                    className="w-4 h-4 text-[#5e2b9d] rounded focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">Exclude Clearance & Already Discounted Items</span>
                    <span className="text-[10px] text-slate-500">Prevent double discounting on markdown items</span>
                  </div>
                </label>
              </div>

            </div>
          )}

          {/* TAB 4: SCHEDULE & VALIDITY */}
          {activeTab === "schedule" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Start Date & Time *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-2/3 h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-1/3 h-9 px-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    End / Expiry Date & Time *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      disabled={neverExpires}
                      required={!neverExpires}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-2/3 h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono disabled:opacity-40"
                    />
                    <input
                      type="time"
                      disabled={neverExpires}
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-1/3 h-9 px-2 rounded-lg border border-slate-300 text-xs font-mono disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neverExpires}
                    onChange={(e) => setNeverExpires(e.target.checked)}
                    className="w-4 h-4 text-[#5e2b9d] rounded focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">Ongoing Promotion (Never Expires)</span>
                    <span className="text-[10px] text-slate-500">Keep code active indefinitely until manually disabled</span>
                  </div>
                </label>
              </div>

            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              {activeTab !== "basics" && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === "rules") setActiveTab("basics");
                    else if (activeTab === "limits") setActiveTab("rules");
                    else if (activeTab === "schedule") setActiveTab("limits");
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  ← Back
                </button>
              )}
              {activeTab !== "schedule" && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === "basics") setActiveTab("rules");
                    else if (activeTab === "rules") setActiveTab("limits");
                    else if (activeTab === "limits") setActiveTab("schedule");
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#5e2b9d] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Next Step →
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-[#5e2b9d] to-purple-700 hover:from-purple-700 hover:to-[#5e2b9d] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Coupon...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{initialCoupon ? "Update Campaign" : "Save & Launch Coupon"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
