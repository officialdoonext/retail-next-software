"use client";

import { useState, useEffect, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";

interface Variation {
  id: string;
  name: string;
  storeId?: string;
  createdBy?: string;
  createdAt?: number;
}

export default function VariationsPage() {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add form state
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  // Edit modal state
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [deletingVariation, setDeletingVariation] = useState<Variation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch variations
  const loadVariations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/variations");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.variations)) {
          setVariations(data.variations);
        }
      }
    } catch (err) {
      console.error("Failed to load variations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVariations();
  }, [loadVariations]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingVariation(null);
        setDeletingVariation(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save new variation
  const handleSaveVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a variation name.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to create variation.");
      } else {
        setVariations((prev) => [data.variation, ...prev]);
        setName("");
        setToastMsg(`Variation "${data.variation.name}" created successfully!`);
        setTimeout(() => setToastMsg(""), 3500);
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (v: Variation) => {
    setEditingVariation(v);
    setEditName(v.name);
  };

  // Update variation
  const handleUpdateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariation || !editName.trim()) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/variations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingVariation.id, name: editName.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update variation.");
      } else {
        setVariations((prev) =>
          prev.map((v) => (v.id === editingVariation.id ? { ...v, name: editName.trim() } : v))
        );
        setToastMsg(`Variation renamed to "${editName.trim()}" successfully.`);
        setEditingVariation(null);
        setTimeout(() => setToastMsg(""), 3500);
      }
    } catch {
      alert("Network error while updating variation.");
    } finally {
      setUpdating(false);
    }
  };

  // Delete variation
  const handleConfirmDelete = async () => {
    if (!deletingVariation) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/variations?id=${deletingVariation.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete variation.");
      } else {
        setVariations((prev) => prev.filter((v) => v.id !== deletingVariation.id));
        setToastMsg(`Variation "${deletingVariation.name}" deleted.`);
        setDeletingVariation(null);
        setTimeout(() => setToastMsg(""), 3500);
      }
    } catch {
      alert("Network error while deleting variation.");
    } finally {
      setDeleting(false);
    }
  };

  // Filter variations by search
  const filteredVariations = variations.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <SoftwareLayout>
      <div className="w-full space-y-3.5 animate-in fade-in duration-150">
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
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span>Product Manager</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Variations</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Product Variations
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Define product attribute variations (Size, Color, Fabric, Storage, etc.) for multi-variant matrix products.
            </p>
          </div>
        </div>

        {/* Top Section: Add Variation Form (User requirement: "in vainat alos ad variant then varint name then save.") */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Add New Variation</h2>
              <p className="text-[11px] text-slate-400 font-normal">
                Enter variation attribute name and save to catalog
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveVariation} className="space-y-3">
            {errorMsg && (
              <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  placeholder="e.g. Size, Color, Fabric, Storage, Weight, Flavor..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className="w-full h-[36px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="h-[36px] px-5 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Variation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: Variations List (User requirement: "below display the list") */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* List Top Bar */}
          <div className="p-3 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search variations by name..."
                className="w-full h-[32px] bg-white border border-slate-200 rounded-[6px] pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium shrink-0">
              Total Variations: <span className="font-semibold text-slate-800">{variations.length}</span>
            </div>
          </div>

          {/* Table / List View */}
          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <svg className="animate-spin h-6 w-6 text-[#5e2b9d] mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-xs text-slate-500 font-medium">Loading variations...</p>
            </div>
          ) : filteredVariations.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-2">
                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-0.5">
                {searchQuery ? "No matching variations" : "No Variations Added Yet"}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs font-normal">
                {searchQuery
                  ? "Try searching with a different term."
                  : "Type a variation name in the form above and click Save Variation."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3.5 w-14">#</th>
                    <th className="py-2.5 px-3.5">Variation Attribute</th>
                    <th className="py-2.5 px-3.5 w-44">Created Date</th>
                    <th className="py-2.5 px-3.5 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredVariations.map((v, index) => {
                    const formattedDate = v.createdAt
                      ? new Date(v.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono text-slate-400 text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-[4px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0">
                              <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                              </svg>
                            </span>
                            <span className="font-semibold text-slate-900">{v.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                          {formattedDate}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(v)}
                              className="h-[26px] px-2 text-[11px] font-medium text-slate-600 hover:text-[#5e2b9d] hover:bg-purple-50 rounded-[4px] border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Edit Variation Name"
                            >
                              <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setDeletingVariation(v)}
                              className="h-[26px] px-2 text-[11px] font-medium text-rose-600 hover:text-white hover:bg-rose-600 rounded-[4px] border border-rose-200 hover:border-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Delete Variation"
                            >
                              <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        </div>
      </div>

      {/* Edit Variation Modal */}
      {editingVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl max-w-sm w-full p-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Variation</h3>
              <button
                type="button"
                onClick={() => setEditingVariation(null)}
                className="w-6 h-6 rounded-[4px] text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateVariation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Variation Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVariation(null)}
                  className="h-[32px] px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="h-[32px] px-3.5 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Update Variation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Variation Modal */}
      {deletingVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl max-w-sm w-full p-4 animate-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Delete Variation</h3>
                <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to delete variation <strong className="text-slate-900">&quot;{deletingVariation.name}&quot;</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingVariation(null)}
                disabled={deleting}
                className="h-[32px] px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="h-[32px] px-3.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-75"
              >
                {deleting ? "Deleting..." : "Delete Variation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}
