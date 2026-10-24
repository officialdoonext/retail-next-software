"use client";

import { useState, useEffect, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";

interface Warehouse {
  id: string;
  name: string;
  mobileNumber?: string;
  phone?: string;
  city?: string;
  address?: string;
  status: "Active" | "Inactive";
  storeId?: string;
  businessId?: string;
  createdAt?: string;
}

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination (Strictly 24 items per page)
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Right-Side Offcanvas Drawer State
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // Offcanvas Form Fields (Warehouse name, mobile number, city, address)
  const [formData, setFormData] = useState({
    name: "",
    mobileNumber: "",
    city: "",
    address: "",
    status: "Active" as "Active" | "Inactive",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Modal State
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load warehouses from Supabase API (recent 24 with server-side pagination)
  const loadWarehouses = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) {
        params.set("search", search);
      }

      const res = await fetch(`/api/warehouses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.warehouses)) {
          setWarehouses(data.warehouses);
          if (data.pagination) {
            setTotalCount(data.pagination.totalCount || 0);
            setTotalPages(data.pagination.totalPages || 1);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load warehouses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses(currentPage, debouncedSearch);
  }, [loadWarehouses, currentPage, debouncedSearch]);

  // Close modals on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOffcanvasOpen(false);
        setDeletingWarehouse(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Open offcanvas for adding new warehouse
  const handleOpenAdd = () => {
    setDrawerMode("add");
    setSelectedWarehouseId(null);
    setFormData({
      name: "",
      mobileNumber: "",
      city: "",
      address: "",
      status: "Active",
    });
    setFormError("");
    setIsOffcanvasOpen(true);
  };

  // Open offcanvas for editing an existing warehouse
  const handleOpenEdit = (w: Warehouse) => {
    setDrawerMode("edit");
    setSelectedWarehouseId(w.id);
    setFormData({
      name: w.name,
      mobileNumber: w.mobileNumber || w.phone || "",
      city: w.city || "",
      address: w.address || "",
      status: w.status || "Active",
    });
    setFormError("");
    setIsOffcanvasOpen(true);
  };

  // Save warehouse (POST for add, PUT for edit)
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      setFormError("Warehouse Name is required.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    try {
      const isEdit = drawerMode === "edit" && selectedWarehouseId;
      const url = "/api/warehouses";
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? { id: selectedWarehouseId, ...formData, name: trimmedName }
        : { ...formData, name: trimmedName };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || `Failed to ${isEdit ? "update" : "save"} warehouse.`);
      } else {
        setIsOffcanvasOpen(false);
        setToastMsg(
          isEdit
            ? `Warehouse "${trimmedName}" updated successfully!`
            : `Warehouse "${trimmedName}" added successfully!`
        );
        setTimeout(() => setToastMsg(""), 3500);

        if (!isEdit) {
          setCurrentPage(1);
          loadWarehouses(1, debouncedSearch);
        } else {
          loadWarehouses(currentPage, debouncedSearch);
        }
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete warehouse
  const handleConfirmDelete = async () => {
    if (!deletingWarehouse) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/warehouses?id=${deletingWarehouse.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete warehouse.");
      } else {
        setToastMsg(`Warehouse "${deletingWarehouse.name}" deleted.`);
        setDeletingWarehouse(null);
        setTimeout(() => setToastMsg(""), 3500);
        loadWarehouses(currentPage, debouncedSearch);
      }
    } catch {
      alert("Network error while deleting warehouse.");
    } finally {
      setIsDeleting(false);
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

        {/* Top Header with Add Warehouse Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span>Stock Manager</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Warehouse</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Warehouse Management
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Manage central warehouse depots, regional storage hubs, bin facilities, and distribution points.
            </p>
          </div>

          {/* Add Warehouse Button - Triggers Right Offcanvas */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-[36px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Warehouse</span>
          </button>
        </div>

        {/* Search Bar & Counter Filter Bar */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="relative flex-1 max-w-md">
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
              placeholder="Search by warehouse name, city, mobile, address..."
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

        {/* Warehouses Table */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-[#5e2b9d] rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-400 font-medium">Fetching recent warehouses...</p>
            </div>
          ) : warehouses.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                {debouncedSearch ? "No warehouses found" : "No Warehouses Created Yet"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 font-normal">
                {debouncedSearch
                  ? `No warehouses match the search query "${debouncedSearch}".`
                  : "Click '+ Add Warehouse' to create your first central depot or storage facility."}
              </p>
              {!debouncedSearch && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="h-[32px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add First Warehouse</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="py-3 px-4 w-12 text-center text-slate-400 font-normal">#</th>
                    <th className="py-3 px-4">Warehouse Name</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warehouses.map((w, index) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                    const dateStr = w.createdAt
                      ? new Date(w.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <tr
                        key={w.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0 font-bold text-xs">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800 group-hover:text-[#5e2b9d] transition-colors block">
                                {w.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {w.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {w.mobileNumber || w.phone || <span className="text-slate-300 font-sans italic">Not provided</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {w.city ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {w.city}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={w.address}>
                          {w.address || <span className="text-slate-300 italic">Not provided</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-semibold text-[11px] ${
                              w.status === "Active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                w.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {w.status || "Active"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(w)}
                              className="h-7 px-2.5 rounded-[4px] border border-slate-200 hover:border-[#5e2b9d] hover:bg-purple-50 hover:text-[#5e2b9d] text-slate-600 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                              title="Edit warehouse"
                            >
                              <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingWarehouse(w)}
                              className="h-7 w-7 rounded-[4px] border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete warehouse"
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
                  ({totalCount} warehouses total)
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

      {/* ── RIGHT-SIDE OFFCANVAS DRAWER (Add / Edit Warehouse) ── */}
      {isOffcanvasOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => !formSubmitting && setIsOffcanvasOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Slide-Over Offcanvas Panel */}
            <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
              {/* Offcanvas Header */}
              <div className="px-5 py-4 border-b border-slate-200/90 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {drawerMode === "edit" ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {drawerMode === "edit" ? "Edit Warehouse" : "Add New Warehouse"}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {drawerMode === "edit"
                        ? "Update storage facility details"
                        : "Enter warehouse details and save"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOffcanvasOpen(false)}
                  className="w-7 h-7 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Offcanvas Body: Form */}
              <form
                id="warehouse-form"
                onSubmit={handleSaveWarehouse}
                className="flex-1 overflow-y-auto p-5 space-y-4"
              >
                {formError && (
                  <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Warehouse Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Central Hub Hyderabad, Depot A"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Primary name identifying this central storage depot.
                  </p>
                </div>

                {/* 2. Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                      className="w-full h-[36px] pl-9 pr-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* 3. City */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City
                  </label>
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad, Bangalore, Mumbai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full h-[36px] pl-9 pr-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-colors"
                    />
                  </div>
                </div>

                {/* 4. Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter complete facility address, plot/shed number, landmark, pin code..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-colors resize-none"
                  />
                </div>

                {/* 5. Status Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: "Active" })}
                      className={`h-[34px] rounded-[6px] border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        formData.status === "Active"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Active</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: "Inactive" })}
                      className={`h-[34px] rounded-[6px] border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        formData.status === "Inactive"
                          ? "bg-slate-100 border-slate-300 text-slate-800 shadow-xs"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Inactive</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Offcanvas Footer Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => setIsOffcanvasOpen(false)}
                  className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="warehouse-form"
                  disabled={formSubmitting}
                  className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {formSubmitting && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>
                    {formSubmitting
                      ? "Saving..."
                      : drawerMode === "edit"
                      ? "Update Warehouse"
                      : "Save Warehouse"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      {deletingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Delete Warehouse?</h3>
              <p className="text-xs text-slate-500 font-normal">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-800">
                  &ldquo;{deletingWarehouse.name}&rdquo;
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingWarehouse(null)}
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
