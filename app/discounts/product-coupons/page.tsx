"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import DiscountSubNav from "@/components/DiscountSubNav";
import CouponModal from "@/components/CouponModal";
import { CouponItem, formatDiscountDisplay } from "@/lib/coupons";
import { useToast } from "@/components/ToastProvider";

export default function ProductCouponsPage() {
  const toast = useToast();

  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dealTypeFilter, setDealTypeFilter] = useState("all");

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalRedemptions: 0,
    totalSavingsEstimated: 0,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<CouponItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: "product" });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/coupons?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setCoupons(data.coupons || []);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error(data.error || "Failed to load product coupons.");
      }
    } catch (err) {
      console.error("Error fetching product coupons:", err);
      toast.error("Network error while loading product coupons.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, toast]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied coupon code: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Toggle Active / Inactive
  const handleToggleStatus = async (coupon: CouponItem) => {
    const nextStatus = coupon.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await fetch("/api/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, status: nextStatus } : c))
        );
        toast.success(`Coupon ${coupon.code} is now ${nextStatus}.`);
      } else {
        toast.error(data.error || "Failed to update status.");
      }
    } catch {
      toast.error("Failed to toggle coupon status.");
    }
  };

  // Duplicate / Clone coupon
  const handleDuplicate = async (coupon: CouponItem) => {
    try {
      const clonePayload = {
        ...coupon,
        id: undefined,
        code: `${coupon.code}_COPY`,
        title: `${coupon.title} (Copy)`,
        usedCount: 0,
      };

      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clonePayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Duplicated coupon as ${data.coupon.code}`);
        fetchCoupons();
      } else {
        toast.error(data.error || "Failed to duplicate coupon.");
      }
    } catch {
      toast.error("Failed to duplicate coupon.");
    }
  };

  // Delete coupon
  const handleDelete = async () => {
    if (!deletingCoupon) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/coupons?id=${deletingCoupon.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Deleted coupon ${deletingCoupon.code}`);
        setCoupons((prev) => prev.filter((c) => c.id !== deletingCoupon.id));
        setDeletingCoupon(null);
      } else {
        toast.error(data.error || "Failed to delete coupon.");
      }
    } catch {
      toast.error("Failed to delete coupon.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered by deal type
  const filteredCoupons = useMemo(() => {
    if (dealTypeFilter === "all") return coupons;
    return coupons.filter((c) => c.discountType === dealTypeFilter);
  }, [coupons, dealTypeFilter]);

  const bogoBundleCount = useMemo(() => {
    return coupons.filter((c) => c.discountType === "bogo" || c.discountType === "bundle").length;
  }, [coupons]);

  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-7xl mx-auto pb-12">
        
        {/* Top Header & Sub-Nav */}
        <DiscountSubNav />

        {/* Page Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Product Coupons
                </h1>
                <p className="text-xs text-slate-500">
                  Item-specific discounts, category sales, BOGO (Buy X Get Y) deals & quantity bundle tiers
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchCoupons}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh list"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#5e2b9d]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingCoupon(null);
                setIsModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-gradient-to-r from-[#5e2b9d] to-purple-700 hover:from-purple-700 hover:to-[#5e2b9d] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Product Coupon</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Product Offers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                {stats.total}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Campaigns</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Deals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                {stats.active}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Running</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              BOGO & Bundles
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">
                {bogoBundleCount}
              </span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Multi-Buys</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Items Sold on Promo
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">
                {stats.totalRedemptions.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">Units</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product deal, SKU or category..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {["all", "Active", "Scheduled", "Expired", "Inactive"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-white text-[#5e2b9d] shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Deal Type Filter */}
            <select
              value={dealTypeFilter}
              onChange={(e) => setDealTypeFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">All Offer Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
              <option value="bogo">BOGO (Buy X Get Y)</option>
              <option value="bundle">Quantity Bundle</option>
            </select>
          </div>
        </div>

        {/* Product Coupons List */}
        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading product coupons...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Product Coupons Found</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "No product offers match your filter criteria. Try adjusting your search term."
                : "Create your first product, category, BOGO or quantity bundle deal."}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingCoupon(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-[#5e2b9d] text-white rounded-lg text-xs font-semibold hover:bg-purple-800 cursor-pointer shadow-2xs"
            >
              + Create First Product Coupon
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCoupons.map((coupon) => {
              const isCopied = copiedCode === coupon.code;
              const usagePercent = coupon.totalUsageLimit
                ? Math.min(100, Math.round((coupon.usedCount / coupon.totalUsageLimit) * 100))
                : 0;

              return (
                <div
                  key={coupon.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top: Code, Deal Pill & Status */}
                    <div className="p-3.5 pb-2.5 bg-gradient-to-r from-purple-50/60 to-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="border border-dashed border-[#5e2b9d]/60 rounded-md px-2.5 py-1 bg-white flex items-center gap-1.5 shadow-2xs">
                          <span className="font-mono font-bold text-xs text-[#5e2b9d] tracking-wider">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            title="Copy Code"
                            className="text-slate-400 hover:text-[#5e2b9d] cursor-pointer"
                          >
                            {isCopied ? (
                              <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        <span className="text-[9.5px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          {coupon.discountType}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          coupon.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : coupon.status === "Scheduled"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : coupon.status === "Expired"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {coupon.status}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-3.5 space-y-2.5">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-extrabold text-[#5e2b9d]">
                            {formatDiscountDisplay(coupon)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                          {coupon.title}
                        </h4>
                        {coupon.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {coupon.description}
                          </p>
                        )}
                      </div>

                      {/* Targeting & Conditions */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5 text-[11px]">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                            Targeting:
                          </span>
                          <span className="font-semibold text-slate-800">
                            {coupon.targetType === "categories" && coupon.targetCategoryIds?.length
                              ? `Categories: ${coupon.targetCategoryIds.join(", ")}`
                              : coupon.targetType === "products" && coupon.targetProductIds?.length
                              ? `Items: ${coupon.targetProductIds.join(", ")}`
                              : "All Store Inventory"}
                          </span>
                        </div>

                        {coupon.minOrderValue ? (
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Min Bill:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              ₹{coupon.minOrderValue.toLocaleString("en-IN")}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between text-slate-600">
                          <span>Valid Till:</span>
                          <span className="font-semibold text-slate-800">
                            {coupon.neverExpires ? "Ongoing (Never Expires)" : coupon.endDate}
                          </span>
                        </div>
                      </div>

                      {/* Usage Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>Units Sold on Promo</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {coupon.usedCount} {coupon.totalUsageLimit ? `/ ${coupon.totalUsageLimit} (${usagePercent}%)` : "redeemed"}
                          </span>
                        </div>
                        {coupon.totalUsageLimit ? (
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#5e2b9d] h-full rounded-full transition-all"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="p-2.5 px-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(coupon)}
                      className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                        coupon.status === "Active"
                          ? "text-rose-600 hover:text-rose-800"
                          : "text-emerald-700 hover:text-emerald-900"
                      }`}
                    >
                      {coupon.status === "Active" ? "Pause Offer" : "Activate Offer"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(coupon)}
                        title="Duplicate coupon"
                        className="p-1.5 text-slate-500 hover:text-[#5e2b9d] hover:bg-white rounded transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCoupon(coupon);
                          setIsModalOpen(true);
                        }}
                        title="Edit coupon"
                        className="p-1.5 text-slate-500 hover:text-[#5e2b9d] hover:bg-white rounded transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingCoupon(coupon)}
                        title="Delete coupon"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Coupon Modal */}
      <CouponModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false);
          fetchCoupons();
        }}
        initialCoupon={editingCoupon}
        defaultType="product"
      />

      {/* Delete Confirmation Modal */}
      {deletingCoupon && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Delete Product Deal?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to delete <b className="text-slate-800">{deletingCoupon.code}</b> ({deletingCoupon.title})? This will stop discounting these items.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingCoupon(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

    </SoftwareLayout>
  );
}
