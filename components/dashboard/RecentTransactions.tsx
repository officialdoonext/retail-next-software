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

  const handlePrintReceipt = () => {
    window.print();
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
                      <button
                        onClick={() => setSelectedOrder(order)}
                        title="View & Print Bill"
                        className="p-1 text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 rounded transition-colors cursor-pointer inline-flex items-center"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-3 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#5e2b9d]" /> Receipt: {selectedOrder.billNumber}
              </span>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto font-mono text-xs space-y-3 bg-[#fafafa]">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <h4 className="font-bold text-sm text-slate-900">
                  {storeSettings?.name || "RetailNext Store"}
                </h4>
                <p className="text-[10px] text-slate-500">
                  {storeSettings?.address || "Store Address"}
                </p>
                {storeSettings?.gstNumber && (
                  <p className="text-[10px] text-slate-500">GSTIN: {storeSettings.gstNumber}</p>
                )}
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{selectedOrder.billNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(selectedOrder.createdAt).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{selectedOrder.customer?.name || "Walk-in"}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                {selectedOrder.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[150px]">
                      {it.productName} x {it.quantity}
                    </span>
                    <span className="font-medium">₹{it.total}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{selectedOrder.subtotal?.toFixed(2)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-₹{selectedOrder.discount?.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.cgst > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST:</span>
                    <span>₹{selectedOrder.cgst?.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.sgst > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST:</span>
                    <span>₹{selectedOrder.sgst?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-dashed border-slate-300 pt-1.5 text-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span>₹{selectedOrder.grandTotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                  <span>Payment Mode:</span>
                  <span className="font-bold uppercase">{selectedOrder.paymentMethod}</span>
                </div>
                {selectedOrder.paymentMethod === "SPLIT" && selectedOrder.splitDetails && (
                  <div className="text-[10px] text-slate-400 pl-2">
                    UPI: ₹{selectedOrder.splitDetails.upi} | Cash: ₹{selectedOrder.splitDetails.cash}{" "}
                    | Card: ₹{selectedOrder.splitDetails.card}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={handlePrintReceipt}
                className="px-3 py-1.5 bg-[#5e2b9d] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-[#4e2284] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300 cursor-pointer"
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
