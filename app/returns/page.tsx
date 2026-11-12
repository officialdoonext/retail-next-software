"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface ReturnItem {
  id: string;
  returnNumber: string;
  orderNumber: string;
  type: "RETURN" | "EXCHANGE";
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: Array<{
    name: string;
    productName?: string;
    quantity: number;
    price: number;
    reason?: string;
  }>;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: string;
  staffName: string;
  createdAt: number;
}

export default function ReturnsPage() {
  const toast = useToast();

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // Pagination (Strictly latest 24)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Return Form State
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
    customerPhone: "",
    reason: "Customer preference",
    refundMethod: "CASH",
    items: [{ productName: "", quantity: 1, price: 0, reason: "Defective / Damaged" }],
  });

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/returns?type=RETURN&all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.returns)) {
        setReturns(data.returns);
      } else {
        toast.error(data.error || "Failed to load returns.");
      }
    } catch {
      toast.error("Network error while loading returns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const numMatch = (r.returnNumber || "").toLowerCase().includes(q);
        const orderMatch = (r.orderNumber || "").toLowerCase().includes(q);
        const nameMatch = (r.customer?.name || "").toLowerCase().includes(q);
        const phoneMatch = (r.customer?.phone || "").includes(q);
        if (!numMatch && !orderMatch && !nameMatch && !phoneMatch) return false;
      }
      if (methodFilter !== "all" && r.refundMethod?.toUpperCase() !== methodFilter) return false;
      return true;
    });
  }, [returns, searchQuery, methodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredReturns.slice(start, start + PAGE_SIZE);
  }, [filteredReturns, currentPage]);

  // Calculate total stats
  const stats = useMemo(() => {
    const totalCount = filteredReturns.length;
    const totalRefund = filteredReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const totalItems = filteredReturns.reduce((sum, r) => {
      const itCount = (r.items || []).reduce((s, it) => s + (Number(it.quantity) || 1), 0);
      return sum + itCount;
    }, 0);
    return { totalCount, totalRefund, totalItems };
  }, [filteredReturns]);

  // Add Item Row in Modal
  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productName: "", quantity: 1, price: 0, reason: "Customer request" }],
    }));
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const calculatedRefund = useMemo(() => {
    return formData.items.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
  }, [formData.items]);

  // Submit Return
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].productName.trim()) {
      toast.error("At least one product item with name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RETURN",
          orderNumber: formData.orderNumber || "DIRECT-RETURN",
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone.trim(),
          items: formData.items,
          reason: formData.reason,
          refundAmount: calculatedRefund,
          refundMethod: formData.refundMethod,
          staffName: "Store Cashier",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Processed return ${data.returnRecord?.returnNumber || ""}`);
        setIsCreateModalOpen(false);
        fetchReturns();
      } else {
        toast.error(data.error || "Failed to process return.");
      }
    } catch {
      toast.error("Network error while recording return.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3M3 10l3 3m-3-3l3-3" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Returns Manager</h1>
                <p className="text-xs text-slate-500">
                  Process customer item returns, issue refunds or credit notes & reverse inventories
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/returns/exchanges"
              className="h-9 px-3 text-xs font-medium text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Switch to Exchanges</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={fetchReturns}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormData({
                  orderNumber: "",
                  customerName: "",
                  customerPhone: "",
                  reason: "Customer preference",
                  refundMethod: "CASH",
                  items: [{ productName: "", quantity: 1, price: 0, reason: "Defective / Damaged" }],
                });
                setIsCreateModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Record Return</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Returns Processed
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{stats.totalCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Slips</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Refund Disbursed
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">
                ₹{stats.totalRefund.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">Refunded</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Returned Item Units
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">{stats.totalItems}</span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Restocked</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Return #, Invoice # or customer..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "CASH", "UPI", "CREDIT_NOTE"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                  methodFilter === m
                    ? "bg-white text-[#5e2b9d] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m === "CREDIT_NOTE" ? "Credit Note" : m}
              </button>
            ))}
          </div>
        </div>

        {/* Returns Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Original Invoice</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Returned</th>
                  <th className="py-3 px-4">Tender</th>
                  <th className="py-3 px-4 text-right">Refund Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading returns...</span>
                    </td>
                  </tr>
                ) : paginatedReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No returns found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Record Return&quot; to issue a refund or credit note.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedReturns.map((r) => {
                    const formattedDate = new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const totalQty = (r.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-600">
                          {r.returnNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {r.orderNumber || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{r.customer?.name || "Customer"}</div>
                          {r.customer?.phone && (
                            <div className="text-[10px] text-slate-400">📱 {r.customer.phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700">{totalQty} items</span>
                          <span className="text-[10.5px] text-slate-400 block truncate max-w-[150px]">
                            {r.reason}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                            {r.refundMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          ₹{(r.refundAmount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.status || "Completed"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReturn(r)}
                            className="px-2.5 py-1 text-[11px] font-medium text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Slip
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredReturns.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredReturns.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="returns"
              />
            </div>
          )}
        </div>

        {/* Record Return Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Record Customer Return</h3>
                  <p className="text-[11px] text-purple-200">Issue item refund & restock inventory</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateReturn} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Original Bill / Invoice #
                    </label>
                    <input
                      type="text"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder="e.g. INV-202611-1234"
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Return Reason
                    </label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    >
                      <option value="Customer preference">Customer preference</option>
                      <option value="Defective / Damaged">Defective / Damaged item</option>
                      <option value="Size mismatch">Size / Fit mismatch</option>
                      <option value="Expired product">Expired product</option>
                      <option value="Incorrect item billed">Incorrect item billed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Customer Name"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Mobile
                    </label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/\D/g, "") })}
                      placeholder="10-digit mobile"
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Returned Items Rows */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Returned Item(s)</label>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-[11px] font-semibold text-[#5e2b9d] hover:underline cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 p-2.5 rounded-lg bg-slate-50/50">
                    {formData.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-md border border-slate-200">
                        <input
                          type="text"
                          required
                          placeholder="Product Name / SKU"
                          value={it.productName}
                          onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                          className="flex-1 h-8 px-2.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#5e2b9d]"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                          className="w-16 h-8 px-2 text-center rounded border border-slate-200 text-xs font-mono"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Refund ₹"
                          value={it.price}
                          onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 px-2 text-right rounded border border-slate-200 text-xs font-mono"
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund Payment Method & Summary */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <div>
                    <label className="block text-xs font-semibold text-[#5e2b9d] mb-1">
                      Refund Mode
                    </label>
                    <select
                      value={formData.refundMethod}
                      onChange={(e) => setFormData({ ...formData, refundMethod: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border border-purple-200 bg-white text-xs font-medium focus:outline-none"
                    >
                      <option value="CASH">Cash Refund</option>
                      <option value="UPI">UPI Transfer</option>
                      <option value="CREDIT_NOTE">Store Credit Note</option>
                      <option value="CARD">Card Reversal</option>
                    </select>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 block">Total Refund:</span>
                    <span className="text-xl font-bold font-mono text-rose-600">
                      ₹{calculatedRefund.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
                    <span>Disburse Refund</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Return Slip Modal */}
        {selectedReturn && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Return Slip Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Return Slip #:</span>
                    <span className="font-mono font-bold text-rose-600">{selectedReturn.returnNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Original Invoice:</span>
                    <span className="font-mono text-slate-700">{selectedReturn.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-semibold text-slate-800">{selectedReturn.customer?.name} ({selectedReturn.customer?.phone || "N/A"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Refund Tender:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedReturn.refundMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reason:</span>
                    <span className="text-slate-700">{selectedReturn.reason}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Returned Items:</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {(selectedReturn.items || []).map((it, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold text-slate-800">{it.productName || it.name}</div>
                          <div className="text-[10.5px] text-slate-400">Qty: {it.quantity}</div>
                        </div>
                        <div className="font-mono font-bold text-rose-600">
                          ₹{(Number(it.price) * (Number(it.quantity) || 1)).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="font-bold text-rose-800">Total Refund Disbursed:</span>
                  <span className="font-mono font-bold text-lg text-rose-600">
                    ₹{(selectedReturn.refundAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReturn(null)}
                    className="h-8 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
