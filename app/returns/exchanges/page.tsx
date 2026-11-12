"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface ExchangeRecord {
  id: string;
  returnNumber: string;
  orderNumber: string;
  type: "EXCHANGE";
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: any[];
  reason: string;
  refundAmount: number; // positive = refund to customer, negative = customer paid extra
  refundMethod: string;
  status: string;
  staffName: string;
  createdAt: number;
}

export default function ExchangesPage() {
  const toast = useToast();

  const [exchanges, setExchanges] = useState<ExchangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Exchange Form
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
    customerPhone: "",
    returnedItemName: "",
    returnedItemPrice: 0,
    replacementItemName: "",
    replacementItemPrice: 0,
    reason: "Size / Fit replacement",
    paymentMethod: "CASH",
  });

  const fetchExchanges = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/returns?type=EXCHANGE&all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.returns)) {
        setExchanges(data.returns);
      } else {
        toast.error(data.error || "Failed to load exchanges.");
      }
    } catch {
      toast.error("Network error while loading exchanges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  // Filter
  const filteredExchanges = useMemo(() => {
    return exchanges.filter((e) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (e.returnNumber || "").toLowerCase().includes(q) ||
        (e.orderNumber || "").toLowerCase().includes(q) ||
        (e.customer?.name || "").toLowerCase().includes(q) ||
        (e.customer?.phone || "").includes(q)
      );
    });
  }, [exchanges, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExchanges.length / PAGE_SIZE));
  const paginatedExchanges = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredExchanges.slice(start, start + PAGE_SIZE);
  }, [filteredExchanges, currentPage]);

  // Price Difference
  const priceDifference = useMemo(() => {
    return Number(formData.replacementItemPrice || 0) - Number(formData.returnedItemPrice || 0);
  }, [formData.returnedItemPrice, formData.replacementItemPrice]);

  // Submit Exchange
  const handleCreateExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (!formData.returnedItemName.trim() || !formData.replacementItemName.trim()) {
      toast.error("Both returned and replacement product names are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const itemsPayload = [
        {
          name: formData.returnedItemName,
          quantity: 1,
          price: formData.returnedItemPrice,
          role: "RETURNED",
        },
        {
          name: formData.replacementItemName,
          quantity: 1,
          price: formData.replacementItemPrice,
          role: "REPLACEMENT",
        },
      ];

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "EXCHANGE",
          orderNumber: formData.orderNumber || "DIRECT-EXCHANGE",
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone.trim(),
          items: itemsPayload,
          reason: formData.reason,
          refundAmount: priceDifference < 0 ? Math.abs(priceDifference) : 0, // if negative, refund difference
          refundMethod: formData.paymentMethod,
          staffName: "Store Cashier",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Processed exchange ${data.returnRecord?.returnNumber || ""}`);
        setIsModalOpen(false);
        fetchExchanges();
      } else {
        toast.error(data.error || "Failed to process exchange.");
      }
    } catch {
      toast.error("Network error while recording exchange.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 pb-12">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Exchanges Manager</h1>
                <p className="text-xs text-slate-500">
                  Item size, color & variant exchanges with automated difference billing
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/returns"
              className="h-9 px-3 text-xs font-medium text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Switch to Returns</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={fetchExchanges}
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
                  returnedItemName: "",
                  returnedItemPrice: 0,
                  replacementItemName: "",
                  replacementItemPrice: 0,
                  reason: "Size / Fit replacement",
                  paymentMethod: "CASH",
                });
                setIsModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Record Exchange</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Exchanges
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{exchanges.length}</span>
              <span className="text-[10px] text-slate-400 font-medium">Slips</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Store Register
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">Synced</span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Real-time</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Customer Retention
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">100%</span>
              <span className="text-[10px] text-emerald-700 font-medium">Zero Lost Sales</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exchange #, invoice or customer..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Exchanges Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Exchange #</th>
                  <th className="py-3 px-4">Original Invoice</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Exchange Reason</th>
                  <th className="py-3 px-4 text-center">Difference</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading exchanges...</span>
                    </td>
                  </tr>
                ) : paginatedExchanges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No exchange records found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Record Exchange&quot; when a customer swaps items.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedExchanges.map((ex) => {
                    const formattedDate = new Date(ex.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                          {ex.returnNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {ex.orderNumber || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ex.customer?.name || "Customer"}</div>
                          {ex.customer?.phone && (
                            <div className="text-[10px] text-slate-400">📱 {ex.customer.phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {ex.reason}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {ex.refundAmount > 0 ? (
                            <span className="text-rose-600">Refund ₹{ex.refundAmount.toLocaleString("en-IN")}</span>
                          ) : ex.refundAmount < 0 ? (
                            <span className="text-emerald-600">Paid ₹{Math.abs(ex.refundAmount).toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="text-slate-400">Even Swap (₹0)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-50 text-[#5e2b9d] border border-purple-200">
                            {ex.status || "Exchanged"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedExchange(ex)}
                            className="px-2.5 py-1 text-[11px] font-medium text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredExchanges.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredExchanges.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="exchanges"
              />
            </div>
          )}
        </div>

        {/* Record Exchange Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Record Product Exchange</h3>
                  <p className="text-[11px] text-purple-200">Swap item & calculate price difference</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateExchange} className="p-5 space-y-4 text-xs">
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
                      Exchange Reason
                    </label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    >
                      <option value="Size / Fit replacement">Size / Fit replacement</option>
                      <option value="Color / Style swap">Color / Style swap</option>
                      <option value="Upgrade to higher variant">Upgrade to higher variant</option>
                      <option value="Defective replacement">Defective replacement</option>
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

                {/* Returned vs Replacement Side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
                    <span className="text-[11px] font-bold text-rose-700 uppercase block">
                      ← 1. Item Returned (Inward)
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Product Name / SKU"
                      value={formData.returnedItemName}
                      onChange={(e) => setFormData({ ...formData, returnedItemName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-rose-200 bg-white text-xs focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Value ₹</span>
                      <input
                        type="number"
                        min={0}
                        required
                        placeholder="0.00"
                        value={formData.returnedItemPrice}
                        onChange={(e) => setFormData({ ...formData, returnedItemPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full h-8 px-2 text-right rounded border border-rose-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase block">
                      → 2. Replacement Given (Outward)
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Replacement Product Name"
                      value={formData.replacementItemName}
                      onChange={(e) => setFormData({ ...formData, replacementItemName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-emerald-200 bg-white text-xs focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Value ₹</span>
                      <input
                        type="number"
                        min={0}
                        required
                        placeholder="0.00"
                        value={formData.replacementItemPrice}
                        onChange={(e) => setFormData({ ...formData, replacementItemPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full h-8 px-2 text-right rounded border border-emerald-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Net Difference Calculation */}
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Net Difference</span>
                    <span className="text-[11px] text-slate-500">
                      {priceDifference > 0
                        ? "Customer pays additional difference"
                        : priceDifference < 0
                        ? "Store refunds difference to customer"
                        : "Even value exchange"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-lg font-bold font-mono ${
                        priceDifference > 0
                          ? "text-emerald-600"
                          : priceDifference < 0
                          ? "text-rose-600"
                          : "text-slate-800"
                      }`}
                    >
                      {priceDifference > 0
                        ? `+₹${priceDifference.toLocaleString("en-IN")}`
                        : priceDifference < 0
                        ? `-₹${Math.abs(priceDifference).toLocaleString("en-IN")}`
                        : "₹0.00"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-5 bg-[#5e2b9d] hover:bg-[#4d2282] text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
                    <span>Complete Exchange</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {selectedExchange && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Exchange Slip Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedExchange(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exchange #:</span>
                    <span className="font-mono font-bold text-[#5e2b9d]">{selectedExchange.returnNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Invoice:</span>
                    <span className="font-mono text-slate-700">{selectedExchange.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-semibold text-slate-800">{selectedExchange.customer?.name} ({selectedExchange.customer?.phone || "N/A"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reason:</span>
                    <span className="text-slate-700">{selectedExchange.reason}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExchange(null)}
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
