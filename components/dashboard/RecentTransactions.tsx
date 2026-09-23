"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Eye,
  Printer,
  X,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { Order, Product } from "./types";
import { usePrinter } from "@/context/PrinterContext";

interface RecentTransactionsProps {
  orders: Order[];
  lowStockProducts: Product[];
  storeSettings?: any;
}

export default function RecentTransactions({
  orders,
  lowStockProducts,
  storeSettings,
}: RecentTransactionsProps) {
  const { isConnected: isPrinterConnected, printerType, printReceipt, printWindow } = usePrinter();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const getPaymentBadge = (method: string, splitDetails?: any) => {
    switch (method) {
      case "CASH":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Cash
          </span>
        );
      case "UPI":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            UPI / QR
          </span>
        );
      case "CARD":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            POS Card
          </span>
        );
      case "SPLIT":
        return (
          <span
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
            title={
              splitDetails
                ? `UPI: ₹${splitDetails.upi} | Cash: ₹${splitDetails.cash} | Card: ₹${splitDetails.card}`
                : "Split Payment"
            }
          >
            Split Payment
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            {method}
          </span>
        );
    }
  };

  const handlePrintReceipt = async (orderToPrint?: Order) => {
    const target = orderToPrint || selectedOrder;
    if (!target) return;
    if (isPrinterConnected) {
      await printReceipt(target, storeSettings);
    } else {
      setSelectedOrder(target);
      setTimeout(() => {
        printWindow();
      }, 100);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Recent Settled Transactions Table - 2 cols on lg */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-50 text-[#5e2b9d]">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Recent Settled Transactions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live feed of the latest completed sales bills
            </p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-[#5e2b9d] hover:underline flex items-center gap-1"
          >
            View All Sales <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto flex-1">
          {orders.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Bill #</th>
                  <th className="py-2.5 px-4 font-semibold">Date & Time</th>
                  <th className="py-2.5 px-4 font-semibold">Customer</th>
                  <th className="py-2.5 px-4 font-semibold">Tender</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {order.billNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800">
                        {order.customer?.name || "Walk-in"}
                      </div>
                      {order.customer?.phone && (
                        <div className="text-[10px] text-slate-400">{order.customer.phone}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {getPaymentBadge(order.paymentMethod, order.splitDetails)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(order.grandTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          title="View Bill Details"
                          className="p-1 text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 rounded transition-colors cursor-pointer inline-flex items-center"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          title={isPrinterConnected ? `Print Receipt (${printerType})` : "Print Receipt"}
                          className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer inline-flex items-center"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No transactions recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Critical Low Stock Alert & Restock Card - 1 col on lg */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Stock Reorder Alerts
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Products with critical stock levels (&lt; 10 units)
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-[#5e2b9d] hover:underline flex items-center gap-1"
          >
            Manage <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-4 space-y-2.5 flex-1 overflow-y-auto max-h-[360px]">
          {lowStockProducts.length > 0 ? (
            lowStockProducts.slice(0, 6).map((prod) => (
              <div
                key={prod.id}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{prod.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {prod.categoryName || "Retail Item"} • {formatCurrency(prod.price)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      prod.stock === 0
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {prod.stock === 0 ? "Out of Stock" : `${prod.stock} left`}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs">
              All inventory levels are healthy!
            </div>
          )}
        </div>

        {/* Quick shortcut to POS billing */}
        <div className="p-3 bg-[#f8fafc] border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-medium">Ready for next bill?</span>
          <Link
            href="/pos"
            className="px-3 py-1.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Open POS Counter
          </Link>
        </div>
      </div>

      {/* Thermal Receipt Preview Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            <div className="p-3 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#5e2b9d]" /> Invoice {selectedOrder.billNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintReceipt()}
                  className="h-[28px] bg-[#5e2b9d] text-white px-2.5 rounded-[4px] text-[11px] font-semibold hover:bg-[#4e2284] cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isPrinterConnected ? `Print (${printerType})` : "Print"}</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thermal Slip Content - Fully occupying 80mm roll width */}
            <div id="thermal-receipt" className="p-4 overflow-y-auto font-mono text-[11px] space-y-2 bg-white text-slate-900 w-full">
              {/* Store Branding Header */}
              <div className="text-center pb-2.5 border-b border-dashed border-slate-400">
                <h4 className="font-sans font-bold text-sm text-slate-950 uppercase tracking-wider">
                  {storeSettings?.name || "Retail Next Store"}
                </h4>
                {storeSettings?.address && (
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {[storeSettings.address, storeSettings.city, storeSettings.state, storeSettings.pincode].filter(Boolean).join(", ")}
                  </p>
                )}
                {(storeSettings?.phone || storeSettings?.email) && (
                  <p className="text-[10px] text-slate-600">
                    {storeSettings.phone ? `Ph: ${storeSettings.phone}` : ""}
                    {storeSettings.phone && storeSettings.email ? " | " : ""}
                    {storeSettings.email || ""}
                  </p>
                )}
                {storeSettings?.enableGst !== false && storeSettings?.gstNumber && (
                  <p className="text-[10px] text-slate-800 font-semibold mt-0.5">
                    GSTIN: {storeSettings.gstNumber}
                  </p>
                )}
              </div>

              {/* Invoice Metadata */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
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
                  {selectedOrder.items.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1 pr-1">
                        <div className="leading-tight font-medium">{it.productName}</div>
                        {it.variantName && (
                          <div className="text-[9px] text-slate-500">{it.variantName}</div>
                        )}
                      </td>
                      <td className="text-center py-1 whitespace-nowrap">{it.quantity}</td>
                      <td className="text-right py-1 whitespace-nowrap">₹{Number(it.price || (it.total / (it.quantity || 1))).toFixed(2)}</td>
                      <td className="text-right py-1 font-semibold whitespace-nowrap">₹{Number(it.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="space-y-1 text-[10.5px] pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span>₹{Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-₹{Number(selectedOrder.discount).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.cgst > 0 && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>CGST:</span>
                    <span>₹{Number(selectedOrder.cgst).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.sgst > 0 && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>SGST:</span>
                    <span>₹{Number(selectedOrder.sgst).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.roundOff !== undefined && selectedOrder.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Round Off:</span>
                    <span>₹{Number(selectedOrder.roundOff).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold border-t border-dashed border-slate-400 pt-1.5 text-slate-950">
                  <span>GRAND TOTAL:</span>
                  <span className="font-extrabold">₹{Number(selectedOrder.grandTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 pt-1">
                  <span>Payment Mode:</span>
                  <span className="font-bold uppercase text-slate-900">{selectedOrder.paymentMethod}</span>
                </div>
                {selectedOrder.paymentMethod === "SPLIT" && selectedOrder.splitDetails && (
                  <div className="text-[9.5px] text-slate-500 pl-2">
                    UPI: ₹{selectedOrder.splitDetails.upi} | Cash: ₹{selectedOrder.splitDetails.cash}{" "}
                    | Card: ₹{selectedOrder.splitDetails.card}
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

            <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between print:hidden">
              <button
                onClick={() => handlePrintReceipt()}
                className="px-3.5 py-1.5 bg-[#5e2b9d] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-[#4e2284] cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isPrinterConnected ? `Print (${printerType})` : "Print Receipt"}</span>
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3.5 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
