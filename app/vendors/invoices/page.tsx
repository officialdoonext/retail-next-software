"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface VendorInvoice {
  id: string;
  vendorId?: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
  notes?: string;
  createdAt: number;
}

export default function VendorInvoicesPage() {
  const toast = useToast();

  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<VendorInvoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vendorId: "",
    vendorName: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: 0,
    paidAmount: 0,
    paymentMethod: "Bank Transfer",
    notes: "",
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vendors/invoices?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      } else {
        toast.error(data.error || "Failed to load supplier invoices.");
      }
    } catch {
      toast.error("Network error while loading invoices.");
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
    fetchInvoices();
    loadVendors();
  }, [fetchInvoices, loadVendors]);

  // Filter
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !inv.invoiceNumber.toLowerCase().includes(q) && !inv.vendorName.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && inv.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [invoices, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, currentPage]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const paidAmount = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const dueAmount = invoices.reduce((sum, inv) => sum + (Number(inv.dueAmount) || 0), 0);
    return { totalAmount, paidAmount, dueAmount };
  }, [invoices]);

  // Add Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorName.trim() || !formData.invoiceNumber.trim() || formData.amount <= 0) {
      toast.error("Please fill vendor, invoice number and positive bill amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/vendors/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Invoice #${data.invoice?.invoiceNumber || ""} registered.`);
        setIsAddModalOpen(false);
        fetchInvoices();
      } else {
        toast.error(data.error || "Failed to add invoice.");
      }
    } catch {
      toast.error("Network error while recording invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice || payAmountInput <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/vendors/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payingInvoice.id,
          paymentAmount: payAmountInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Payment of ₹${payAmountInput.toLocaleString("en-IN")} recorded.`);
        setPayingInvoice(null);
        fetchInvoices();
      } else {
        toast.error(data.error || "Failed to record payment.");
      }
    } catch {
      toast.error("Network error while recording payment.");
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Vendor Invoices & Bills</h1>
                <p className="text-xs text-slate-500">
                  Record supplier purchase bills, payment disbursements & maintain audit accounts
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/vendors/due"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Outstanding Dues</span>
            </Link>

            <button
              type="button"
              onClick={fetchInvoices}
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
                  invoiceNumber: "",
                  invoiceDate: new Date().toISOString().slice(0, 10),
                  dueDate: "",
                  amount: 0,
                  paidAmount: 0,
                  paymentMethod: "Bank Transfer",
                  notes: "",
                });
                setIsAddModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Supplier Bill</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Invoiced Purchases
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{summary.totalAmount.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">({invoices.length} bills)</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Paid Out
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                ₹{summary.paidAmount.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Settled</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Balance Due
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">
                ₹{summary.dueAmount.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">Unpaid</span>
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
              placeholder="Search invoice # or vendor name..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "unpaid", "partially paid", "paid"].map((st) => (
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

        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Supplier Vendor</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Bill Total ₹</th>
                  <th className="py-3 px-4 text-right">Paid ₹</th>
                  <th className="py-3 px-4 text-right">Balance Due ₹</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading invoices...</span>
                    </td>
                  </tr>
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No invoices found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add Supplier Bill&quot; to enter purchase invoices.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{inv.vendorName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {inv.invoiceDate}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {inv.dueDate || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{(inv.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        ₹{(inv.paidAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {inv.dueAmount > 0 ? (
                          <span className="text-rose-600">₹{inv.dueAmount.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-emerald-600">₹0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            inv.status === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.status === "Partially Paid"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.dueAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPayAmountInput(inv.dueAmount);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Pay Bill
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredInvoices.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="invoices"
              />
            </div>
          )}
        </div>

        {/* Add Invoice Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Add Vendor Purchase Bill</h3>
                  <p className="text-[11px] text-purple-200">Register inward wholesale supplier invoice</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveInvoice} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supplier / Vendor <span className="text-rose-500">*</span>
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
                      Invoice / Bill Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. INV-SUP-9021"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Invoice Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Invoice Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Paid Amount (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Tender
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI / Netbanking</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] font-semibold text-slate-400 block">Balance Due:</span>
                    <span className="font-mono font-bold text-base text-rose-600">
                      ₹{Math.max(0, formData.amount - formData.paidAmount).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Lot #18 goods received via transport"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
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
                    <span>Save Invoice</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {payingInvoice && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Record Supplier Payment</h3>
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Supplier:</span>
                    <span className="font-semibold text-slate-800">{payingInvoice.vendorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Invoice:</span>
                    <span className="font-mono font-bold text-slate-900">{payingInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Due:</span>
                    <span className="font-mono font-bold text-rose-600">₹{payingInvoice.dueAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Amount to Disburse (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={payingInvoice.dueAmount}
                    required
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 font-mono font-bold text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(null)}
                    className="h-8 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-8 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Processing..." : "Confirm Payment"}
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
