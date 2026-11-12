"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import { DateFilterType, getDateRange, isDateInRange } from "@/lib/dateFilters";
import PosReceiptModal, { ReceiptData } from "@/components/PosReceiptModal";
import Link from "next/link";

interface CounterOrder {
  id: string;
  billNumber: string;
  storeId?: string;
  status: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  items: any[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  splitDetails?: any;
  settledBy: string;
  createdAt: number;
}

export default function CounterSalesPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<CounterOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Receipt Modal
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        toast.error(data.error || "Failed to load counter sales.");
      }
    } catch {
      toast.error("Network error while loading counter sales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const activeDateRange = useMemo(() => {
    return getDateRange(dateFilter);
  }, [dateFilter]);

  // Unique staff list for filter
  const staffNames = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.settledBy) set.add(o.settledBy);
    });
    return Array.from(set);
  }, [orders]);

  // Filtered
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!isDateInRange(o.createdAt, activeDateRange)) return false;
      if (selectedStaff !== "all" && o.settledBy !== selectedStaff) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const billMatch = (o.billNumber || "").toLowerCase().includes(q);
        const nameMatch = (o.customer?.name || "").toLowerCase().includes(q);
        const phoneMatch = (o.customer?.phone || "").includes(q);
        if (!billMatch && !nameMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [orders, activeDateRange, selectedStaff, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, selectedStaff, searchQuery]);

  // Live Register Summary calculations
  const summary = useMemo(() => {
    let totalSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    filteredOrders.forEach((o) => {
      const amt = Number(o.grandTotal || o.total || 0);
      totalSales += amt;
      totalTax += Number(o.tax || 0);
      totalDiscount += Number(o.discount || 0);

      const pm = String(o.paymentMethod || "").toUpperCase();
      if (pm === "CASH") cashSales += amt;
      else if (pm === "UPI") upiSales += amt;
      else if (pm === "CARD") cardSales += amt;
      else if (pm.startsWith("SPLIT")) {
        const s = o.splitDetails;
        cashSales += Number(s?.cash) || 0;
        upiSales += Number(s?.upi) || 0;
        cardSales += Number(s?.card) || 0;
      } else {
        cashSales += amt;
      }
    });

    return {
      totalSales,
      cashSales,
      upiSales,
      cardSales,
      totalOrders: filteredOrders.length,
      totalTax,
      totalDiscount,
    };
  }, [filteredOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const handlePrint = (order: CounterOrder) => {
    const receiptData: ReceiptData = {
      orderId: order.id,
      billNumber: order.billNumber,
      date: new Date(order.createdAt).toLocaleDateString("en-IN"),
      time: new Date(order.createdAt).toLocaleTimeString("en-IN"),
      customer: {
        name: order.customer?.name || "Walk-in Customer",
        phone: order.customer?.phone || "",
      },
      items: order.items || [],
      subtotal: order.subtotal,
      discount: order.discount,
      cgst: (order.tax || 0) / 2,
      sgst: (order.tax || 0) / 2,
      grandTotal: order.grandTotal || order.total,
      paymentMethod: order.paymentMethod,
      splitDetails: order.splitDetails,
      settledBy: order.settledBy || "Cashier",
    };
    setReceiptToPrint(receiptData);
    setIsReceiptModalOpen(true);
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Counter Sales & Register</h1>
                <p className="text-xs text-slate-500">
                  Real-time terminal register receipts, cashier collections & tender audits
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/pos"
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>+ Open POS Terminal</span>
            </Link>

            <button
              type="button"
              onClick={fetchOrders}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Register Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Counter Turnover
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{summary.totalSales.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">({summary.totalOrders} bills)</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Cash In Drawer
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                ₹{summary.cashSales.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Physical Cash</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Digital UPI Collected
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-sky-600 font-mono">
                ₹{summary.upiSales.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-sky-700 font-medium">QR / UPI</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Card POS Swipes
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">
                ₹{summary.cardSales.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">EDC Machine</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice # or customer..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {/* Staff Filter */}
            {staffNames.length > 0 && (
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">All Cashiers / Staff</option>
                {staffNames.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            )}

            {/* Date Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { label: "Today", val: "today" },
                { label: "Yesterday", val: "yesterday" },
                { label: "Last 7D", val: "last_7_days" },
                { label: "This Month", val: "this_month" },
              ].map((d) => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => setDateFilter(d.val as DateFilterType)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                    dateFilter === d.val
                      ? "bg-white text-[#5e2b9d] shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Counter Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Tender Method</th>
                  <th className="py-3 px-4 text-right">Total ₹</th>
                  <th className="py-3 px-4 text-right">Reprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading counter transactions...</span>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No register bills for this selection</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Ring up new sales through POS Billing.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => {
                    const formattedTime = new Date(o.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const itemsQty = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 1), 0);

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                          {o.billNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {formattedTime}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{o.settledBy || "Cashier"}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{o.customer?.name || "Walk-in"}</div>
                          {o.customer?.phone && (
                            <div className="text-[10px] text-slate-400">📱 {o.customer.phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {itemsQty}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              o.paymentMethod?.includes("UPI")
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : o.paymentMethod?.includes("CARD")
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {o.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{(o.grandTotal || o.total || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrint(o)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            Print Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredOrders.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="register bills"
              />
            </div>
          )}
        </div>

        {/* Receipt Modal */}
        {isReceiptModalOpen && receiptToPrint && (
          <PosReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            receiptData={receiptToPrint}
          />
        )}
      </div>
    </SoftwareLayout>
  );
}
