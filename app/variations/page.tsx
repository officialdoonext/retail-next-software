"use client";

import { useState, useEffect } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";

interface Variation {
  id: string;
  name: string;
  createdAt: number;
}

export default function VariationsPage() {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [variationName, setVariationName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchVariations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/variations");
      const data = await res.json();
      if (data.success && Array.isArray(data.variations)) {
        setVariations(data.variations);
      }
    } catch {
      setError("Failed to load variations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVariations();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variationName.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: variationName.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to save variation.");
      } else {
        setVariations((prev) => [...prev, data.variation]);
        setVariationName("");
        setIsModalOpen(false);
      }
    } catch {
      setError("Network error saving variation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/variations?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setVariations((prev) => prev.filter((v) => v.id !== id));
      }
    } catch {
      setError("Failed to delete variation.");
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Dedicated Page Header with Compact Spacing */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Variations
              </h1>
              <span className="bg-[#00966a]/10 text-[#00966a] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {variations.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage store-specific product variants, units, and packagings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setIsModalOpen(true);
            }}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Variation</span>
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="w-full bg-white rounded-[6px] border border-slate-200 p-8 flex flex-col items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-[#5e2b9d] mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-slate-500 font-medium">Loading variations...</span>
          </div>
        ) : variations.length === 0 ? (
          /* Empty State: zero dummy data */
          <div className="w-full bg-white rounded-[6px] border border-dashed border-slate-300/80 p-8 sm:p-12 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-2.5">
              <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h2 className="text-sm font-medium text-slate-800 mb-0.5">
              No Variations Found
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mb-4 font-normal">
              No variations or units have been created for this store yet. Click below to add your first variation.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add First Variation</span>
            </button>
          </div>
        ) : (
          /* Variations Table with Clean, Tight Padding */
          <div className="w-full bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Variation / Unit Name</th>
                  <th className="py-2.5 px-3.5">Created Date</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00966a]" />
                      <span>{v.name}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 font-normal">
                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Delete Variation"
                      >
                        <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Variation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-xl w-full max-w-sm p-4 relative">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-xs font-medium text-slate-900">
                  Add New Variation / Unit
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Variation Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500g, 1L, Small, XL, 10 Tablets/Strip"
                    value={variationName}
                    onChange={(e) => setVariationName(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    autoFocus
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-[34px] max-h-[34px] px-3.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all cursor-pointer shadow-xs disabled:opacity-75"
                  >
                    {submitting ? "Saving..." : "Save Variation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
