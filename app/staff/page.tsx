"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";

interface StaffItem {
  id: string;
  name: string;
  mobile: string;
  access: string[];
  status: "Active" | "Inactive";
  createdAt: number;
  storeId?: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: "pos", label: "POS Billing", desc: "Access barcode scanner & checkout terminal" },
  { id: "sales", label: "Sales & Invoices", desc: "View customer bills, reprints & history" },
  { id: "products", label: "Product Catalog", desc: "View and edit products & inventory items" },
  { id: "stock", label: "Stock Manager", desc: "Manage store and warehouse stocks" },
  { id: "customers", label: "Customer Directory", desc: "Look up and add store customers" },
  { id: "discounts", label: "Discount Coupons", desc: "Manage promotional coupons & rules" },
  { id: "returns", label: "Returns & Exchanges", desc: "Process refunds & product exchanges" },
  { id: "vendors", label: "Vendor Management", desc: "Purchase orders & supplier dues" },
];

export default function StaffPage() {
  const toast = useToast();

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    mpin: "",
    access: ["pos"] as string[],
    status: "Active" as "Active" | "Inactive",
  });

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/staff?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.staff)) {
        setStaff(data.staff);
      } else {
        toast.error(data.error || "Failed to load staff list.");
      }
    } catch (err: any) {
      toast.error("Network error while loading staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Filter staff
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !s.mobile.includes(q)) return false;
      if (statusFilter !== "all" && s.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [staff, searchQuery, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStaff.slice(start, start + PAGE_SIZE);
  }, [filteredStaff, currentPage]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      mobile: "",
      mpin: "",
      access: ["pos"],
      status: "Active",
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (s: StaffItem) => {
    setEditingStaff(s);
    setFormData({
      name: s.name,
      mobile: s.mobile,
      mpin: "", // Leave blank if keeping existing
      access: s.access || ["pos"],
      status: s.status,
    });
    setIsAddModalOpen(true);
  };

  // Save staff member (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Staff name is required.");
      return;
    }
    if (!formData.mobile || formData.mobile.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!editingStaff && (!formData.mpin || formData.mpin.length < 4)) {
      toast.error("MPIN must be at least 4 numeric digits.");
      return;
    }

    try {
      setIsSubmitting(true);
      const url = "/api/staff";
      const method = editingStaff ? "PUT" : "POST";
      const payload: any = {
        name: formData.name.trim(),
        mobile: formData.mobile.replace(/\D/g, ""),
        access: formData.access,
        status: formData.status,
      };

      if (editingStaff) {
        payload.id = editingStaff.id;
        if (formData.mpin) payload.mpin = formData.mpin;
      } else {
        payload.mpin = formData.mpin;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingStaff ? "Staff updated successfully." : "Staff member registered.");
        setIsAddModalOpen(false);
        fetchStaff();
      } else {
        toast.error(data.error || "Failed to save staff.");
      }
    } catch {
      toast.error("Network error while saving staff.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (s: StaffItem) => {
    const nextStatus = s.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaff((prev) => prev.map((item) => (item.id === s.id ? { ...item, status: nextStatus } : item)));
        toast.success(`${s.name} is now ${nextStatus}.`);
      } else {
        toast.error(data.error || "Failed to toggle status.");
      }
    } catch {
      toast.error("Failed to update status.");
    }
  };

  // Delete staff
  const handleDelete = async () => {
    if (!deletingStaff) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/staff?id=${deletingStaff.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Removed staff member ${deletingStaff.name}.`);
        setStaff((prev) => prev.filter((item) => item.id !== deletingStaff.id));
        setDeletingStaff(null);
      } else {
        toast.error(data.error || "Failed to delete staff.");
      }
    } catch {
      toast.error("Failed to delete staff.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 pb-12">
        {/* Page Top Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Staff Manager</h1>
                <p className="text-xs text-slate-500">
                  Store cashier & operator logins, mobile numeric MPIN setup & granular page permissions
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchStaff}
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
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Staff Registered
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{staff.length}</span>
              <span className="text-[10px] text-slate-400 font-medium">Operators</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Logins
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                {staff.filter((s) => s.status === "Active").length}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Enabled</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              POS Terminal Operators
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">
                {staff.filter((s) => s.access?.includes("pos")).length}
              </span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Cashiers</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or mobile..."
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

        {/* Staff Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Assigned Permissions</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading staff records...</span>
                    </td>
                  </tr>
                ) : paginatedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No staff members found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add Staff Member&quot; to set up cashiers.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {s.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        📱 {s.mobile}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(s.access || []).map((acc) => (
                            <span
                              key={acc}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-[#5e2b9d] border border-purple-200/80 uppercase"
                            >
                              {acc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold cursor-pointer transition-colors ${
                            s.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {s.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStaff(s)}
                            className="px-2.5 py-1 text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
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

          {filteredStaff.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredStaff.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="staff members"
              />
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">
                  {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "") })}
                      placeholder="10-digit mobile"
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Numeric MPIN {editingStaff ? "(Leave blank to keep)" : <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required={!editingStaff}
                      value={formData.mpin}
                      onChange={(e) => setFormData({ ...formData, mpin: e.target.value.replace(/\D/g, "") })}
                      placeholder="4-6 digit MPIN"
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Granular Permissions Checkboxes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Module Access Permissions
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 p-2.5 rounded-lg bg-slate-50/50 max-h-48 overflow-y-auto">
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const isChecked = formData.access.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-start gap-2 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, access: [...formData.access, p.id] });
                              } else {
                                setFormData({ ...formData, access: formData.access.filter((id) => id !== p.id) });
                              }
                            }}
                            className="mt-0.5 rounded text-[#5e2b9d] focus:ring-[#5e2b9d]"
                          />
                          <div>
                            <span className="font-semibold text-slate-800 block text-[11px]">{p.label}</span>
                            <span className="text-[10px] text-slate-400 block">{p.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
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
                    <span>{editingStaff ? "Save Changes" : "Register Staff"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingStaff && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">Delete Staff Member?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <b className="text-slate-700">{deletingStaff.name}</b> ({deletingStaff.mobile})? They will immediately lose login access.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingStaff(null)}
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
