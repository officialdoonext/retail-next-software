"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface VendorOrder {
  id: string;
  vendorId?: string;
  vendorName: string;
  poNumber: string;
  items: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    costPrice?: number;
    price?: number;
  }>;
  totalAmount: number;
  expectedDelivery: string;
  status: "Pending" | "Approved" | "Shipped" | "Received" | "Cancelled";
  notes?: string;
  createdAt: number;
}

export default function VendorOrdersPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vendorId: "",
    vendorName: "",
    expectedDelivery: "",
    notes: "",
    items: [{ productName: "", quantity: 10, costPrice: 0 }],
  });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vendors/orders?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        toast.error(data.error || "Failed to load purchase orders.");
      }
    } catch {
      toast.error("Network error while loading purchase orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/vendors?all=true");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.vendors)) {
          setVendors(data.vendors);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    loadVendors();
  }, [fetchOrders, loadVendors]);

  // Filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !o.poNumber.toLowerCase().includes(q) && !o.vendorName.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && o.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const pendingCount = orders.filter((o) => o.status === "Pending").length;
    const receivedCount = orders.filter((o) => o.status === "Received").length;
    const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { totalCount, pendingCount, receivedCount, totalValue };
  }, [orders]);

  // Update Status
  const handleUpdateStatus = async (id: string, nextStatus: string) => {
    try {
      const res = await fetch("/api/vendors/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status: nextStatus as any } : o))
        );
        toast.success(`Purchase Order marked as ${nextStatus}.`);
      } else {
        toast.error(data.error || "Failed to update status.");
      }
    } catch {
      toast.error("Failed to update status.");
    }
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productName: "", quantity: 1, costPrice: 0 }],
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

  const calculatedTotal = useMemo(() => {
    return formData.items.reduce(
      (sum, it) => sum + (Number(it.costPrice) || 0) * (Number(it.quantity) || 1),
      0
    );
  }, [formData.items]);

  // Create PO
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorName.trim()) {
      toast.error("Please select or enter a vendor name.");
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].productName.trim()) {
      toast.error("At least one purchase order item is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/vendors/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: formData.vendorId || null,
          vendorName: formData.vendorName.trim(),
          items: formData.items,
          totalAmount: calculatedTotal,
          expectedDelivery: formData.expectedDelivery || null,
          notes: formData.notes,
          status: "Pending",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Purchase Order created: ${data.order?.poNumber || ""}`);
        setIsModalOpen(false);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to create PO.");
      }
    } catch {
      toast.error("Network error while creating PO.");
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
                <p className="text-xs text-slate-500">
                  Wholesale inventory procurement PO manifests, approvals & inward goods verification
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/vendors"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Vendors List</span>
            </Link>

            <button
              type="button"
              onClick={fetchOrders}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormData({
                  vendorId: vendors[0]?.id || "",
                  vendorName: vendors[0]?.name || "",
                  expectedDelivery: "",
                  notes: "",
                  items: [{ productName: "", quantity: 10, costPrice: 0 }],
                });
                setIsModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>

        {/* 4 Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total POs Issued
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{stats.totalCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Orders</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Fulfillment
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">{stats.pendingCount}</span>
              <span className="text-[10px] text-amber-700 font-medium">In Queue</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Goods Received
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">{stats.receivedCount}</span>
              <span className="text-[10px] text-emerald-700 font-medium">In Stock</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total PO Value
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">
                ₹{stats.totalValue.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Procured</span>
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
              placeholder="Search PO # or vendor name..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "pending", "approved", "received"].map((st) => (
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor Supplier</th>
                  <th className="py-3 px-4">Ordered Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4 text-center">Items Qty</th>
                  <th className="py-3 px-4 text-right">PO Total ₹</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading purchase orders...</span>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No purchase orders found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Create Purchase Order&quot; to issue new supplier POs.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => {
                    const orderDate = new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const totalQty = (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                          {o.poNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900">{o.vendorName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {orderDate}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {o.expectedDelivery || "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {totalQty} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{(o.totalAmount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              o.status === "Received"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : o.status === "Approved"
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : o.status === "Cancelled"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {o.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(o.id, "Approved")}
                                className="px-2 py-1 text-[10.5px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg cursor-pointer transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {o.status === "Approved" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(o.id, "Received")}
                                className="px-2 py-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors"
                              >
                                Receive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(o)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              View PO
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

          {filteredOrders.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="purchase orders"
              />
            </div>
          )}
        </div>

        {/* Create PO Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Create Purchase Order</h3>
                  <p className="text-[11px] text-purple-200">Issue replenishment order to vendor</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePO} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Supplier / Vendor <span className="text-rose-500">*</span>
                    </label>
                    {vendors.length > 0 ? (
                      <select
                        required
                        value={formData.vendorName}
                        onChange={(e) => {
                          const selected = vendors.find((v) => v.name === e.target.value);
                          setFormData({
                            ...formData,
                            vendorName: e.target.value,
                            vendorId: selected?.id || "",
                          });
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                      >
                        <option value="">-- Choose Vendor --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.name}>{v.name} {v.companyName ? `(${v.companyName})` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Vendor Name"
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Expected Delivery Date
                    </label>
                    <input
                      type="date"
                      value={formData.expectedDelivery}
                      onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Items Rows */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Procurement Items</label>
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
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            required
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                            className="w-16 h-8 px-2 text-center rounded border border-slate-200 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400">Cost ₹</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="Cost"
                            value={it.costPrice}
                            onChange={(e) => handleItemChange(idx, "costPrice", parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 px-2 text-right rounded border border-slate-200 text-xs font-mono"
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

                <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <span className="font-semibold text-xs text-[#5e2b9d]">Estimated Order Value:</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    ₹{calculatedTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Remarks / Payment Terms
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. 30 days credit terms, deliver to Main Warehouse"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
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
                    <span>Issue Purchase Order</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View PO Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Purchase Order Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PO Number:</span>
                    <span className="font-mono font-bold text-[#5e2b9d]">{selectedOrder.poNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vendor:</span>
                    <span className="font-semibold text-slate-800">{selectedOrder.vendorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedOrder.status}</span>
                  </div>
                  {selectedOrder.expectedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected:</span>
                      <span className="text-slate-700">{selectedOrder.expectedDelivery}</span>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Notes:</span>
                      <span className="text-slate-700">{selectedOrder.notes}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Ordered Items:</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{it.productName || it.name}</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-700">{it.quantity} pcs</span>
                          {it.costPrice ? (
                            <span className="text-[10.5px] text-slate-400 block font-mono">
                              @ ₹{it.costPrice} = ₹{(it.costPrice * it.quantity).toLocaleString("en-IN")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                  <span className="font-bold text-[#5e2b9d]">Total PO Value:</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    ₹{(selectedOrder.totalAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
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
