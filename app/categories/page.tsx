"use client";

import { useState, useEffect, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";

interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  storeId?: string;
  businessId?: string;
  createdAt?: string | number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination state (Strictly 24 per page)
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Add Category Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit Modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Modal state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch only recent 24 categories with pagination
  const loadCategories = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) {
        params.set("search", search);
      }

      const res = await fetch(`/api/categories?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
          if (data.pagination) {
            setTotalCount(data.pagination.totalCount || 0);
            setTotalPages(data.pagination.totalPages || 1);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories(currentPage, debouncedSearch);
  }, [loadCategories, currentPage, debouncedSearch]);

  // ESC key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAddModalOpen(false);
        setEditingCategory(null);
        setDeletingCategory(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save new category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError("Please enter a category name.");
      return;
    }

    setSaving(true);
    setAddError("");

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAddError(data.error || "Failed to create category.");
      } else {
        setIsAddModalOpen(false);
        setName("");
        setToastMsg(`Category "${data.category.name}" created successfully!`);
        setTimeout(() => setToastMsg(""), 3500);
        // Refresh page 1 to show the latest category
        setCurrentPage(1);
        loadCategories(1, debouncedSearch);
      }
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Update category
  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Please enter a category name.");
      return;
    }

    setUpdating(true);
    setEditError("");

    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCategory.id, name: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(data.error || "Failed to update category.");
      } else {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, name: trimmed } : c))
        );
        setEditingCategory(null);
        setToastMsg(`Category updated to "${trimmed}".`);
        setTimeout(() => setToastMsg(""), 3500);
      }
    } catch {
      setEditError("Network error while updating category.");
    } finally {
      setUpdating(false);
    }
  };

  // Delete category
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/categories?id=${deletingCategory.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete category.");
      } else {
        setToastMsg(`Category "${deletingCategory.name}" deleted.`);
        setDeletingCategory(null);
        setTimeout(() => setToastMsg(""), 3500);
        loadCategories(currentPage, debouncedSearch);
      }
    } catch {
      alert("Network error while deleting category.");
    } finally {
      setDeleting(false);
    }
  };

  // Calculate slice indices for display counter
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

        {/* Top Header with Add Category Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span>Product Manager</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Categories</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Product Categories
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Organize and categorize your products for quick POS billing, catalog filtering, and reports.
            </p>
          </div>

          {/* Add Category Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setName("");
              setAddError("");
              setIsAddModalOpen(true);
            }}
            className="h-[36px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Category</span>
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
              placeholder="Search category name..."
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

        {/* Categories List Section */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-[#5e2b9d] rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-400 font-medium">Fetching recent categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">
                {debouncedSearch ? "No matching categories found" : "No categories created yet"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 font-normal">
                {debouncedSearch
                  ? `No category matching "${debouncedSearch}". Try a different search term.`
                  : "Click the '+ Add Category' button above to create your first product category."}
              </p>
              {!debouncedSearch && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-[34px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add First Category</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Category Name</th>
                    <th className="py-2.5 px-4 w-44">Created Date</th>
                    <th className="py-2.5 px-4 w-32 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {categories.map((cat, idx) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    const createdFormatted = cat.createdAt
                      ? new Date(cat.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-[4px] bg-purple-50 text-[#5e2b9d] font-bold text-xs flex items-center justify-center shrink-0">
                              {cat.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-semibold text-slate-900 group-hover:text-[#5e2b9d] transition-colors">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {createdFormatted}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat);
                                setEditName(cat.name);
                                setEditError("");
                              }}
                              className="h-7 px-2.5 rounded-[4px] border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1 transition-all cursor-pointer"
                              title="Edit Category Name"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCategory(cat)}
                              className="h-7 px-2.5 rounded-[4px] border border-rose-200 hover:border-rose-300 text-rose-600 hover:bg-rose-50 bg-white text-xs font-medium inline-flex items-center gap-1 transition-all cursor-pointer"
                              title="Delete Category"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
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

          {/* Bottom Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50/75 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500">
              <div>
                Showing page <span className="font-semibold text-slate-800">{currentPage}</span> of{" "}
                <span className="font-semibold text-slate-800">{totalPages}</span>
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
                  .filter((p) => {
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2;
                  })
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

      {/* ── MODAL 1: ADD CATEGORY (Opens on clicking "+ Add Category") ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Category</h3>
                  <p className="text-[11px] text-slate-400">Enter category name and save to catalog</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              {addError && (
                <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (addError) setAddError("");
                  }}
                  placeholder="e.g. Shirts, Beverages, Electronics, Groceries"
                  className="w-full h-[38px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-[34px] px-4 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="h-[34px] px-5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Category</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT CATEGORY ── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Edit Category</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="p-5 space-y-4">
              {editError && (
                <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editError) setEditError("");
                  }}
                  className="w-full h-[38px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="h-[34px] px-4 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="h-[34px] px-5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
                >
                  {updating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Update</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: DELETE CONFIRMATION ── */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-[8px] border border-slate-200 shadow-xl p-5 text-center animate-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Delete Category?</h3>
            <p className="text-xs text-slate-500 mb-4 font-normal">
              Are you sure you want to delete category{" "}
              <span className="font-semibold text-slate-800">&quot;{deletingCategory.name}&quot;</span>?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="h-[34px] px-4 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-[34px] px-4 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}
