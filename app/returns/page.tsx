"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import {
  RotateCcw,
  Search,
  Receipt,
  User,
  Phone,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Printer,
  X,
  CreditCard,
  FileText,
  Building2,
  ArrowRight,
} from "lucide-react";

interface BillItem {
  productId?: string;
  variantId?: string;
  productName: string;
  name?: string;
  variantName?: string;
  quantity: number;
  salePrice?: number;
  price?: number;
  subtotal?: number;
}

interface SourceBill {
  id: string;
  billNumber: string;
  createdAt: number;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  status: string;
}

interface ReturnItemSelection {
  productId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  purchasedQty: number;
  returnQty: number;
  unitPrice: number;
  reason: string;
}

interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderNumber: string;
  originalBillNumber?: string;
  type: "RETURN" | "EXCHANGE";
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    price: number;
    reason?: string;
  }>;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: string;
  staffName: string;
  createdAt: number;
}

export default function ReturnsPage() {
  const toast = useToast();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // Pagination (Strictly latest 24)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReturnSlip, setSelectedReturnSlip] = useState<ReturnRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return Wizard State
  const [searchMode, setSearchMode] = useState<"customer" | "bill">("customer");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [searchingBills, setSearchingBills] = useState(false);
  const [customerRecentBills, setCustomerRecentBills] = useState<SourceBill[]>([]);
  const [selectedBill, setSelectedBill] = useState<SourceBill | null>(null);

  // Selected Items to Return
  const [selectedItems, setSelectedItems] = useState<ReturnItemSelection[]>([]);
  const [refundMethod, setRefundMethod] = useState("CASH");

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/returns?type=RETURN&all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.returns)) {
        setReturns(data.returns);
      } else {
        toast.error(data.error || "Failed to load returns.");
      }
    } catch {
      toast.error("Network error while loading returns.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Search latest 10 bills by customer (name or phone)
  const handleSearchCustomerBills = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : customerSearchTerm).trim();
    if (!q) {
      toast.error("Please enter a customer name or phone number.");
      return;
    }

    try {
      setSearchingBills(true);
      const res = await fetch(`/api/orders?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders)) {
        setCustomerRecentBills(data.orders);
        if (data.orders.length === 0) {
          toast.error("No recent invoices found for this customer.");
        }
      } else {
        toast.error(data.error || "Failed to find bills.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while searching bills.");
    } finally {
      setSearchingBills(false);
    }
  };

  // Search bill directly by Bill Number
  const handleSearchByBillNumber = async () => {
    const b = billSearchTerm.trim();
    if (!b) {
      toast.error("Please enter an invoice / bill number.");
      return;
    }

    try {
      setSearchingBills(true);
      const res = await fetch(`/api/orders?search=${encodeURIComponent(b)}&limit=10`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        const exact = data.orders.find((o: any) => o.billNumber.toLowerCase() === b.toLowerCase());
        const billToSelect = exact || data.orders[0];
        handleSelectBill(billToSelect);
      } else {
        toast.error("No invoice matching this bill number was found.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while searching bill.");
    } finally {
      setSearchingBills(false);
    }
  };

  // Select bill and prepare items
  const handleSelectBill = (bill: SourceBill) => {
    setSelectedBill(bill);
    setCustomerRecentBills([]);
    setSelectedItems([]);
  };

  // Toggle item selection
  const handleToggleItemSelection = (item: BillItem) => {
    const pName = item.productName || item.name || "Product";
    const existingIdx = selectedItems.findIndex(
      (si) => si.productName === pName && si.variantName === item.variantName
    );

    if (existingIdx !== -1) {
      setSelectedItems((prev) => prev.filter((_, idx) => idx !== existingIdx));
    } else {
      const unitPrice = Number(item.salePrice || item.price) || 0;
      setSelectedItems((prev) => [
        ...prev,
        {
          productId: item.productId,
          variantId: item.variantId,
          productName: pName,
          variantName: item.variantName,
          purchasedQty: Number(item.quantity) || 1,
          returnQty: 1,
          unitPrice,
          reason: "Customer preference",
        },
      ]);
    }
  };

  const handleUpdateReturnQty = (index: number, newQty: number) => {
    setSelectedItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const validQty = Math.max(1, Math.min(it.purchasedQty, newQty));
        return { ...it, returnQty: validQty };
      })
    );
  };

  const handleUpdateReason = (index: number, reason: string) => {
    setSelectedItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, reason } : it))
    );
  };

  // Total Refund Amount
  const totalRefundAmount = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + it.returnQty * it.unitPrice, 0);
  }, [selectedItems]);

  const handleResetModal = () => {
    setIsModalOpen(false);
    setSelectedBill(null);
    setSelectedItems([]);
    setCustomerRecentBills([]);
    setCustomerSearchTerm("");
    setBillSearchTerm("");
    setRefundMethod("CASH");
  };

  // Save Return
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) {
      toast.error("Please select the original purchase invoice.");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to return.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        type: "RETURN",
        orderNumber: selectedBill.billNumber,
        customerId: selectedBill.customer?.id || null,
        customerName: selectedBill.customer?.name || "Customer",
        customerPhone: selectedBill.customer?.phone || "",
        items: selectedItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          quantity: it.returnQty,
          price: it.unitPrice,
          reason: it.reason,
        })),
        refundAmount: totalRefundAmount,
        refundMethod,
        reason: selectedItems.map((it) => it.reason).filter(Boolean).join(", ") || "Customer return",
      };

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process return.");
      }

      toast.success(
        `Return #${data.returnRecord.returnNumber} processed! Items restocked in inventory.`
      );
      handleResetModal();
      fetchReturns();

      // Open printable return slip
      setSelectedReturnSlip({
        ...data.returnRecord,
        originalBillNumber: selectedBill.billNumber,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process return.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter returns table
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const numMatch = (r.returnNumber || "").toLowerCase().includes(q);
        const orderMatch = (r.orderNumber || "").toLowerCase().includes(q);
        const origMatch = (r.originalBillNumber || "").toLowerCase().includes(q);
        const nameMatch = (r.customer?.name || "").toLowerCase().includes(q);
        const phoneMatch = (r.customer?.phone || "").includes(q);
        if (!numMatch && !orderMatch && !origMatch && !nameMatch && !phoneMatch) return false;
      }
      if (methodFilter !== "all" && r.refundMethod?.toUpperCase() !== methodFilter) return false;
      return true;
    });
  }, [returns, searchQuery, methodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredReturns.slice(start, start + PAGE_SIZE);
  }, [filteredReturns, currentPage]);

  const stats = useMemo(() => {
    const totalCount = filteredReturns.length;
    const totalRefund = filteredReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const totalItems = filteredReturns.reduce((sum, r) => {
      const itCount = (r.items || []).reduce((s, it) => s + (Number(it.quantity) || 1), 0);
      return sum + itCount;
    }, 0);
    return { totalCount, totalRefund, totalItems };
  }, [filteredReturns]);

  return (
    <SoftwareLayout>
      <div className="space-y-5">
        {/* Top Header Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <RotateCcw className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Customer Returns & Refunds</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-200">
                    Auto-Restock
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search past invoices by bill # or customer, inspect purchased line items, restock returned products, and issue refund slips.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/returns/exchanges"
                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Go to Exchanges
              </Link>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Record Return</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Returns
            </span>
            <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
              {stats.totalCount}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Refund Disbursed
            </span>
            <div className="mt-1 text-2xl font-bold text-rose-600 font-mono">
              ₹{stats.totalRefund.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Items Returned & Restocked
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 font-mono">
              {stats.totalItems} Units
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by return #, original bill #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Refund Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="CREDIT_NOTE">Credit Note</option>
            </select>

            <span className="text-xs text-slate-500 font-medium ml-1">
              Showing <span className="font-bold text-slate-800">{filteredReturns.length}</span> records
            </span>
          </div>
        </div>

        {/* Returns Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Spinner className="w-8 h-8 text-[#5e2b9d] mb-2" />
              <p className="text-xs">Loading customer returns...</p>
            </div>
          ) : paginatedReturns.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <RotateCcw className="w-10 h-10 stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No return records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click &ldquo;Record Return&rdquo; to process your first refund voucher.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Return Slip #</th>
                    <th className="py-3 px-3">Original Bill #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Returned Items (Restocked)</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3">Refund Amount</th>
                    <th className="py-3 px-3 text-center">Tender</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedReturns.map((ret) => {
                    const prevBill = ret.originalBillNumber || ret.orderNumber;
                    const items = ret.items || [];

                    return (
                      <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Return Slip # */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-rose-700">
                            {ret.returnNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(ret.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        {/* Original Bill # */}
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Receipt className="w-3 h-3 text-[#5e2b9d]" />
                            {prevBill}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">
                            {ret.customer?.name || "Customer"}
                          </div>
                          {ret.customer?.phone && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {ret.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* Returned Items */}
                        <td className="py-3 px-3 max-w-xs">
                          <div className="space-y-1">
                            {items.slice(0, 2).map((it: any, i: number) => (
                              <div key={i} className="text-slate-800 font-medium truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                <span>{it.productName || it.name || "Item"}</span>
                                <span className="text-slate-400 text-[10px]">×{it.quantity || 1}</span>
                              </div>
                            ))}
                            {items.length > 2 && (
                              <span className="text-[10px] text-slate-400 block">
                                +{items.length - 2} more item(s)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-3 text-slate-600 italic">
                          {ret.reason || "Customer return"}
                        </td>

                        {/* Refund Amount */}
                        <td className="py-3 px-3 font-bold text-rose-600 font-mono text-sm">
                          ₹{ret.refundAmount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Tender */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                            {ret.refundMethod || "CASH"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReturnSlip(ret)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-md transition-colors cursor-pointer border border-purple-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Return Slip
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredReturns.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredReturns.length}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setCurrentPage(page)}
            />
          )}
        </div>

        {/* ==================================================================== */}
        {/* MODAL 1: RECORD RETURN (SEARCH BY BILL OR CUSTOMER)                  */}
        {/* ==================================================================== */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Record Customer Return & Restock
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleResetModal}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {/* STEP 1: SEARCH ORIGINAL BILL */}
                {!selectedBill ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Step 1: Locate Original Purchase Invoice
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchMode("customer");
                            setCustomerRecentBills([]);
                          }}
                          className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                            searchMode === "customer"
                              ? "bg-white text-[#5e2b9d] shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Search by Customer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchMode("bill");
                            setCustomerRecentBills([]);
                          }}
                          className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                            searchMode === "bill"
                              ? "bg-white text-[#5e2b9d] shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Search by Bill Number
                        </button>
                      </div>
                    </div>

                    {/* Mode A: Customer Name or Phone */}
                    {searchMode === "customer" && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSearchCustomerBills();
                                }
                              }}
                              placeholder="Enter customer name or 10-digit mobile number..."
                              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSearchCustomerBills()}
                            disabled={searchingBills}
                            className="px-4 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                          >
                            {searchingBills ? <Spinner className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                            <span>Find Latest 10 Bills</span>
                          </button>
                        </div>

                        {/* Recent 10 Bills */}
                        {customerRecentBills.length > 0 && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                              Latest Bills for Customer ({customerRecentBills.length} found)
                            </div>
                            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                              {customerRecentBills.map((bill) => (
                                <div
                                  key={bill.id}
                                  className="p-3 hover:bg-purple-50/50 transition-colors flex items-center justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="font-mono font-bold text-[#5e2b9d]">
                                      {bill.billNumber}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {new Date(bill.createdAt).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}{" "}
                                      • <span className="font-semibold text-slate-800">{bill.customer?.name}</span> ({bill.customer?.phone || "No phone"})
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className="font-bold text-slate-900">
                                        ₹{bill.grandTotal?.toLocaleString("en-IN")}
                                      </div>
                                      <div className="text-[10.5px] text-slate-400">
                                        {(bill.items || []).length} item(s) • {bill.paymentMethod}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectBill(bill)}
                                      className="px-3 py-1 bg-[#5e2b9d] text-white rounded text-xs font-semibold hover:bg-[#4d2282] cursor-pointer"
                                    >
                                      Select Bill
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode B: Exact Bill Number */}
                    {searchMode === "bill" && (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Receipt className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={billSearchTerm}
                            onChange={(e) => setBillSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSearchByBillNumber();
                              }
                            }}
                            placeholder="Enter exact bill number (e.g. INV-202611...)"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSearchByBillNumber}
                          disabled={searchingBills}
                          className="px-4 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          {searchingBills ? <Spinner className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                          <span>Search Bill</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* STEP 2: BILL ITEMS & RETURN PICKER */
                  <div className="space-y-4">
                    {/* Bill Header Banner */}
                    <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-900">Original Bill:</span>
                          <span className="font-mono font-bold text-[#5e2b9d] bg-white px-2 py-0.5 rounded border border-purple-200">
                            {selectedBill.billNumber}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">
                            {new Date(selectedBill.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1">
                          Customer: <span className="font-semibold text-slate-900">{selectedBill.customer?.name}</span>
                          {selectedBill.customer?.phone && ` (${selectedBill.customer.phone})`} • Total Paid: <b className="text-slate-900">₹{selectedBill.grandTotal?.toLocaleString("en-IN")}</b>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBill(null);
                          setSelectedItems([]);
                        }}
                        className="text-xs text-[#5e2b9d] hover:underline font-semibold cursor-pointer shrink-0"
                      >
                        Change Bill
                      </button>
                    </div>

                    {/* Items Table */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Step 2: Select Items to Return
                        </label>
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Items will be auto-restocked into inventory
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10.5px]">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-10">Select</th>
                              <th className="py-2.5 px-3">Item Purchased</th>
                              <th className="py-2.5 px-3 text-center">Purchased</th>
                              <th className="py-2.5 px-3 text-center">Return Qty</th>
                              <th className="py-2.5 px-3 text-right">Price</th>
                              <th className="py-2.5 px-3 text-right">Refund Total</th>
                              <th className="py-2.5 px-3">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(selectedBill.items || []).map((item, idx) => {
                              const pName = item.productName || item.name || "Product";
                              const isChecked = selectedItems.some(
                                (si) => si.productName === pName && si.variantName === item.variantName
                              );
                              const selectedObj = selectedItems.find(
                                (si) => si.productName === pName && si.variantName === item.variantName
                              );
                              const selIdx = selectedItems.findIndex(
                                (si) => si.productName === pName && si.variantName === item.variantName
                              );
                              const unitPrice = Number(item.salePrice || item.price) || 0;

                              return (
                                <tr key={idx} className={isChecked ? "bg-rose-50/40" : "hover:bg-slate-50"}>
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleItemSelection(item)}
                                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900">{pName}</div>
                                    {item.variantName && (
                                      <div className="text-[10px] text-slate-400">{item.variantName}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {item.quantity || 1}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {isChecked && selectedObj ? (
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.quantity || 1}
                                        value={selectedObj.returnQty}
                                        onChange={(e) => handleUpdateReturnQty(selIdx, Number(e.target.value))}
                                        className="w-14 px-1.5 py-0.5 text-center bg-white border border-slate-300 rounded text-xs font-semibold"
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    ₹{unitPrice.toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-rose-600 font-mono">
                                    {isChecked && selectedObj
                                      ? `₹${(selectedObj.returnQty * unitPrice).toLocaleString("en-IN")}`
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {isChecked && selectedObj ? (
                                      <select
                                        value={selectedObj.reason}
                                        onChange={(e) => handleUpdateReason(selIdx, e.target.value)}
                                        className="px-2 py-0.5 text-[11px] bg-white border border-slate-300 rounded text-slate-700 outline-none"
                                      >
                                        <option value="Customer preference">Customer Preference</option>
                                        <option value="Defective / Damaged">Defective / Damaged</option>
                                        <option value="Wrong Item Shipped">Wrong Item Shipped</option>
                                        <option value="Size Misfit">Size Misfit</option>
                                      </select>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* STEP 3: REFUND METHOD & SUMMARY */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Step 3: Select Refund Payment Method
                        </label>

                        <div className="flex items-center gap-1.5">
                          {["CASH", "UPI", "CARD", "CREDIT_NOTE"].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setRefundMethod(m)}
                              className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                refundMethod === m
                                  ? "bg-[#5e2b9d] text-white shadow-2xs"
                                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {m === "CREDIT_NOTE" ? "Credit Note" : m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Total Refund Banner */}
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700">
                          Total Refund Amount to Disburse:
                        </span>
                        <span className="text-lg font-black text-rose-600 font-mono">
                          ₹{totalRefundAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleResetModal}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>

                {selectedBill && (
                  <button
                    type="button"
                    onClick={handleSaveReturn}
                    disabled={isSubmitting || selectedItems.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner className="w-3.5 h-3.5" />
                        <span>Restocking & Disbursing...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Confirm Return & Restock</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 2: VIEW PRINTABLE RETURN SLIP                                  */}
        {/* ==================================================================== */}
        {selectedReturnSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto flex flex-col print:shadow-none print:border-none print:w-full">
              {/* Modal Action Bar (Hidden on print) */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-slate-900 text-xs">
                    Customer Return Slip & Credit Voucher
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#5e2b9d] text-white rounded text-xs font-semibold hover:bg-[#4d2282] transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReturnSlip(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Slip Content */}
              <div className="p-6 space-y-4 print:p-6 text-slate-800 text-xs font-sans">
                {/* Store Header */}
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Retail Next Store
                  </h2>
                  <p className="text-[11px] text-slate-500">Official Return Slip & Refund Voucher</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Return Slip #
                    </span>
                    <span className="font-mono font-bold text-rose-600">
                      {selectedReturnSlip.returnNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Original / Previous Bill
                    </span>
                    <span className="font-mono font-bold text-purple-900 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                      #{selectedReturnSlip.originalBillNumber || selectedReturnSlip.orderNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Customer
                    </span>
                    <span className="font-semibold text-slate-900">
                      {selectedReturnSlip.customer?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Date & Cashier
                    </span>
                    <span className="text-slate-700">
                      {new Date(selectedReturnSlip.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Returned Items Table */}
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Returned Items (Restocked)</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      Inventory Restocked
                    </span>
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase">
                        <tr>
                          <th className="py-1.5 px-2.5">Item</th>
                          <th className="py-1.5 px-2 text-center">Qty</th>
                          <th className="py-1.5 px-2 text-right">Price</th>
                          <th className="py-1.5 px-2.5 text-right">Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedReturnSlip.items || []).map((it: any, idx: number) => {
                          const qty = it.quantity || 1;
                          const price = Number(it.price || it.salePrice) || 0;
                          return (
                            <tr key={idx}>
                              <td className="py-1.5 px-2.5 font-medium text-slate-900">
                                {it.productName || it.name}
                              </td>
                              <td className="py-1.5 px-2 text-center font-mono">{qty}</td>
                              <td className="py-1.5 px-2 text-right font-mono">₹{price.toLocaleString()}</td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-rose-600 font-mono">
                                ₹{(qty * price).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total Refund Banner */}
                <div className="bg-rose-600 text-white p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-rose-100 text-[10px] uppercase font-semibold tracking-wider block">
                      Total Refund Disbursed ({selectedReturnSlip.refundMethod})
                    </span>
                    <span className="text-xl font-black">
                      ₹{selectedReturnSlip.refundAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-semibold font-mono">
                      Ref: #{selectedReturnSlip.originalBillNumber || selectedReturnSlip.orderNumber}
                    </span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 pt-6 text-center text-[10px] text-slate-400">
                  <div>
                    <div className="border-t border-slate-300 w-24 mx-auto mb-1"></div>
                    <span>Customer Signature</span>
                  </div>
                  <div>
                    <div className="border-t border-slate-300 w-24 mx-auto mb-1"></div>
                    <span>Authorized Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
