"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface VendorItem {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  gstNumber: string;
  address: string;
  city: string;
  outstandingDue: number;
  status: "Active" | "Inactive";
  createdAt: number;
}

export default function VendorsPage() {
  const toast = useToast();

  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<VendorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    gstNumber: "",
    address: "",
    city: "",
    outstandingDue: 0,
    status: "Active" as "Active" | "Inactive",
  });

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vendors?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.vendors)) {
        setVendors(data.vendors);
      } else {
        toast.error(data.error || "Failed to load vendors.");
      }
    } catch {
      toast.error("Network error while loading vendors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Filter
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const nameMatch = (v.name || "").toLowerCase().includes(q);
        const compMatch = (v.companyName || "").toLowerCase().includes(q);
        const phoneMatch = (v.phone || "").includes(q);
        const gstMatch = (v.gstNumber || "").toLowerCase().includes(q);
        const cityMatch = (v.city || "").toLowerCase().includes(q);
        if (!nameMatch && !compMatch && !phoneMatch && !gstMatch && !cityMatch) return false;
      }
      if (statusFilter !== "all" && v.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [vendors, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / PAGE_SIZE));
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredVendors.slice(start, start + PAGE_SIZE);
  }, [filteredVendors, currentPage]);

  const stats = useMemo(() => {
    const totalCount = vendors.length;
    const activeCount = vendors.filter((v) => v.status === "Active").length;
    const totalDue = vendors.reduce((sum, v) => sum + (Number(v.outstandingDue) || 0), 0);
    return { totalCount, activeCount, totalDue };
  }, [vendors]);

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({
      name: "",
      companyName: "",
      phone: "",
      email: "",
      gstNumber: "",
      address: "",
      city: "",
      outstandingDue: 0,
      status: "Active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: VendorItem) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      companyName: v.companyName,
      phone: v.phone,
      email: v.email,
      gstNumber: v.gstNumber,
      address: v.address,
      city: v.city,
      outstandingDue: v.outstandingDue,
      status: v.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vendor name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const url = "/api/vendors";
      const method = editingVendor ? "PUT" : "POST";
      const payload: any = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        gstNumber: formData.gstNumber.trim().toUpperCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        outstandingDue: Number(formData.outstandingDue) || 0,
        status: formData.status,
      };

      if (editingVendor) payload.id = editingVendor.id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingVendor ? "Vendor updated." : "Vendor registered.");
        setIsModalOpen(false);
        fetchVendors();
      } else {
        toast.error(data.error || "Failed to save vendor.");
      }
    } catch {
      toast.error("Network error while saving vendor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVendor) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/vendors?id=${deletingVendor.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Removed vendor ${deletingVendor.name}.`);
        setVendors((prev) => prev.filter((v) => v.id !== deletingVendor.id));
        setDeletingVendor(null);
      } else {
        toast.error(data.error || "Failed to delete vendor.");
      }
    } catch {
      toast.error("Failed to delete vendor.");
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Suppliers & Vendors</h1>
                <p className="text-xs text-slate-500">
                  Directory of wholesale distributors, brand suppliers, GST tax profiles & balances
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/vendors/orders"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Purchase Orders</span>
            </Link>

            <Link
              href="/vendors/invoices"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Bills & Invoices</span>
            </Link>

            <button
              type="button"
              onClick={fetchVendors}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Vendor</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Vendors
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{stats.totalCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Partners</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Supplier Accounts
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">{stats.activeCount}</span>
              <span className="text-[10px] text-emerald-700 font-medium">Supplying</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Outstanding Due
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">
                ₹{stats.totalDue.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">Payable</span>
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
              placeholder="Search vendor name, company, GST or city..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "active", "inactive"].map((st) => (
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

        {/* Vendors Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Vendor / Firm</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">GST Number</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading vendors...</span>
                    </td>
                  </tr>
                ) : paginatedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No vendors found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add Vendor&quot; to register wholesale suppliers.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{v.name}</div>
                        {v.companyName && (
                          <div className="text-[10.5px] text-slate-500">{v.companyName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {v.phone ? `📱 ${v.phone}` : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {v.gstNumber || "Unregistered"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {v.city || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {v.outstandingDue > 0 ? (
                          <span className="text-rose-600">₹{v.outstandingDue.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-emerald-600">₹0 (Clear)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            v.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/vendors/due?vendorId=${v.id}`}
                            className="px-2 py-1 text-[10.5px] font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Pay Due
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingVendor(v)}
                            className="px-2 py-1 text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredVendors.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredVendors.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="vendors"
              />
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">
                  {editingVendor ? "Edit Vendor Profile" : "Register New Supplier / Vendor"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Person Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Anand Sharma"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Firm / Business Name
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Apex Textiles Ltd"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10-digit phone"
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vendor@company.com"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GSTIN Number
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="15-digit GSTIN"
                      className="w-full h-9 px-3 font-mono uppercase rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Surat, Mumbai"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Address / Godown Location
                  </label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Factory / Office street address"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Opening Outstanding Due (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.outstandingDue}
                      onChange={(e) => setFormData({ ...formData, outstandingDue: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
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
                    <span>{editingVendor ? "Update Vendor" : "Save Vendor"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingVendor && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">Delete Vendor?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <b className="text-slate-700">{deletingVendor.name}</b>?
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingVendor(null)}
                  className="h-8 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs"
                >
                  {isSubmitting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
