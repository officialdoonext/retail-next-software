"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import { usePrinter } from "@/context/PrinterContext";

interface OrderCustomer {
  id?: string;
  name: string;
  phone?: string;
  city?: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  barcode?: string;
  sku?: string;
  price: number;
  quantity: number;
  total: number;
}

interface Order {
  id: string;
  billNumber: string;
  storeId: string;
  status: string;
  customer?: OrderCustomer;
  items: OrderItem[];
  totalItemsCount: number;
  subtotal: number;
  discount: number;
  discountType?: string;
  cgst: number;
  sgst: number;
  cgstPercent?: number;
  sgstPercent?: number;
  isPriceInclusiveGst?: boolean;
  roundOff?: number;
  grandTotal: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "SPLIT";
  splitDetails?: { upi: number; cash: number; card: number } | null;
  notes?: string;
  settledBy?: string;
  createdAt: number;
}

interface StoreSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string;
  enableGst: boolean;
}

export default function OrdersPage() {
  const toast = useToast();
  const { isConnected: isPrinterConnected, printerType, printReceipt, printWindow } = usePrinter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL"); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH

  // Selected Order for Receipt Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch sales records & store profile
  const loadOrders = async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/settings"),
      ]);

      const [ordersData, settingsData] = await Promise.all([
        ordersRes.json(),
        settingsRes.json(),
      ]);

      if (ordersRes.ok && ordersData.success) {
        setOrders(ordersData.orders || []);
      } else {
        toast.error(ordersData.error || "Failed to load sales.");
      }

      if (settingsRes.ok && settingsData.success) {
        setStoreSettings(settingsData.settings || null);
      }
    } catch {
      toast.error("Network error while fetching sales records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Direct print trigger: prints directly via thermal ESC/POS or browser print dialog
  const handleDirectPrint = async (order: Order) => {
    setSelectedOrder(order);
    if (isPrinterConnected) {
      await printReceipt(order, storeSettings);
    } else {
      setTimeout(() => {
        printWindow();
      }, 120);
    }
  };

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - now.getDay() * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((order) => {
      // 1. Search Query
      const matchSearch =
        !q ||
        order.billNumber.toLowerCase().includes(q) ||
        (order.customer?.name && order.customer.name.toLowerCase().includes(q)) ||
        (order.customer?.phone && order.customer.phone.includes(q)) ||
        (order.customer?.city && order.customer.city.toLowerCase().includes(q)) ||
        order.items.some((it) => it.productName.toLowerCase().includes(q));

      // 2. Payment Method Filter
      const matchPayment =
        paymentFilter === "ALL" || order.paymentMethod === paymentFilter;

      // 3. Date Filter
      let matchDate = true;
      if (dateFilter === "TODAY") {
        matchDate = order.createdAt >= startOfToday;
      } else if (dateFilter === "YESTERDAY") {
        matchDate = order.createdAt >= startOfYesterday && order.createdAt < startOfToday;
      } else if (dateFilter === "THIS_WEEK") {
        matchDate = order.createdAt >= startOfWeek;
      } else if (dateFilter === "THIS_MONTH") {
        matchDate = order.createdAt >= startOfMonth;
      }

      return matchSearch && matchPayment && matchDate;
    });
  }, [orders, searchQuery, paymentFilter, dateFilter]);

  // Overall KPI Metrics based on filtered records
  const stats = useMemo(() => {
    let totalRev = 0;
    let cashRev = 0;
    let upiRev = 0;
    let cardRev = 0;

    filteredOrders.forEach((o) => {
      totalRev += o.grandTotal;
      if (o.paymentMethod === "CASH") {
        cashRev += o.grandTotal;
      } else if (o.paymentMethod === "UPI") {
        upiRev += o.grandTotal;
      } else if (o.paymentMethod === "CARD") {
        cardRev += o.grandTotal;
      } else if (o.paymentMethod === "SPLIT" && o.splitDetails) {
        cashRev += Number(o.splitDetails.cash) || 0;
        upiRev += Number(o.splitDetails.upi) || 0;
        cardRev += Number(o.splitDetails.card) || 0;
      }
    });

    return {
      totalRevenue: totalRev,
      settledBillsCount: filteredOrders.length,
      cashRevenue: cashRev,
      upiRevenue: upiRev,
      cardRevenue: cardRev,
    };
  }, [filteredOrders]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans space-y-3">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-medium text-slate-900 leading-none">Sales & Orders</h1>
              <span className="bg-purple-50 text-[#5e2b9d] text-xs font-mono font-medium px-2 py-0.5 rounded-full">
                {orders.length} Settled Bills
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-1">
              Track real-time settled sales, revenue collections, and customer receipts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOrders}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Refresh</span>
            </button>
            <a
              href="/pos"
              className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Bill (POS)</span>
            </a>
          </div>
        </div>

        {/* METRICS STATS CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Settled Bills Count */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wide block">
              Settled Bills
            </span>
            <div className="text-base font-mono font-medium text-[#5e2b9d] mt-1">
              {stats.settledBillsCount}
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Completed invoices</span>
          </div>

          {/* Cash Collection */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wide block">
              Cash Received
            </span>
            <div className="text-base font-mono font-medium text-emerald-700 mt-1">
              ₹{stats.cashRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Physical cash counter</span>
          </div>

          {/* UPI Collection */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wide block">
              UPI Received
            </span>
            <div className="text-base font-mono font-medium text-blue-700 mt-1">
              ₹{stats.upiRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-normal">QR & digital payments</span>
          </div>

          {/* Card Collection */}
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wide block">
              Card Received
            </span>
            <div className="text-base font-mono font-medium text-purple-700 mt-1">
              ₹{stats.cardRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Debit / Credit POS</span>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs flex flex-col md:flex-row items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bill #, customer name, mobile, or item..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
            />
          </div>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-[34px] max-h-[34px] w-full md:w-36 bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] cursor-pointer"
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="SPLIT">Split</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-[34px] max-h-[34px] w-full md:w-36 bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
          </select>
        </div>

        {/* ORDERS TABLE VIEW */}
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-normal">Loading store sales history...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery || paymentFilter !== "ALL" || dateFilter !== "ALL"
                ? "No matching sales records found"
                : "No sales recorded yet"}
            </h3>
            <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mb-4">
              {searchQuery || paymentFilter !== "ALL" || dateFilter !== "ALL"
                ? "Try adjusting your search criteria or date filter."
                : "Bills settled on the Billing (POS) page will automatically appear here with complete payment details and receipt invoices."}
            </p>
            <a
              href="/pos"
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              Go to Billing (POS)
            </a>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="py-2.5 px-3.5">Bill / Invoice #</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Items Purchased</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((o, oIdx) => (
                    <tr key={o.id || `order_${o.billNumber}_${oIdx}`} className="hover:bg-slate-50/70 transition-colors">
                      {/* Bill / Invoice # */}
                      <td className="py-2.5 px-3.5">
                        <span className="font-mono font-medium text-slate-900 text-[11.5px] block">
                          {o.billNumber}
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-[3px] font-medium inline-block mt-0.5">
                          Settled
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3 text-slate-600 font-normal whitespace-nowrap">
                        <div className="text-[11.5px]">
                          {new Date(o.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-mono">
                          {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 leading-tight">
                          {o.customer?.name || "Walk-in Customer"}
                        </div>
                        {o.customer?.phone ? (
                          <div className="text-[10.5px] font-mono text-slate-500 mt-0.5">
                            {o.customer.phone} {o.customer.city ? `• ${o.customer.city}` : ""}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">No phone</span>
                        )}
                      </td>

                      {/* Items Purchased Preview */}
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <span className="font-medium text-slate-800">
                          {o.totalItemsCount || o.items.length} items
                        </span>
                        <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                          {o.items.map((it) => it.productName).join(", ")}
                        </div>
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] inline-block ${
                            o.paymentMethod === "CASH"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : o.paymentMethod === "UPI"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : o.paymentMethod === "CARD"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : "bg-amber-50 text-amber-800 border border-amber-200/60"
                          }`}
                        >
                          {o.paymentMethod}
                        </span>
                        {o.paymentMethod === "SPLIT" && o.splitDetails && (
                          <div className="text-[9.5px] font-mono text-slate-400 mt-0.5">
                            C:{o.splitDetails.cash} U:{o.splitDetails.upi} K:{o.splitDetails.card}
                          </div>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-medium text-slate-900 text-xs">
                          ₹{o.grandTotal.toFixed(2)}
                        </div>
                        {o.discount > 0 && (
                          <span className="text-[10px] text-rose-500 font-mono block">
                            Disc: -₹{o.discount.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Action: View Receipt & Direct Print */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="h-[28px] max-h-[28px] px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="View Receipt Details"
                          >
                            <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectPrint(o)}
                            className="h-[28px] max-h-[28px] px-2.5 rounded-[4px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Directly Print Bill"
                          >
                            <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.056-.367-2.155-.367-3.28 0-4.418 3.582-8 8-8s8 3.582 8 8a7.965 7.965 0 01-.367 3.28m-15.266 0A7.962 7.962 0 004 10.549c0 4.418 3.582 8 8 8a7.96 7.96 0 006.72-3.69m-14.72 0h14.72" />
                            </svg>
                            <span>Print</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRINTABLE RECEIPT / INVOICE MODAL */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Receipt Header (Screen only) */}
              <div className="p-3 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between print:hidden">
                <span className="text-xs font-medium text-slate-700">Invoice {selectedOrder.billNumber}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isPrinterConnected) {
                        await printReceipt(selectedOrder, storeSettings);
                      } else {
                        printWindow();
                      }
                    }}
                    className="h-[28px] bg-[#5e2b9d] text-white px-2.5 rounded-[4px] text-[11px] font-medium hover:bg-[#4e2284] cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.056-.367-2.155-.367-3.28 0-4.418 3.582-8 8-8s8 3.582 8 8a7.965 7.965 0 01-.367 3.28m-15.266 0A7.962 7.962 0 004 10.549c0 4.418 3.582 8 8 8a7.96 7.96 0 006.72-3.69m-14.72 0h14.72" />
                    </svg>
                    <span>{isPrinterConnected ? `Print (${printerType})` : "Print"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Thermal Slip Content - Fully occupying 80mm roll width */}
              <div id="thermal-receipt" className="p-4 text-[11px] font-mono text-slate-900 space-y-2 max-h-[75vh] overflow-y-auto w-full">
                {/* Store Branding Header */}
                <div className="text-center border-b border-dashed border-slate-400 pb-2.5">
                  <div className="font-sans font-bold text-sm text-slate-950 tracking-wider uppercase">
                    {storeSettings?.name || "Retail Next Store"}
                  </div>
                  {storeSettings?.address && (
                    <div className="text-[10px] text-slate-600 font-normal mt-0.5">
                      {[storeSettings.address, storeSettings.city, storeSettings.state, storeSettings.pincode].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {(storeSettings?.phone || storeSettings?.email) && (
                    <div className="text-[10px] text-slate-600 font-normal">
                      {storeSettings.phone ? `Ph: ${storeSettings.phone}` : ""}
                      {storeSettings.phone && storeSettings.email ? " | " : ""}
                      {storeSettings.email || ""}
                    </div>
                  )}
                  {storeSettings?.enableGst && storeSettings.gstNumber && (
                    <div className="text-[10px] text-slate-800 font-semibold mt-0.5">
                      GSTIN: {storeSettings.gstNumber}
                    </div>
                  )}
                </div>

                {/* Metadata Details */}
                <div className="border-b border-dashed border-slate-400 pb-2 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Invoice:</span>
                    <span className="font-bold">{selectedOrder.billNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date & Time:</span>
                    <span>{new Date(selectedOrder.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Customer:</span>
                    <span className="font-semibold">{selectedOrder.customer?.name || "Walk-in Customer"}</span>
                  </div>
                  {selectedOrder.customer?.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Phone:</span>
                      <span>{selectedOrder.customer.phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer?.city && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">City:</span>
                      <span>{selectedOrder.customer.city}</span>
                    </div>
                  )}
                  {selectedOrder.settledBy && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Billed By:</span>
                      <span>{selectedOrder.settledBy}</span>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <table className="w-full text-[10px] border-b border-dashed border-slate-400 pb-2">
                  <thead>
                    <tr className="text-slate-700 border-b border-slate-300 font-semibold">
                      <th className="text-left pb-1 font-semibold">Item</th>
                      <th className="text-center pb-1 font-semibold">Qty</th>
                      <th className="text-right pb-1 font-semibold">Rate</th>
                      <th className="text-right pb-1 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((it, i) => (
                      <tr key={it.variantId || it.productId || `order_item_${i}`}>
                        <td className="py-1 pr-1">
                          <div className="leading-tight font-medium">{it.productName}</div>
                          {it.variantName && (
                            <div className="text-[9px] text-slate-500">{it.variantName}</div>
                          )}
                        </td>
                        <td className="text-center py-1 whitespace-nowrap">{it.quantity}</td>
                        <td className="text-right py-1 whitespace-nowrap">₹{Number(it.price).toFixed(2)}</td>
                        <td className="text-right py-1 font-semibold whitespace-nowrap">₹{Number(it.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Breakdown */}
                <div className="text-[10.5px] space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Items:</span>
                    <span>{selectedOrder.items.length} ({selectedOrder.totalItemsCount || selectedOrder.items.reduce((s, it) => s + it.quantity, 0)} pcs)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.cgst > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>CGST:</span>
                      <span>₹{selectedOrder.cgst.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.sgst > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>SGST:</span>
                      <span>₹{selectedOrder.sgst.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.roundOff !== undefined && selectedOrder.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Round Off:</span>
                      <span>₹{selectedOrder.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-dashed border-slate-400 text-slate-950">
                    <span>GRAND TOTAL:</span>
                    <span className="font-extrabold">₹{selectedOrder.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 pt-1">
                    <span>Payment Mode:</span>
                    <span className="font-bold uppercase text-slate-900">{selectedOrder.paymentMethod}</span>
                  </div>
                  {selectedOrder.paymentMethod === "SPLIT" && selectedOrder.splitDetails && (
                    <div className="text-[9.5px] text-slate-500 pl-2">
                      UPI: ₹{selectedOrder.splitDetails.upi} | Cash: ₹{selectedOrder.splitDetails.cash} | Card: ₹{selectedOrder.splitDetails.card}
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div className="text-[9.5px] text-slate-500 pt-1 italic">
                      Note: {selectedOrder.notes}
                    </div>
                  )}
                </div>

                {/* Footer Note */}
                <div className="text-center text-[9.5px] text-slate-500 pt-3 border-t border-dashed border-slate-300">
                  <div>Thank you for shopping with us!</div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">Please visit again</div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="h-[32px] max-h-[32px] px-4 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
