"use client";

import React from "react";
import { CouponItem, formatDiscountDisplay } from "@/lib/coupons";

interface PosCouponsModalProps {
  isOpen: boolean;
  coupons: CouponItem[];
  appliedCoupon: CouponItem | null;
  cartSubtotal: number;
  onClose: () => void;
  onApplyCoupon: (coupon: CouponItem) => void;
  onRemoveCoupon: () => void;
}

export default function PosCouponsModal({
  isOpen,
  coupons,
  appliedCoupon,
  cartSubtotal,
  onClose,
  onApplyCoupon,
  onRemoveCoupon,
}: PosCouponsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Available Coupons & Offers</h3>
              <p className="text-[11px] text-purple-200">
                {coupons.length} promotional {coupons.length === 1 ? "offer" : "offers"} ready to apply
              </p>
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

        {/* Coupons list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50">
          {coupons.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-700">No Eligible Coupons Found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cart subtotal does not meet minimum order requirements or no active coupons match this customer.
              </p>
            </div>
          ) : (
            coupons.map((coupon) => {
              const isApplied = appliedCoupon?.id === coupon.id;
              const meetsMinOrder = !coupon.minOrderValue || cartSubtotal >= coupon.minOrderValue;

              return (
                <div
                  key={coupon.id}
                  className={`bg-white p-3.5 rounded-xl border transition-all ${
                    isApplied
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                      : "border-slate-200 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-purple-50 text-[#5e2b9d] border border-purple-200/80 px-2 py-0.5 rounded tracking-wide">
                          {coupon.code}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
                          {coupon.type} Coupon
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1.5 truncate">
                        {coupon.title}
                      </h4>

                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Get{" "}
                        <span className="font-bold text-slate-800">
                          {formatDiscountDisplay(coupon)}
                        </span>
                        {coupon.minOrderValue ? ` on orders above ₹${coupon.minOrderValue}` : ""}
                        {coupon.maxDiscountCap ? ` (Cap: ₹${coupon.maxDiscountCap})` : ""}
                      </p>

                      {coupon.description && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{coupon.description}</p>
                      )}

                      {!meetsMinOrder && coupon.minOrderValue && (
                        <p className="text-[10px] text-rose-500 font-medium mt-1">
                          Add ₹{(coupon.minOrderValue - cartSubtotal).toFixed(0)} more to unlock this offer
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {isApplied ? (
                        <button
                          type="button"
                          onClick={() => onRemoveCoupon()}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!meetsMinOrder}
                          onClick={() => {
                            onApplyCoupon(coupon);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
