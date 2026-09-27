"use client";

import { useState, useEffect, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";

interface RetailStore {
  id: string;
  code: string;
  name: string;
  mobileNumber?: string;
  phone?: string;
  city?: string;
  fullAddress?: string;
  location?: string;
  gstNumber?: string;
  license?: string;
  status: "Active" | "Inactive";
  expires?: any;
  createdAt?: number;
}

function parseExpiry(expires: any): { isUnexpired: boolean; display: string } {
  if (!expires) return { isUnexpired: false, display: "No expiry set" };
  let time: number | null = null;
  let display = "";

  if (typeof expires === "string" || typeof expires === "number") {
    const t = new Date(expires).getTime();
    if (!isNaN(t)) {
      time = t;
      display =
        typeof expires === "string" && expires.length < 12
          ? expires
          : new Date(t).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
    }
  } else if (typeof expires === "object" && expires !== null) {
    if (typeof expires.toDate === "function") {
      const d = expires.toDate();
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } else if ("seconds" in expires) {
      const d = new Date(expires.seconds * 1000);
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  return {
    isUnexpired: time !== null && time > Date.now(),
    display: display || String(expires),
  };
}

export default function StoresPage() {
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Offcanvas (Drawer) State
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // View Modal State
  const [viewStore, setViewStore] = useState<RetailStore | null>(null);

  // Delete Confirmation Modal State
  const [storeToDelete, setStoreToDelete] = useState<RetailStore | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    mobileNumber: "",
    city: "",
    fullAddress: "",
    gstNumber: "",
    status: "Inactive" as "Active" | "Inactive",
  });

  const handleCopyText = (text: string, key: string) => {
    if (!text || text === "Not Provided" || text === "Not Registered") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch stores
  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stores");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.stores)) {
          setStores(data.stores);
        }
      }
    } catch (err) {
      console.error("Failed to load stores:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOffcanvasOpen) setIsOffcanvasOpen(false);
        if (viewStore) setViewStore(null);
        if (storeToDelete) setStoreToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOffcanvasOpen, viewStore, storeToDelete]);

  // Open drawer for adding a store
  const handleOpenAdd = () => {
    setDrawerMode("add");
    setSelectedStoreId(null);
    setFormData({
      name: "",
      mobileNumber: "",
      city: "",
      fullAddress: "",
      gstNumber: "",
      status: "Inactive",
    });
    setFormError("");
    setIsOffcanvasOpen(true);
  };

  // Open drawer for editing a store
  const handleOpenEdit = (store: RetailStore) => {
    setDrawerMode("edit");
    setSelectedStoreId(store.id);
    setFormData({
      name: store.name || "",
      mobileNumber: store.mobileNumber || store.phone || "",
      city: store.city || "",
      fullAddress: store.fullAddress || store.location || "",
      gstNumber: store.gstNumber || store.license || "",
      status: store.status || "Inactive",
    });
    setFormError("");
    setViewStore(null); // close view modal if open
    setIsOffcanvasOpen(true);
  };

  // Open view modal
  const handleOpenView = (store: RetailStore) => {
    setViewStore(store);
  };

  // Open delete confirm
  const handleOpenDelete = (store: RetailStore) => {
    setStoreToDelete(store);
  };

  // Save or Update store
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Store Name is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const isEdit = drawerMode === "edit" && selectedStoreId;
      const url = isEdit ? `/api/stores/${selectedStoreId}` : "/api/stores";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || `Failed to ${isEdit ? "update" : "create"} store.`);
      } else {
        if (isEdit) {
          setStores((prev) =>
            prev.map((s) => (s.id === selectedStoreId ? { ...s, ...data.store } : s))
          );
          setSuccessToast(`Store "${data.store.name}" updated successfully!`);
        } else {
          setStores((prev) => [data.store, ...prev]);
          setSuccessToast(`Store "${data.store.name}" added successfully!`);
        }
        setIsOffcanvasOpen(false);
        setTimeout(() => setSuccessToast(""), 4000);
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm delete store
  const handleConfirmDelete = async () => {
    if (!storeToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/stores/${storeToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete store.");
      } else {
        setStores((prev) => prev.filter((s) => s.id !== storeToDelete.id));
        setSuccessToast(`Store "${storeToDelete.name}" deleted successfully.`);
        setStoreToDelete(null);
        setTimeout(() => setSuccessToast(""), 4000);
      }
    } catch {
      alert("Network error while deleting store.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered stores
  const filteredStores = stores.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.location?.toLowerCase().includes(q) ||
      s.gstNumber?.toLowerCase().includes(q) ||
      s.license?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.mobileNumber?.includes(q) ||
      s.phone?.includes(q)
    );
  });

  return (
    <SoftwareLayout>
      <div className="w-full space-y-3.5 animate-in fade-in duration-150">
        {/* Toast Notification */}
        {successToast && (
          <div className="p-3 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 stroke-[2.5] text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast("")}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Home</span>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Stores</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Retail Stores
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Manage retail store branches, contact information, and GST registrations.
            </p>
          </div>

          {/* Add Store Action Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-[34px] max-h-[34px] px-3.5 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <svg className="w-4 h-4 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Store</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-[6px] border border-slate-200/80 p-2.5 flex items-center justify-between gap-3 shadow-2xs">
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
              placeholder="Search by store name, city, GST, or phone..."
              className="w-full h-[32px] max-h-[32px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            Total Stores: <span className="font-semibold text-slate-800">{stores.length}</span>
          </div>
        </div>

        {/* Content: Stores Grid or Empty State */}
        {loading ? (
          <div className="w-full bg-white rounded-[6px] border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-2xs">
            <svg className="animate-spin h-6 w-6 text-[#5e2b9d] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium">Loading store branches...</p>
          </div>
        ) : filteredStores.length === 0 ? (
          /* Empty State */
          <div className="w-full bg-white rounded-[6px] border border-dashed border-slate-300 p-10 flex flex-col items-center justify-center text-center shadow-2xs">
            <div className="w-12 h-12 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              {searchQuery ? "No matching stores found" : "No Stores Registered Yet"}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed font-normal">
              {searchQuery
                ? "Try adjusting your search criteria to find registered branches."
                : "Add your first retail store branch by clicking the Add Store button."}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Store</span>
            </button>
          </div>
        ) : (
          /* Stores Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredStores.map((store) => {
              const { isUnexpired, display: formattedExpiry } = parseExpiry(store.expires);
              const isActive = store.status === "Active" && isUnexpired;

              return (
                <div
                  key={store.id}
                  className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all p-3.5 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Store Name & Status Badge */}
                    <div className="flex items-start justify-between gap-2.5 mb-2.5">
                      <div
                        onClick={() => handleOpenView(store)}
                        className="min-w-0 cursor-pointer group"
                        title="Click to view details"
                      >
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                          {store.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-[#5e2b9d] transition-colors">
                          {store.name}
                        </h3>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[4px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[4px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Store Meta Details */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100 font-normal">
                      {/* Mobile Number */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="font-mono text-slate-800 truncate">
                            {store.mobileNumber || store.phone || "Not Provided"}
                          </span>
                        </div>
                        {(store.mobileNumber || store.phone) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(store.mobileNumber || store.phone || "", `card-phone-${store.id}`);
                            }}
                            className="text-[10px] text-slate-400 hover:text-[#5e2b9d] cursor-pointer shrink-0"
                            title="Copy Phone"
                          >
                            {copiedKey === `card-phone-${store.id}` ? "Copied!" : "Copy"}
                          </button>
                        )}
                      </div>

                      {/* City */}
                      {store.city && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="font-medium text-slate-700">{store.city}</span>
                        </div>
                      )}

                      {/* Full Address */}
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-2 leading-relaxed text-slate-600">
                          {store.fullAddress || store.location || "Main Branch"}
                        </span>
                      </div>

                      {/* GST Number */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="font-mono text-[11px] text-slate-700 font-medium truncate">
                            GST: {store.gstNumber || store.license || "Not Registered"}
                          </span>
                        </div>
                        {(store.gstNumber || store.license) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(store.gstNumber || store.license || "", `card-gst-${store.id}`);
                            }}
                            className="text-[10px] text-slate-400 hover:text-[#5e2b9d] cursor-pointer shrink-0"
                            title="Copy GST"
                          >
                            {copiedKey === `card-gst-${store.id}` ? "Copied!" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row: View, Edit, Delete Features for Each Store */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2">
                    {/* View Feature */}
                    <button
                      type="button"
                      onClick={() => handleOpenView(store)}
                      className="h-[30px] px-2 text-[11.5px] font-medium text-slate-700 hover:text-[#5e2b9d] hover:bg-purple-50 rounded-[4px] border border-slate-200 hover:border-purple-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="View store branch details"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[1.8] text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View</span>
                    </button>

                    {/* Edit Feature */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(store)}
                      className="h-[30px] px-2 text-[11.5px] font-medium text-slate-700 hover:text-[#5e2b9d] hover:bg-purple-50 rounded-[4px] border border-slate-200 hover:border-purple-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Edit store branch information"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[1.8] text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>

                    {/* Delete Feature */}
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(store)}
                      className="h-[30px] px-2 text-[11.5px] font-medium text-rose-600 hover:text-white hover:bg-rose-600 rounded-[4px] border border-rose-200 hover:border-rose-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Delete store branch"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT-SIDE OFF-CANVAS DRAWER FOR ADD / EDIT STORE */}
      {isOffcanvasOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setIsOffcanvasOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Slide-Over Offcanvas Panel */}
            <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
              {/* Offcanvas Header */}
              <div className="px-5 py-3.5 border-b border-slate-200/90 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {drawerMode === "edit" ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {drawerMode === "edit" ? "Edit Store" : "Add New Store"}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {drawerMode === "edit"
                        ? "Update details for this store branch"
                        : "Enter details to register a retail branch"}
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
              <form id="store-form" onSubmit={handleSaveStore} className="flex-1 overflow-y-auto p-5 space-y-3.5">
                {formError && (
                  <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Store Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RetailNext Flagship Store"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>

                {/* 2. Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={formData.mobileNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all font-mono"
                    />
                  </div>
                </div>

                {/* 3. City */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hyderabad"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>

                {/* 4. Full Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Full Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Plot No 42, Jubilee Hills, Road No 36, Hyderabad, 500033"
                    value={formData.fullAddress}
                    onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-[6px] p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all resize-none"
                  />
                </div>

                {/* 5. GST Number */}
                {/* 5. GST Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    GST Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 36AAACT1234F1Z0"
                    value={formData.gstNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15),
                      })
                    }
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] font-mono tracking-wider transition-all"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    15-character Goods & Services Taxpayer Identification Number
                  </p>
                </div>

                {/* 6. Store Status (Edit Mode Only) */}
                {drawerMode === "edit" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Store Branch Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as "Active" | "Inactive",
                        })
                      }
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all cursor-pointer"
                    >
                      <option value="Active">Active (Terminal Enabled)</option>
                      <option value="Inactive">Inactive (Restricted)</option>
                    </select>
                    <p className="text-[10.5px] text-slate-400 mt-1">
                      Set branch availability for POS terminals and staff operations.
                    </p>
                  </div>
                )}

                {/* Information Notice */}
                {drawerMode === "add" && (
                  <div className="p-3 rounded-[6px] bg-amber-50/80 border border-amber-200/80 text-amber-800 text-[11px] leading-relaxed">
                    <strong>Notice:</strong> Newly added stores are registered in an <em>Inactive</em> state without an expiry date. Contact your administrator to activate terminal privileges.
                  </div>
                )}
              </form>

              {/* Offcanvas Footer */}
              <div className="px-5 py-3 border-t border-slate-200/90 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOffcanvasOpen(false)}
                  className="h-[34px] max-h-[34px] px-3.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="store-form"
                  disabled={submitting}
                  className="h-[34px] max-h-[34px] px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </span>
                  ) : (
                    <span>{drawerMode === "edit" ? "Update Store" : "Save Store"}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW STORE DETAIL MODAL */}
      {viewStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  {viewStore.code}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-slate-800 truncate">
                  {viewStore.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewStore(null)}
                className="w-6 h-6 rounded-[4px] text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#f8fafc] border border-slate-200/70">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium uppercase">
                    Store Status
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        viewStore.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-900">
                      {viewStore.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium uppercase">
                    Validity Expiry
                  </span>
                  <span className="text-xs font-semibold text-slate-700 font-mono">
                    {parseExpiry(viewStore.expires).display}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 shrink-0 font-medium">Contact Phone:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 font-medium">
                      {viewStore.mobileNumber || viewStore.phone || "Not Provided"}
                    </span>
                    {(viewStore.mobileNumber || viewStore.phone) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            viewStore.mobileNumber || viewStore.phone || "",
                            "modal-phone"
                          )
                        }
                        className="text-[10.5px] text-[#5e2b9d] hover:underline cursor-pointer"
                      >
                        {copiedKey === "modal-phone" ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 shrink-0 font-medium">City:</span>
                  <span className="text-slate-900 font-medium text-right">
                    {viewStore.city || "Not Provided"}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-400 shrink-0 font-medium">Full Address:</span>
                  <span className="text-slate-900 leading-relaxed text-right max-w-xs">
                    {viewStore.fullAddress || viewStore.location || "Not Provided"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 shrink-0 font-medium">GST Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 font-medium">
                      {viewStore.gstNumber || viewStore.license || "Not Registered"}
                    </span>
                    {(viewStore.gstNumber || viewStore.license) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            viewStore.gstNumber || viewStore.license || "",
                            "modal-gst"
                          )
                        }
                        className="text-[10.5px] text-[#5e2b9d] hover:underline cursor-pointer"
                      >
                        {copiedKey === "modal-gst" ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 shrink-0 font-medium">Store ID:</span>
                  <span className="font-mono text-[11px] text-slate-500 text-right">
                    {viewStore.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer with Delete, Close, and Edit */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
              {/* Delete button from View modal */}
              <button
                type="button"
                onClick={() => {
                  const toDelete = viewStore;
                  setViewStore(null);
                  handleOpenDelete(toDelete);
                }}
                className="h-[32px] px-3 text-xs font-medium text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewStore(null)}
                  className="h-[32px] px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewStore;
                    setViewStore(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="h-[32px] px-3.5 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Store</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STORE CONFIRMATION MODAL */}
      {storeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl max-w-sm w-full p-5 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Delete Store Branch
                </h3>
                <p className="text-[11px] text-slate-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed font-normal">
              Are you sure you want to delete store <strong className="text-slate-900">&quot;{storeToDelete.name}&quot;</strong> ({storeToDelete.code})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                disabled={isDeleting}
                className="h-[32px] px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-[32px] px-3.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-75"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Deleting...</span>
                  </span>
                ) : (
                  <span>Delete Store</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}
