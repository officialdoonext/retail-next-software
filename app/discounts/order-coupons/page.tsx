"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function OrderCouponsPage() {
  return (
    <ComingSoonPage
      title="Order Coupons"
      category="Discount Manager"
      description="Cart-wide promo codes, percentage or flat discounts, minimum bill thresholds, usage limit controls, and promotional date ranges."
      features={[
        "Percentage (%) and flat amount (₹) cart-level promo codes",
        "Minimum order value requirements & maximum discount caps",
        "Single-use vs multiple-use campaign rules and validity windows",
      ]}
    />
  );
}
