"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import { DateFilterType, getDateRange, isDateInRange } from "@/lib/dateFilters";
import PosReceiptModal, { ReceiptData } from "@/components/PosReceiptModal";

interface SettledOrder {
  id: string;
  billNumber: string;
  storeId?: string;
  businessId: string;
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
  couponCode?: string;
  couponDiscount?: number;
  customerDiscount?: number;
  settledBy: string;
  createdAt: number;
}

export default function SalesPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<SettledOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Search & Payment Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Selected Order for Detail Modal / Reprint
  const [selectedOrder, setSelectedOrder] = useState<SettledOrder | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Edit Sale Modal State
  const [editingOrder, setEditingOrder] = useState<SettledOrder | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("CASH");
  const [editPaymentStatus, setEditPaymentStatus] = useState("Paid");
  const [editStatus, setEditStatus] = useState("Completed");
  const [editStaffName, setEditStaffName] = useState("");
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

  // Fetch employees list for attribution
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/employees?all=true");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.employees)) {
            setStaffList(
              data.employees.map((e: any) => ({
                id: e.id,
                name: e.name || e.staffName || "Staff",
              }))
            );
          }
        }
      } catch {
        // ignore
      }
    }
    loadEmployees();
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        toast.error(data.error || "Failed to load sales records.");
      }
    } catch (err) {
      console.error("Failed fetching sales orders:", err);
      toast.error("Network error while loading sales records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Current Date Range
  const activeDateRange = useMemo(() => {
    return getDateRange(dateFilter, customStart, customEnd);
  }, [dateFilter, customStart, customEnd]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Date Range
      if (!isDateInRange(order.createdAt, activeDateRange)) {
        return false;
      }

      // 2. Search Query (Bill #, Customer Name, Phone)
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const billMatch = (order.billNumber || "").toLowerCase().includes(q);
        const nameMatch = (order.customer?.name || "").toLowerCase().includes(q);
        const phoneMatch = (order.customer?.phone || "").toLowerCase().includes(q);
        if (!billMatch && !nameMatch && !phoneMatch) return false;
      }

      // 3. Payment Filter
      if (paymentFilter !== "all") {
        const pm = (order.paymentMethod || "").toUpperCase();
        if (paymentFilter === "SPLIT" && !pm.startsWith("SPLIT")) return false;
        if (paymentFilter !== "SPLIT" && !pm.includes(paymentFilter)) return false;
      }

      return true;
    });
  }, [orders, activeDateRange, searchQuery, paymentFilter]);

  // Top Metric Cards Calculations
  const metrics = useMemo(() => {
    const totalRev = filteredOrders.reduce((acc, o) => acc + (o.grandTotal || 0), 0);
    const count = filteredOrders.length;
    const totalTax = filteredOrders.reduce((acc, o) => acc + (o.tax || 0), 0);
    const totalDisc = filteredOrders.reduce((acc, o) => acc + (o.discount || 0), 0);
    const aov = count > 0 ? totalRev / count : 0;

    return {
      totalRev,
      count,
      totalTax,
      totalDisc,
      aov,
    };
  }, [filteredOrders]);

  // Action: Open Receipt for Reprint
  const handleOpenReceipt = (order: SettledOrder) => {
    const receiptData: ReceiptData = {
      billNumber: order.billNumber,
      createdAt: order.createdAt,
      customer: order.customer,
      items: order.items.map((it: any) => ({
        productName: it.productName,
        variantName: it.variantName,
        barcode: it.barcode,
        salePrice: it.salePrice || it.price,
        price: it.salePrice || it.price,
        quantity: it.quantity,
        taxRate: it.taxRate,
        isTaxInclusive: it.isTaxInclusive,
        taxAmount: it.taxAmount,
        subtotal: it.subtotal || it.total,
        employeeName: it.employeeName,
        employeeNumericId: it.employeeNumericId,
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      customerDiscount: order.customerDiscount,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      splitDetails: order.splitDetails,
      staffName: order.settledBy,
    };

    setReceiptToPrint(receiptData);
    setIsReceiptModalOpen(true);
  };

  // Action: Open Edit Sale Modal
  const handleOpenEdit = (order: SettledOrder) => {
    setEditingOrder(order);
    setEditCustomerName(order.customer?.name || "");
    setEditCustomerPhone(order.customer?.phone || "");
    setEditPaymentMethod(order.paymentMethod?.startsWith("SPLIT") ? "SPLIT" : order.paymentMethod || "CASH");
    setEditPaymentStatus(order.paymentStatus || "Paid");
    setEditStatus(order.status || "Completed");
    setEditStaffName(order.settledBy || "");
    setEditDiscount(Number(order.discount) || 0);

    const cleanItems = (order.items || [])
      .filter((it: any) => !it._isBillMeta)
      .map((it: any) => ({
        productId: it.productId,
        productName: it.productName || it.name || "Product",
        variantId: it.variantId || null,
        variantName: it.variantName || null,
        barcode: it.barcode || "",
        sku: it.sku || "",
        salePrice: Number(it.salePrice || it.price) || 0,
        price: Number(it.salePrice || it.price) || 0,
        quantity: Math.max(1, Number(it.quantity) || 1),
        taxRate: Number(it.taxRate) || 0,
        isTaxInclusive: it.isTaxInclusive !== false,
        taxAmount: Number(it.taxAmount) || 0,
        subtotal: Number(it.subtotal) || (Number(it.salePrice || it.price) || 0) * (Number(it.quantity) || 1),
        total: Number(it.total) || (Number(it.salePrice || it.price) || 0) * (Number(it.quantity) || 1),
        employeeId: it.employeeId || null,
        employeeName: it.employeeName || null,
      }));

    setEditItems(cleanItems);
  };

  // Update item quantity
  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setEditItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], quantity: newQty };
      const lineBase = item.price * newQty;
      item.subtotal = lineBase;
      item.total = lineBase;
      next[index] = item;
      return next;
    });
  };

  // Update item price
  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    setEditItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], price: newPrice, salePrice: newPrice };
      const lineBase = newPrice * item.quantity;
      item.subtotal = lineBase;
      item.total = lineBase;
      next[index] = item;
      return next;
    });
  };

  // Remove item from sale
  const handleRemoveItem = (index: number) => {
    if (editItems.length <= 1) {
      toast.error("A sale must contain at least one item.");
      return;
    }
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Reassign item employee attribution
  const handleUpdateItemEmployee = (index: number, empName: string) => {
    const matched = staffList.find((s) => s.name === empName);
    setEditItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        employeeName: empName || null,
        employeeId: matched?.id || null,
      };
      return next;
    });
  };

  // Live bill calculations for edit modal
  const editCalculations = useMemo(() => {
    const rawSubtotal = editItems.reduce(
      (acc, it) => acc + (Number(it.price || it.salePrice) || 0) * (Number(it.quantity) || 1),
      0
    );

    const totalTax = editItems.reduce((acc, it) => {
      const rate = Number(it.taxRate) || 0;
      if (rate <= 0) return acc;
      const lineTotal = (Number(it.price || it.salePrice) || 0) * (Number(it.quantity) || 1);
      if (it.isTaxInclusive !== false) {
        const taxable = (lineTotal * 100) / (100 + rate);
        return acc + (lineTotal - taxable);
      } else {
        return acc + (lineTotal * rate) / 100;
      }
    }, 0);

    const discountVal = Math.max(0, Number(editDiscount) || 0);
    const grandTotal = Math.max(0, Math.round((rawSubtotal - discountVal) * 100) / 100);

    return {
      subtotal: Math.round(rawSubtotal * 100) / 100,
      tax: Math.round(totalTax * 100) / 100,
      discount: discountVal,
      grandTotal,
    };
  }, [editItems, editDiscount]);

  // Submit sale edit
  const handleSaveEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    if (editItems.length === 0) {
      toast.error("Sale must have at least one product item.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: editingOrder.id,
          customerName: editCustomerName.trim() || "Walk-in Customer",
          customerPhone: editCustomerPhone.trim(),
          paymentMethod: editPaymentMethod,
          paymentStatus: editPaymentStatus,
          status: editStatus,
          staffName: editStaffName.trim(),
          items: editItems,
          subtotal: editCalculations.subtotal,
          discount: editCalculations.discount,
          tax: editCalculations.tax,
          grandTotal: editCalculations.grandTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update sale.");
      } else {
        toast.success(`Sale #${editingOrder.billNumber} updated successfully!`);
        setOrders((prev) =>
          prev.map((o) => (o.id === editingOrder.id ? { ...o, ...data.order } : o))
        );
        setEditingOrder(null);
      }
    } catch {
      toast.error("Network error while updating sale.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const DATE_FILTER_BUTTONS: { type: DateFilterType; label: string }[] = [
    { type: "today", label: "Today" },
    { type: "yesterday", label: "Yesterday" },
    { type: "this_week", label: "This Week" },
    { type: "last_week", label: "Last Week" },
    { type: "this_month", label: "This Month" },
    { type: "last_month", label: "Last Month" },
    { type: "this_year", label: "This Year" },
    { type: "last_year", label: "Last Year" },
    { type: "custom", label: "Custom Date" },
  ];

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 sm:space-y-6 font-sans pb-12">
        
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Sales Ledger & Invoices</span>
              <span className="text-xs bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded-full font-mono font-bold border border-purple-200">
                {filteredOrders.length} Invoices
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete chronological ledger of all settled point of sale bills, customer purchases & tax accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : <span>↻</span>}
            <span>Refresh</span>
          </button>
        </div>

        {/* ==================================================================== */}
        {/* DATE FILTER BUTTONS & CUSTOM RANGE PICKER                            */}
        {/* ==================================================================== */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Date Filter:</span>
            </span>

            <span className="text-xs font-semibold text-[#5e2b9d] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
              Active: {activeDateRange.label} (
              {activeDateRange.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} -{" "}
              {activeDateRange.endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_FILTER_BUTTONS.map((btn) => (
              <button
                key={btn.type}
                type="button"
                onClick={() => setDateFilter(btn.type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === btn.type
                    ? "bg-[#5e2b9d] text-white shadow-xs font-bold"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if 'custom' is active */}
          {dateFilter === "custom" && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-slate-600">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-slate-600">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* KPI METRIC CARDS                                                     */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Revenue
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{metrics.totalRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Invoices Settled
            </span>
            <div className="text-xl font-extrabold text-[#5e2b9d] font-mono mt-1">
              {metrics.count}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Avg. Basket Value
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{metrics.aov.toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Discounts
            </span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono mt-1">
              ₹{metrics.totalDisc.toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              GST Tax Collected
            </span>
            <div className="text-xl font-extrabold text-slate-700 font-mono mt-1">
              ₹{metrics.totalTax.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SEARCH & PAYMENT FILTER TOOLBAR                                      */}
        {/* ==================================================================== */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bill #, Customer Name, Mobile..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Tender:</span>
            {(["all", "CASH", "UPI", "CARD", "SPLIT"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentFilter(method)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer uppercase ${
                  paymentFilter === method
                    ? "bg-slate-900 text-white font-bold"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {method}
              </button>
            ))}
          </div>

        </div>

        {/* ==================================================================== */}
        {/* INVOICES TABLE REGISTER                                              */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Payment Tender</th>
                  <th className="py-3 px-4 text-right">Tax</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading invoices ledger...</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                        <svg className="w-6 h-6 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-slate-700">No settled bills found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Try adjusting your date range or search query.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const formattedDate = new Date(order.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    });
                    const itemsCount = (order.items || []).reduce(
                      (sum, it) => sum + (Number(it.quantity) || 1),
                      0
                    );

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Invoice Number */}
                        <td className="py-3 px-4 font-mono font-bold text-[#5e2b9d]">
                          {order.billNumber}
                        </td>

                        {/* 2. Date */}
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* 3. Customer */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {order.customer?.name || "Walk-in Customer"}
                          </div>
                          {order.customer?.phone && (
                            <div className="text-[10.5px] text-slate-400">
                              📱 {order.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* 4. Items Count */}
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {itemsCount}
                        </td>

                        {/* 5. Payment Tender */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              order.paymentMethod?.startsWith("SPLIT")
                                ? "bg-purple-100 text-[#5e2b9d]"
                                : order.paymentMethod?.includes("UPI")
                                ? "bg-sky-100 text-sky-800"
                                : order.paymentMethod?.includes("CARD")
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {order.paymentMethod}
                          </span>
                        </td>

                        {/* 6. Tax */}
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          ₹{(order.tax || 0).toFixed(2)}
                        </td>

                        {/* 7. Discount */}
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                          {order.discount > 0 ? `-₹${order.discount.toFixed(2)}` : "—"}
                        </td>

                        {/* 8. Grand Total */}
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                          ₹{order.grandTotal.toFixed(2)}
                        </td>

                        {/* 9. Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                              title="View line items & attribution"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(order)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1"
                              title="Edit Sale / Invoice"
                            >
                              <svg className="w-3 h-3 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(order)}
                              className="px-2.5 py-1 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-lg text-[11px] font-semibold shadow-2xs cursor-pointer transition-colors"
                              title="Reprint thermal receipt"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* INVOICE DETAILS MODAL                                                */}
        {/* ==================================================================== */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
              
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Invoice Details</h3>
                  <p className="text-[11px] text-purple-200">#{selectedOrder.billNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Customer & Bill Meta */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                    <span className="font-bold text-slate-900 block text-xs mt-0.5">
                      {selectedOrder.customer?.name || "Walk-in Customer"}
                    </span>
                    {selectedOrder.customer?.phone && (
                      <span className="text-[11px] text-slate-500">📱 {selectedOrder.customer.phone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed At</span>
                    <span className="font-semibold text-slate-800 block text-xs mt-0.5">
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500">Cashier: {selectedOrder.settledBy}</span>
                  </div>
                </div>

                {/* Line Items Table with Employee Attribution */}
                <div>
                  <h4 className="font-bold text-xs text-slate-800 mb-2">Itemized Breakdown & Salesperson Attribution</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2.5">Item</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right">Price</th>
                          <th className="p-2.5">Attributed Employee</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {selectedOrder.items.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-semibold text-slate-800">
                              {it.productName}
                              {it.variantName && (
                                <span className="text-[10px] text-purple-600 font-normal ml-1">
                                  ({it.variantName})
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                            <td className="p-2.5 text-right font-mono">₹{it.salePrice || it.price}</td>
                            <td className="p-2.5">
                              {it.employeeName ? (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded font-semibold text-[10px] border border-purple-200">
                                  <span>{it.employeeName}</span>
                                  {it.employeeNumericId && (
                                    <span className="font-mono text-purple-500">#{it.employeeNumericId}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10.5px] text-slate-400">Unassigned</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              ₹{(it.subtotal || it.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ""}:</span>
                      <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST Tax:</span>
                      <span>₹{selectedOrder.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-[#5e2b9d]">₹{selectedOrder.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenReceipt(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="px-4 py-2 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Receipt</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* EDIT SALE MODAL                                                      */}
        {/* ==================================================================== */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
              
              {/* Header */}
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                    <span>Edit Sale / Invoice</span>
                    <span className="font-mono text-purple-200 text-xs">#{editingOrder.billNumber}</span>
                  </h3>
                  <p className="text-[11px] text-purple-200">
                    Modify customer details, payment tender, line item quantities, and salesperson attribution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditSale} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                  
                  {/* Section 1: Customer Information */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90 space-y-3">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                      1. Customer Information
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={editCustomerName}
                          onChange={(e) => setEditCustomerName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar or Walk-in Customer"
                          className="w-full h-8 px-2.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Customer Mobile Number
                        </label>
                        <input
                          type="text"
                          value={editCustomerPhone}
                          onChange={(e) => setEditCustomerPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full h-8 px-2.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Payment, Status & Cashier */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90 space-y-3">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                      2. Payment & Order Status
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Payment Method
                        </label>
                        <select
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value)}
                          className="w-full h-8 px-2 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        >
                          <option value="CASH">CASH</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">CARD</option>
                          <option value="SPLIT">SPLIT</option>
                          <option value="CREDIT">STORE CREDIT</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Payment Status
                        </label>
                        <select
                          value={editPaymentStatus}
                          onChange={(e) => setEditPaymentStatus(e.target.value)}
                          className="w-full h-8 px-2 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                          <option value="Partial">Partial</option>
                          <option value="Refunded">Refunded</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Order Status
                        </label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full h-8 px-2 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        >
                          <option value="Completed">Completed</option>
                          <option value="Returned">Returned</option>
                          <option value="Exchanged">Exchanged</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Billed By / Cashier
                        </label>
                        <input
                          type="text"
                          value={editStaffName}
                          onChange={(e) => setEditStaffName(e.target.value)}
                          placeholder="Cashier name"
                          className="w-full h-8 px-2.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Line Items, Quantities & Attribution */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 text-[11px] uppercase tracking-wider border-b border-slate-200 flex items-center justify-between">
                      <span>3. Billed Products ({editItems.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">Adjust quantity, price or staff attribution</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/60 text-slate-500 font-semibold text-[10px] uppercase border-b border-slate-200">
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-3 text-right">Price (₹)</th>
                            <th className="py-2 px-3 text-center">Quantity</th>
                            <th className="py-2 px-3">Salesperson</th>
                            <th className="py-2 px-3 text-right">Line Total</th>
                            <th className="py-2 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {editItems.map((item, idx) => {
                            const lineTotal = (Number(item.price || item.salePrice) || 0) * (Number(item.quantity) || 1);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 max-w-[200px]">
                                  <span className="font-semibold text-slate-900 block truncate">
                                    {item.productName || item.sku || "Product"}
                                  </span>
                                  {item.variantName && (
                                    <span className="text-[10px] text-[#5e2b9d] font-medium block">
                                      {item.variantName}
                                    </span>
                                  )}
                                  {item.barcode && (
                                    <span className="text-[9px] font-mono text-slate-400 block">
                                      {item.barcode}
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                                    className="w-20 h-7 px-1.5 text-right font-mono text-xs border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </td>

                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1 border border-slate-200 rounded bg-white p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                      disabled={item.quantity <= 1}
                                      className="w-5 h-5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 flex items-center justify-center font-bold cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value, 10) || 1)}
                                      className="w-10 text-center font-bold text-xs bg-transparent focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                      className="w-5 h-5 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <select
                                    value={item.employeeName || ""}
                                    onChange={(e) => handleUpdateItemEmployee(idx, e.target.value)}
                                    className="h-7 px-2 border border-slate-200 rounded bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#5e2b9d]"
                                  >
                                    <option value="">No Staff Attributed</option>
                                    {staffList.map((st) => (
                                      <option key={st.id} value={st.name}>
                                        {st.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                                  ₹{lineTotal.toFixed(2)}
                                </td>

                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    disabled={editItems.length <= 1}
                                    className="w-6 h-6 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-20"
                                    title="Remove item from sale"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 4: Discount & Live Recalculated Summary */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90 space-y-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                      4. Discount & Bill Totals
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Bill Discount Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editDiscount}
                          onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                          className="w-full h-8 px-2.5 rounded-[6px] border border-slate-200 bg-white text-xs font-mono font-semibold text-rose-600 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>

                      <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Gross Subtotal:</span>
                          <span>₹{editCalculations.subtotal.toFixed(2)}</span>
                        </div>
                        {editCalculations.discount > 0 && (
                          <div className="flex justify-between text-rose-600 font-medium">
                            <span>Discount:</span>
                            <span>-₹{editCalculations.discount.toFixed(2)}</span>
                          </div>
                        )}
                        {editCalculations.tax > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>GST Tax:</span>
                            <span>₹{editCalculations.tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-emerald-700 pt-1 border-t border-slate-200">
                          <span>Recalculated Grand Total:</span>
                          <span>₹{editCalculations.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
                  <span className="text-xs text-slate-500">
                    Total: <b className="text-slate-900 font-mono">₹{editCalculations.grandTotal.toFixed(2)}</b>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingOrder(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      className="px-4 py-2 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isSavingEdit ? (
                        <>
                          <Spinner className="w-3.5 h-3.5" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Sale Changes</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* Printable Receipt Modal */}
        <PosReceiptModal
          isOpen={isReceiptModalOpen}
          receipt={receiptToPrint}
          onClose={() => setIsReceiptModalOpen(false)}
          onNewSale={() => setIsReceiptModalOpen(false)}
        />

      </div>
    </SoftwareLayout>
  );
}
