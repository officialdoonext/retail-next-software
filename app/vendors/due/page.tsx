"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface DueVendorItem {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  gstNumber: string;
  outstandingDue: number;
  city: string;
}

export default function VendorDuePage() {
  const toast = useToast();

  const [vendors, setVendors] = useState<DueVendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Pay Due Modal
  const [settlingVendor, setSettlingVendor] = useState<DueVendorItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDueVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vendors?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.vendors)) {
        // Show vendors that have outstanding due balance
        setVendors(data.vendors);
      } else {
        toast.error(data.error || "Failed to load vendor dues.");
      }
    } catch {
      toast.error("Network error while loading dues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDueVendors();
  }, [fetchDueVendors]);

  // Filter dues: only vendors with due > 0 or matching search
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const nameMatch = (v.name || "").toLowerCase().includes(q);
        const compMatch = (v.companyName || "").toLowerCase().includes(q);
        const phoneMatch = (v.phone || "").includes(q);
        if (!nameMatch && !compMatch && !phoneMatch) return false;
      }
      return Number(v.outstandingDue) > 0;
    });
  }, [vendors, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / PAGE_SIZE));
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredVendors.slice(start, start + PAGE_SIZE);
  }, [filteredVendors, currentPage]);

  const stats = useMemo(() => {
    const totalDue = filteredVendors.reduce((sum, v) => sum + (Number(v.outstandingDue) || 0), 0);
    const count = filteredVendors.length;
    return { totalDue, count };
  }, [filteredVendors]);

  // Record Settlement
  const handleSettleDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingVendor || paymentAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const newDue = Math.max(0, settlingVendor.outstandingDue - paymentAmount);

      const res = await fetch("/api/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: settlingVendor.id,
          outstandingDue: newDue,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Cleared ₹${paymentAmount.toLocaleString("en-IN")} due for ${settlingVendor.name}.`);
        setSettlingVendor(null);
        fetchDueVendors();
      } else {
        toast.error(data.error || "Failed to update vendor due.");
      }
    } catch {
      toast.error("Network error while recording settlement.");
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Vendor Outstanding Dues</h1>
                <p className="text-xs text-slate-500">
                  Accounts payable ledger, supplier balance tracking & settlement voucher recordings
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/vendors"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>All Vendors</span>
            </Link>

            <Link
              href="/vendors/invoices"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Supplier Invoices</span>
            </Link>

            <button
              type="button"
              onClick={fetchDueVendors}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 2 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Outstanding Balance Due
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-rose-600 font-mono">
                ₹{stats.totalDue.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">To be settled</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Vendors with Pending Balances
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-[#5e2b9d] font-mono">{stats.count}</span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Creditors</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor name, firm or phone..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Vendor Supplier</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">GST Number</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance (₹)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading payable dues...</span>
                    </td>
                  </tr>
                ) : paginatedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold">
                        ✓
                      </div>
                      <p className="font-semibold text-slate-700">All supplier dues cleared!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No outstanding balances recorded for vendors.</p>
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
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm">
                        ₹{(v.outstandingDue || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSettlingVendor(v);
                            setPaymentAmount(v.outstandingDue);
                            setReferenceNumber("");
                          }}
                          className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Clear Due
                        </button>
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
                itemName="creditor accounts"
              />
            </div>
          )}
        </div>

        {/* Clear Due Modal */}
        {settlingVendor && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Record Supplier Settlement</h3>
                  <p className="text-[11px] text-purple-200">Disburse payable & reduce balance</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingVendor(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSettleDue} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Supplier:</span>
                    <span className="font-semibold text-slate-800">{settlingVendor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Balance:</span>
                    <span className="font-mono font-bold text-rose-600">₹{settlingVendor.outstandingDue.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Settlement Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={settlingVendor.outstandingDue}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 font-mono font-bold text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / Netbanking</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-982183921"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="flex justify-between items-center p-2.5 bg-purple-50/50 rounded-lg border border-purple-100">
                  <span className="text-slate-600 font-medium">Remaining Balance:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{Math.max(0, settlingVendor.outstandingDue - paymentAmount).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSettlingVendor(null)}
                    className="h-8 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-8 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Processing..." : "Confirm Settlement"}
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
