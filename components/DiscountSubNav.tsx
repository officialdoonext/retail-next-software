"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DiscountSubNav() {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Order Coupons",
      href: "/discounts/order-coupons",
      description: "Cart-wide promo codes & bill thresholds",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
    },
    {
      label: "Product Coupons",
      href: "/discounts/product-coupons",
      description: "SKU, Category, BOGO & Bundles",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      label: "Customer Coupons",
      href: "/discounts/customer-coupons",
      description: "VIP, Birthday & Individual vouchers",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 border-b border-slate-200/80">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`h-[34px] px-3.5 rounded-[6px] text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
              isActive
                ? "bg-[#5e2b9d] text-white shadow-xs font-semibold"
                : "bg-white text-slate-600 hover:text-slate-900 hover:bg-purple-50/50 border border-slate-200/90"
            }`}
          >
            <span className={isActive ? "text-white" : "text-[#5e2b9d]"}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
