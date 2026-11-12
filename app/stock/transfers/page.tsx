"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface TransferItem {
  id: string;
  transferNumber: string;
  fromType: "Store" | "Warehouse";
  fromId: string;
  fromName: string;
  toType: "Store" | "Warehouse";
  toId: string;
  toName: string;
  items: Array<{
    name?: string;
    productName?: string;
    quantity: number;
  }>;
  totalQty: number;
  status: "Pending" | "In-Transit" | "Received" | "Cancelled";
  notes?: string;
  transferredBy: string;
  createdAt: number;
}

export default function StockTransfersPage() {
  const toast = useToast();

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Metadata for stores & warehouses
  const [stores, setStores] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Pagination (Strictly latest 24)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fromName: "",
    fromType: "Warehouse" as "Store" | "Warehouse",
    toName: "",
    toType: "Store" as "Store" | "Warehouse",
    transferredBy: "Inventory Manager",
    notes: "",
    items: [{ productName: "", quantity: 1 }],
  });

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stock/transfers?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.transfers)) {
        setTransfers(data.transfers);
      } else {
        toast.error(data.error || "Failed to load stock transfers.");
      }
    } catch {
      toast.error("Network error while loading transfers.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const [sRes, wRes] = await Promise.all([
        fetch("/api/stores"),
        fetch("/api/warehouses"),
      ]);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.success && Array.isArray(sData.stores)) setStores(sData.stores);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        if (wData.success && Array.isArray(wData.warehouses)) setWarehouses(wData.warehouses);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
    loadLocations();
  }, [fetchTransfers, loadLocations]);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const numMatch = (t.transferNumber || "").toLowerCase().includes(q);
        const fromMatch = (t.fromName || "").toLowerCase().includes(q);
        const toMatch = (t.toName || "").toLowerCase().includes(q);
        if (!numMatch && !fromMatch && !toMatch) return false;
      }
      if (statusFilter !== "all" && t.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [transfers, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / PAGE_SIZE));
  const paginatedTransfers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransfers.slice(start, start + PAGE_SIZE);
  }, [filteredTransfers, currentPage]);

  // Update Status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/stock/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransfers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus as any } : t))
        );
        toast.success(`Transfer status updated to ${newStatus}.`);
      } else {
        toast.error(data.error || "Failed to update status.");
      }
    } catch {
      toast.error("Network error while updating status.");
    }
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productName: "", quantity: 1 }],
    }));
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, items: updated };
    });
  };

  // Submit Transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fromName.trim() || !formData.toName.trim()) {
      toast.error("Please specify both origin and destination.");
      return;
    }
    if (formData.fromName === formData.toName) {
      toast.error("Origin and destination cannot be identical.");
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].productName.trim()) {
      toast.error("At least one product item is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/stock/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromType: formData.fromType,
          fromName: formData.fromName,
          toType: formData.toType,
          toName: formData.toName,
          items: formData.items,
          notes: formData.notes,
          transferredBy: formData.transferredBy,
          status: "Pending",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Created stock transfer ${data.transfer?.transferNumber || ""}`);
        setIsCreateModalOpen(false);
        fetchTransfers();
      } else {
        toast.error(data.error || "Failed to create transfer.");
      }
    } catch {
      toast.error("Network error while creating transfer.");
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
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Stock Transfers</h1>
                <p className="text-xs text-slate-500">
                  Inter-store & central warehouse stock movement manifest, dispatches & inward receipts
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/stock"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Current Stock</span>
            </Link>

            <button
              type="button"
              onClick={fetchTransfers}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const defaultFrom = warehouses[0]?.name || stores[0]?.name || "Central Warehouse";
                const defaultTo = stores[0]?.name || "Store 1";
                setFormData({
                  fromName: defaultFrom,
                  fromType: "Warehouse",
                  toName: defaultTo,
                  toType: "Store",
                  transferredBy: "Inventory Manager",
                  notes: "",
                  items: [{ productName: "", quantity: 1 }],
                });
                setIsCreateModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Stock Transfer</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Transfers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{transfers.length}</span>
              <span className="text-[10px] text-slate-400 font-medium">Manifests</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Dispatches
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">
                {transfers.filter((t) => t.status === "Pending").length}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">Awaiting Dispatch</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              In-Transit Stock
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-sky-600 font-mono">
                {transfers.filter((t) => t.status === "In-Transit").length}
              </span>
              <span className="text-[10px] text-sky-700 font-medium">On the road</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Successfully Received
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                {transfers.filter((t) => t.status === "Received").length}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Completed</span>
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
              placeholder="Search transfer #, source or destination..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "pending", "in-transit", "received"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-[#5e2b9d] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Origin Source</th>
                  <th className="py-3 px-4">Destination Target</th>
                  <th className="py-3 px-4 text-center">Total Units</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading stock transfers...</span>
                    </td>
                  </tr>
                ) : paginatedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No stock transfers found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;New Stock Transfer&quot; to move goods between locations.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedTransfers.map((t) => {
                    const formattedDate = new Date(t.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                          {t.transferNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{t.fromName}</span>
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">[{t.fromType}]</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{t.toName}</span>
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">[{t.toType}]</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {t.totalQty} pcs
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              t.status === "Received"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : t.status === "In-Transit"
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : t.status === "Cancelled"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {t.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(t.id, "In-Transit")}
                                className="px-2 py-1 text-[10.5px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg cursor-pointer transition-colors"
                              >
                                Dispatch
                              </button>
                            )}
                            {t.status === "In-Transit" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(t.id, "Received")}
                                className="px-2 py-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors"
                              >
                                Mark Inward
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedTransfer(t)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              Manifest
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredTransfers.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredTransfers.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="transfers"
              />
            </div>
          )}
        </div>

        {/* Create Transfer Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">New Stock Transfer</h3>
                  <p className="text-[11px] text-purple-200">Dispatch products between warehouse and retail stores</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTransfer} className="p-5 space-y-4 text-xs">
                {/* From / To Locations */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      From (Origin Location) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Central Warehouse"
                      value={formData.fromName}
                      onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      To (Destination Target) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Main Outlet Store"
                      value={formData.toName}
                      onChange={(e) => setFormData({ ...formData, toName: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Items to transfer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Stock Items to Transfer</label>
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
                          placeholder="Product Name / SKU / Barcode"
                          value={it.productName}
                          onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                          className="flex-1 h-8 px-2.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#5e2b9d]"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            required
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                            className="w-20 h-8 px-2 text-center rounded border border-slate-200 text-xs font-mono"
                          />
                        </div>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transfer Notes / Manifest Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Inward restock batch #54 via delivery van"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
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
                    className="h-9 px-5 bg-[#5e2b9d] hover:bg-[#4d2282] text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
                    <span>Create Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Manifest Modal */}
        {selectedTransfer && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Stock Manifest Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedTransfer(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Manifest #:</span>
                    <span className="font-mono font-bold text-[#5e2b9d]">{selectedTransfer.transferNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">From Origin:</span>
                    <span className="font-semibold text-slate-800">{selectedTransfer.fromName} ({selectedTransfer.fromType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">To Destination:</span>
                    <span className="font-semibold text-slate-800">{selectedTransfer.toName} ({selectedTransfer.toType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedTransfer.status}</span>
                  </div>
                  {selectedTransfer.notes && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Notes:</span>
                      <span className="text-slate-700">{selectedTransfer.notes}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Manifest Items:</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {(selectedTransfer.items || []).map((it, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{it.productName || it.name}</span>
                        <span className="font-mono font-bold text-[#5e2b9d]">{it.quantity} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTransfer(null)}
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
