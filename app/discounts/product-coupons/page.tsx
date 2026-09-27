"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function ProductCouponsPage() {
  return (
    <ComingSoonPage
      title="Product Coupons"
      category="Discount Manager"
      description="Item-specific and category-specific discounts, BOGO (Buy One Get One) offers, bundle promotions, and seasonal clearances."
      features={[
        "Targeted SKU, brand or category-level discount rules",
        "Buy X Get Y (BOGO) automated cart detection & discount pricing",
        "Volume bundle pricing tiers (e.g. Buy 3 for ₹999)",
      ]}
    />
  );
}
