"use client";

import React, { useRef } from "react";
import { usePrinter } from "@/context/PrinterContext";

export interface ReceiptItem {
  productName: string;
  variantName?: string | null;
  barcode?: string;
  listPrice?: number;
  salePrice: number;
  price: number;
  quantity: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
  taxAmount?: number;
  taxableAmount?: number;
  subtotal: number;
  employeeName?: string | null;
  employeeNumericId?: string | null;
}

export interface ReceiptData {
  billNumber: string;
  createdAt: number | string;
  storeName?: string;
  storeAddress?: string;
  storeGst?: string;
  storePhone?: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discount: number;
  couponCode?: string | null;
  couponDiscount?: number;
  customerDiscount?: number;
  grandTotal: number;
  paymentMethod: string;
  splitDetails?: {
    cash?: number;
    upi?: number;
    card?: number;
  } | null;
  staffName?: string;
}

interface PosReceiptModalProps {
  isOpen: boolean;
  receipt: ReceiptData | null;
  onClose: () => void;
  onNewSale: () => void;
}

export default function PosReceiptModal({
  isOpen,
  receipt,
  onClose,
  onNewSale,
}: PosReceiptModalProps) {
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const { isConnected: printerConnected, printReceipt } = usePrinter();

  if (!isOpen || !receipt) return null;

  const handlePrint = async () => {
    // If thermal printer hardware is connected via WebUSB / Serial / ESC-POS
    if (printerConnected && printReceipt) {
      try {
        const ok = await printReceipt(receipt);
        if (ok) return;
      } catch (e) {
        console.warn("Direct thermal print fallback to browser print:", e);
      }
    }

    // Standard browser print
    window.print();
  };

  const formattedDate = new Date(receipt.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        
        {/* Header Bar */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Bill Settled Successfully!</h3>
              <p className="text-[11px] text-purple-200">{receipt.billNumber}</p>
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

        {/* Printable Receipt Paper Container */}
        <div className="p-5 overflow-y-auto bg-slate-50 flex-1">
          <div
            ref={receiptPrintRef}
            id="pos-thermal-receipt"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm font-mono text-xs text-slate-800 space-y-3"
          >
            {/* Store Branding */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900">
                {receipt.storeName || "Retail Next Store"}
              </h2>
              {receipt.storeAddress && (
                <p className="text-[10.5px] text-slate-500 mt-0.5">{receipt.storeAddress}</p>
              )}
              {receipt.storePhone && (
                <p className="text-[10px] text-slate-500">Ph: {receipt.storePhone}</p>
              )}
              {receipt.storeGst && (
                <p className="text-[10px] text-slate-500">GSTIN: {receipt.storeGst}</p>
              )}
            </div>

            {/* Bill Meta */}
            <div className="text-[10.5px] space-y-1 border-b border-dashed border-slate-300 pb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-bold text-slate-900">{receipt.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">
                  {receipt.customer?.name || "Walk-in Customer"}
                </span>
              </div>
              {receipt.customer?.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Mobile:</span>
                  <span>{receipt.customer.phone}</span>
                </div>
              )}
              {receipt.staffName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span>{receipt.staffName}</span>
                </div>
              )}
            </div>

            {/* Itemized Table */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between font-bold text-[11px] text-slate-900 pb-1 border-b border-slate-200">
                <span className="w-1/2">Item Description</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/6 text-right">Rate</span>
                <span className="w-1/6 text-right">Amt</span>
              </div>

              {receipt.items.map((it, idx) => (
                <div key={idx} className="text-[11px] leading-tight">
                  <div className="flex justify-between items-start">
                    <span className="w-1/2 font-semibold text-slate-800 truncate">
                      {it.productName}
                      {it.variantName && <span className="text-[9.5px] text-purple-600 font-normal ml-1">({it.variantName})</span>}
                    </span>
                    <span className="w-1/6 text-center font-bold text-slate-700">{it.quantity}</span>
                    <span className="w-1/6 text-right text-slate-600">₹{it.salePrice.toFixed(0)}</span>
                    <span className="w-1/6 text-right font-bold text-slate-900">₹{it.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Item Sub-info: Tax breakdown & Employee attribution */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 pl-1 mt-0.5">
                    <span>
                      {it.taxRate ? `${it.isTaxInclusive ? "Incl" : "Excl"} ${it.taxRate}% GST (₹${(it.taxAmount || 0).toFixed(1)})` : "Tax Exempt"}
                    </span>
                    {it.employeeName && (
                      <span className="text-[#5e2b9d] font-medium">
                        Rep: {it.employeeName} {it.employeeNumericId ? `#${it.employeeNumericId}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Gross):</span>
                <span>₹{receipt.subtotal.toFixed(2)}</span>
              </div>

              {receipt.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>
                    Discount {receipt.couponCode ? `(${receipt.couponCode})` : ""}:
                  </span>
                  <span>-₹{receipt.discount.toFixed(2)}</span>
                </div>
              )}

              {receipt.tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total GST:</span>
                  <span>₹{receipt.tax.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>GRAND TOTAL:</span>
                <span className="text-sm font-extrabold text-[#5e2b9d]">
                  ₹{receipt.grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Payment Mode:</span>
                <span className="font-semibold text-slate-800 uppercase">{receipt.paymentMethod}</span>
              </div>
            </div>

            {/* Receipt Footer Message */}
            <div className="text-center pt-1 text-[10px] text-slate-500">
              <p className="font-semibold text-slate-700">Thank you for your purchase!</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Goods once sold can be exchanged within 7 days.</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={onNewSale}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Bill</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
