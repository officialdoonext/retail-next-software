"use client";

import React from "react";

export interface DraftBillItem {
  id: string;
  draftNumber: string;
  createdAt: number;
  customer?: {
    id?: string;
    name?: string;
    phone?: string;
    discountPercent?: number;
  };
  items: any[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  couponCode?: string;
  appliedCoupon?: any;
}

interface PosDraftsModalProps {
  isOpen: boolean;
  drafts: DraftBillItem[];
  onClose: () => void;
  onResumeDraft: (draft: DraftBillItem) => void;
  onDeleteDraft: (draftId: string) => void;
}

export default function PosDraftsModal({
  isOpen,
  drafts,
  onClose,
  onResumeDraft,
  onDeleteDraft,
}: PosDraftsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Parked & Draft Bills</h3>
              <p className="text-[11px] text-purple-200">
                {drafts.length} {drafts.length === 1 ? "bill currently held" : "bills currently held"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Drafts List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50">
          {drafts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700">No Drafted Bills</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &quot;Draft Bill&quot; on the checkout screen to park bills and resume them later.
              </p>
            </div>
          ) : (
            drafts.map((d) => {
              const totalItemsCount = (d.items || []).reduce(
                (sum, it) => sum + (Number(it.quantity) || 1),
                0
              );
              const formattedTime = new Date(d.createdAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              });

              return (
                <div
                  key={d.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-300 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#5e2b9d] bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                        {d.draftNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">• {formattedTime}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">
                        {d.customer?.name || "Walk-in Customer"}
                      </span>
                      {d.customer?.phone && (
                        <span className="text-slate-400 text-[11px]">({d.customer.phone})</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-900">₹{(d.grandTotal || 0).toFixed(2)}</span>
                      {d.couponCode && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                          {d.couponCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(d.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      title="Discard this draft"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => onResumeDraft(d)}
                      className="px-4 py-1.5 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Resume Bill</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
