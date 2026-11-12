"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import {
  ArrowLeftRight,
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
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShoppingBag,
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

interface ExchangeItemSelection {
  productId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  purchasedQty: number;
  exchangeQty: number;
  unitPrice: number;
  reason: string;
}

interface ReplacementItem {
  productId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
}

interface ExchangeRecord {
  id: string;
  returnNumber: string;
  orderNumber: string;
  originalBillNumber?: string;
  type: "EXCHANGE";
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: any[];
  returnedItems?: any[];
  replacementItems?: any[];
  exchangeValue?: number;
  replacementValue?: number;
  netAmount?: number;
  exchangeVoucherNumber?: string;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: string;
  staffName: string;
  createdAt: number;
}

export default function ExchangesPage() {
  const toast = useToast();

  const [exchanges, setExchanges] = useState<ExchangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExchangeBill, setSelectedExchangeBill] = useState<ExchangeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Exchange Wizard State
  const [searchMode, setSearchMode] = useState<"customer" | "bill">("customer");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [searchingBills, setSearchingBills] = useState(false);
  const [customerRecentBills, setCustomerRecentBills] = useState<SourceBill[]>([]);
  const [selectedBill, setSelectedBill] = useState<SourceBill | null>(null);

  // Selected Items from Bill to Exchange
  const [selectedItems, setSelectedItems] = useState<ExchangeItemSelection[]>([]);
  const [overallExchangeReason, setOverallExchangeReason] = useState("");

  const fetchExchanges = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/returns?type=EXCHANGE&all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.returns)) {
        setExchanges(data.returns);
      } else {
        toast.error(data.error || "Failed to load exchanges.");
      }
    } catch {
      toast.error("Network error while loading exchanges.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  // Search for latest 10 bills of customer (by name or phone)
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
      toast.error("Please enter a bill / invoice number.");
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
        toast.error("No bill matching this invoice number was found.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while searching bill.");
    } finally {
      setSearchingBills(false);
    }
  };

  // Select a bill from results and prepare item list
  const handleSelectBill = (bill: SourceBill) => {
    setSelectedBill(bill);
    setCustomerRecentBills([]);
    // Pre-populate items as unselected
    const itemsList: ExchangeItemSelection[] = (bill.items || []).map((it) => {
      const unitPrice = Number(it.salePrice || it.price) || 0;
      return {
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName || it.name || "Product",
        variantName: it.variantName,
        purchasedQty: Number(it.quantity) || 1,
        exchangeQty: 1,
        unitPrice,
        reason: "Size / Fit replacement",
      };
    });
    setSelectedItems([]);
  };

  // Toggle item selection for return/exchange
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
          exchangeQty: 1,
          unitPrice,
          reason: "Size / Fit replacement",
        },
      ]);
    }
  };

  const handleUpdateExchangeQty = (index: number, newQty: number) => {
    setSelectedItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const validQty = Math.max(1, Math.min(it.purchasedQty, newQty));
        return { ...it, exchangeQty: validQty };
      })
    );
  };

  const handleUpdateReason = (index: number, reason: string) => {
    setSelectedItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, reason } : it))
    );
  };

  // Calculations
  const totalExchangeCreditValue = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + it.exchangeQty * it.unitPrice, 0);
  }, [selectedItems]);

  // Reset form
  const handleResetModal = () => {
    setIsModalOpen(false);
    setSelectedBill(null);
    setSelectedItems([]);
    setOverallExchangeReason("");
    setCustomerRecentBills([]);
    setCustomerSearchTerm("");
    setBillSearchTerm("");
  };

  // Submit Exchange & Issue Bill
  const handleSaveExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) {
      toast.error("Please search and select the original bill.");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item from the bill to exchange.");
      return;
    }

    try {
      setIsSubmitting(true);
      const combinedReason = [
        overallExchangeReason.trim(),
        ...selectedItems.map((it) => it.reason?.trim()).filter(Boolean),
      ].filter(Boolean).join(" | ") || "Product exchange";

      const payload = {
        type: "EXCHANGE",
        orderNumber: selectedBill.billNumber,
        customerId: selectedBill.customer?.id || null,
        customerName: selectedBill.customer?.name || "Customer",
        customerPhone: selectedBill.customer?.phone || "",
        items: selectedItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          quantity: it.exchangeQty,
          price: it.unitPrice,
          reason: it.reason || "Size / Fit replacement",
        })),
        replacementItems: [],
        exchangeValue: totalExchangeCreditValue,
        replacementValue: 0,
        netAmount: -totalExchangeCreditValue,
        refundAmount: totalExchangeCreditValue,
        refundMethod: "CREDIT_NOTE",
        reason: combinedReason,
      };

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process exchange.");
      }

      toast.success(
        `Exchange #${data.returnRecord.returnNumber} saved! Returned stock added back to inventory.`
      );
      handleResetModal();
      fetchExchanges();

      // Immediately open the newly generated Exchange Bill for viewing and printing
      setSelectedExchangeBill({
        ...data.returnRecord,
        originalBillNumber: selectedBill.billNumber,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save exchange.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter existing exchange list
  const filteredExchanges = useMemo(() => {
    return exchanges.filter((e) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (e.returnNumber || "").toLowerCase().includes(q) ||
        (e.orderNumber || "").toLowerCase().includes(q) ||
        (e.originalBillNumber || "").toLowerCase().includes(q) ||
        (e.customer?.name || "").toLowerCase().includes(q) ||
        (e.customer?.phone || "").includes(q)
      );
    });
  }, [exchanges, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExchanges.length / PAGE_SIZE));
  const paginatedExchanges = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredExchanges.slice(start, start + PAGE_SIZE);
  }, [filteredExchanges, currentPage]);

  return (
    <SoftwareLayout>
      <div className="space-y-5">
        {/* Top Header Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0 border border-purple-100">
                <ArrowLeftRight className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Product Exchange Manager</span>
                  <span className="text-xs bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded-full font-mono font-bold border border-purple-200">
                    Restock Enabled
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search past invoices by bill # or customer, inspect purchased line items, restock returned goods, and issue exchange credit bills.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/returns"
                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Go to Returns
              </Link>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Record Exchange</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by exchange #, previous bill #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredExchanges.length}</span> recorded exchange transactions
          </div>
        </div>

        {/* Exchanges Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Spinner className="w-8 h-8 text-[#5e2b9d] mb-2" />
              <p className="text-xs">Loading exchange records...</p>
            </div>
          ) : paginatedExchanges.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <ArrowLeftRight className="w-10 h-10 stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No exchange records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click &ldquo;Record Exchange&rdquo; to process your first product replacement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Exchange Bill #</th>
                    <th className="py-3 px-3">Previous Bill #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Returned Items (Restocked)</th>
                    <th className="py-3 px-3">Replacement / Credit</th>
                    <th className="py-3 px-3">Exchange Value</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedExchanges.map((ex) => {
                    const prevBill = ex.originalBillNumber || ex.orderNumber;
                    const items = ex.returnedItems || ex.items || [];
                    const replacements = ex.replacementItems || [];
                    const exValue = Number(ex.exchangeValue) || Math.abs(Number(ex.refundAmount)) || 0;
                    const netAmt = Number(ex.netAmount) || 0;

                    return (
                      <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Exchange Bill # */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-[#5e2b9d]">
                            {ex.returnNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(ex.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        {/* Previous Bill # */}
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Receipt className="w-3 h-3 text-[#5e2b9d]" />
                            {prevBill}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">
                            {ex.customer?.name || "Customer"}
                          </div>
                          {ex.customer?.phone && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {ex.customer.phone}
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

                        {/* Replacement Items */}
                        <td className="py-3 px-3 max-w-xs">
                          {replacements.length > 0 ? (
                            <div className="space-y-1">
                              {replacements.slice(0, 2).map((it: any, i: number) => (
                                <div key={i} className="text-emerald-800 font-medium truncate flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>{it.productName || "Replacement"}</span>
                                  <span className="text-slate-400 text-[10px]">×{it.quantity || 1}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200">
                              Exchange Voucher Issued
                            </span>
                          )}
                        </td>

                        {/* Exchange Value */}
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          <div>₹{exValue.toLocaleString("en-IN")}</div>
                          {netAmt !== 0 && (
                            <span
                              className={`text-[10px] font-bold block mt-0.5 ${
                                netAmt > 0 ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              {netAmt > 0
                                ? `+₹${netAmt.toLocaleString()} Paid Extra`
                                : `-₹${Math.abs(netAmt).toLocaleString()} Refunded`}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Received
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedExchangeBill(ex)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-md transition-colors cursor-pointer border border-purple-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Exchange Bill
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
          {filteredExchanges.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredExchanges.length}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setCurrentPage(page)}
            />
          )}
        </div>

        {/* ==================================================================== */}
        {/* MODAL 1: RECORD NEW EXCHANGE (SEARCH BY BILL OR CUSTOMER)            */}
        {/* ==================================================================== */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-[#5e2b9d]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Record Product Exchange
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

                    {/* Mode A: Search by Customer Name or Phone */}
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

                        {/* Results List: Latest 10 Bills */}
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
                                        hour: "2-digit",
                                        minute: "2-digit",
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

                    {/* Mode B: Search by Bill Number */}
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
                  /* STEP 2: SELECTED BILL & ITEM PICKER */
                  <div className="space-y-4">
                    {/* Selected Bill Banner */}
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

                    {/* Bill Purchased Items Table */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Step 2: Select Items to Exchange
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Checked items will be received & restocked in inventory
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10.5px]">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-10">Select</th>
                              <th className="py-2.5 px-3">Item Purchased</th>
                              <th className="py-2.5 px-3 text-center">Purchased Qty</th>
                              <th className="py-2.5 px-3 text-center">Exchange Qty</th>
                              <th className="py-2.5 px-3 text-right">Unit Price</th>
                              <th className="py-2.5 px-3 text-right">Exchange Credit</th>
                              <th className="py-2.5 px-3">Exchange Reason</th>
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
                                <tr key={idx} className={isChecked ? "bg-purple-50/40" : "hover:bg-slate-50"}>
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleItemSelection(item)}
                                      className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] w-4 h-4 cursor-pointer"
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
                                        value={selectedObj.exchangeQty}
                                        onChange={(e) => handleUpdateExchangeQty(selIdx, Number(e.target.value))}
                                        className="w-14 px-1.5 py-0.5 text-center bg-white border border-slate-300 rounded text-xs font-semibold"
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    ₹{unitPrice.toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-[#5e2b9d] font-mono">
                                    {isChecked && selectedObj
                                      ? `₹${(selectedObj.exchangeQty * unitPrice).toLocaleString("en-IN")}`
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {isChecked && selectedObj ? (
                                      <div className="space-y-1 py-1">
                                        <input
                                          type="text"
                                          value={selectedObj.reason}
                                          onChange={(e) => handleUpdateReason(selIdx, e.target.value)}
                                          placeholder="Type exchange reason..."
                                          className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          {["Size misfit", "Color swap", "Defective item", "Customer choice"].map((tag) => (
                                            <button
                                              key={tag}
                                              type="button"
                                              onClick={() => handleUpdateReason(selIdx, tag)}
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#5e2b9d] transition-colors cursor-pointer"
                                            >
                                              {tag}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
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

                      {/* Total Exchange Value Callout */}
                      <div className="mt-2.5 flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs">
                        <span className="font-bold text-purple-900">
                          Total Exchange Credit Value ({selectedItems.length} item(s) selected):
                        </span>
                        <span className="text-base font-extrabold text-[#5e2b9d] font-mono">
                          ₹{totalExchangeCreditValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* STEP 3: OPTIONAL GENERAL NOTES & CONFIRMATION */}
                    <div className="p-4 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#5e2b9d] uppercase tracking-wider block">
                          Step 3: Exchange Bill Summary & Remarks
                        </label>
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Stock will be auto-restocked on bill issue
                        </span>
                      </div>

                      <input
                        type="text"
                        value={overallExchangeReason}
                        onChange={(e) => setOverallExchangeReason(e.target.value)}
                        placeholder="Write overall exchange notes / remarks (e.g. Size replacement, approved by manager)..."
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-[#5e2b9d] text-slate-800"
                      />
                      <p className="text-[11px] text-slate-500">
                        Upon saving, an official Exchange Bill & Credit Slip will be generated immediately for the customer to apply in POS or redeem on future orders.
                      </p>
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
                    onClick={handleSaveExchange}
                    disabled={isSubmitting || selectedItems.length === 0}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner className="w-3.5 h-3.5" />
                        <span>Issuing Exchange Bill...</span>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-4 h-4" />
                        <span>Save & Issue Exchange Bill (₹{totalExchangeCreditValue.toFixed(2)})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 2: VIEW PRINTABLE EXCHANGE BILL / VOUCHER                      */}
        {/* ==================================================================== */}
        {selectedExchangeBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto flex flex-col print:shadow-none print:border-none print:w-full">
              {/* Modal Action Bar (Hidden on print) */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#5e2b9d]" />
                  <h3 className="font-bold text-slate-900 text-xs">
                    Exchange Invoice & Voucher
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#5e2b9d] text-white rounded text-xs font-semibold hover:bg-[#4d2282] transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedExchangeBill(null)}
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
                  <p className="text-[11px] text-slate-500">Official Exchange Invoice & Credit Slip</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Exchange Bill #
                    </span>
                    <span className="font-mono font-bold text-[#5e2b9d]">
                      {selectedExchangeBill.returnNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Previous / Original Bill
                    </span>
                    <span className="font-mono font-bold text-purple-900 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                      #{selectedExchangeBill.originalBillNumber || selectedExchangeBill.orderNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Customer
                    </span>
                    <span className="font-semibold text-slate-900">
                      {selectedExchangeBill.customer?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">
                      Date & Cashier
                    </span>
                    <span className="text-slate-700">
                      {new Date(selectedExchangeBill.createdAt).toLocaleDateString("en-IN", {
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
                      Stock Added to Inventory
                    </span>
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase">
                        <tr>
                          <th className="py-1.5 px-2.5">Item</th>
                          <th className="py-1.5 px-2 text-center">Qty</th>
                          <th className="py-1.5 px-2 text-right">Rate</th>
                          <th className="py-1.5 px-2.5 text-right">Credit Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedExchangeBill.returnedItems || selectedExchangeBill.items || []).map(
                          (it: any, idx: number) => {
                            const qty = it.quantity || 1;
                            const rate = Number(it.price || it.salePrice) || 0;
                            return (
                              <tr key={idx}>
                                <td className="py-1.5 px-2.5 font-medium text-slate-900">
                                  {it.productName || it.name}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono">{qty}</td>
                                <td className="py-1.5 px-2 text-right font-mono">₹{rate.toLocaleString()}</td>
                                <td className="py-1.5 px-2.5 text-right font-bold text-[#5e2b9d] font-mono">
                                  ₹{(qty * rate).toLocaleString()}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Replacement Items (if any) */}
                {Array.isArray(selectedExchangeBill.replacementItems) &&
                  selectedExchangeBill.replacementItems.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5">
                        Replacement Items Provided
                      </h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase">
                            <tr>
                              <th className="py-1.5 px-2.5">New Item</th>
                              <th className="py-1.5 px-2 text-center">Qty</th>
                              <th className="py-1.5 px-2.5 text-right">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedExchangeBill.replacementItems.map((it: any, idx: number) => (
                              <tr key={idx}>
                                <td className="py-1.5 px-2.5 font-medium text-slate-900">
                                  {it.productName}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono">{it.quantity || 1}</td>
                                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 font-mono">
                                  ₹{Number(it.price || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Total Exchange Value Callout Banner */}
                <div className="bg-[#5e2b9d] text-white p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-purple-200 text-[10px] uppercase font-semibold tracking-wider block">
                      Total Exchange Credit Value
                    </span>
                    <span className="text-xl font-black">
                      ₹{(
                        Number(selectedExchangeBill.exchangeValue) ||
                        Math.abs(Number(selectedExchangeBill.refundAmount)) ||
                        0
                      ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-semibold font-mono">
                      Ref: #{selectedExchangeBill.originalBillNumber || selectedExchangeBill.orderNumber}
                    </span>
                  </div>
                </div>

                {/* Quick Link to POS */}
                <div className="pt-2 print:hidden flex items-center justify-end">
                  <Link
                    href={`/pos?exchangeVoucher=${selectedExchangeBill.returnNumber}&previousBill=${encodeURIComponent(
                      selectedExchangeBill.originalBillNumber || selectedExchangeBill.orderNumber
                    )}&credit=${Number(selectedExchangeBill.exchangeValue || selectedExchangeBill.refundAmount || 0)}&customerPhone=${encodeURIComponent(
                      selectedExchangeBill.customer?.phone || (selectedExchangeBill as any).customerPhone || ""
                    )}&customerName=${encodeURIComponent(
                      selectedExchangeBill.customer?.name || (selectedExchangeBill as any).customerName || ""
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Create New POS Bill with this Credit</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
