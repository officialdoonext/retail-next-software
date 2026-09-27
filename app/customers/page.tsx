"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function CustomersPage() {
  return (
    <ComingSoonPage
      title="Customer"
      category="Customer Manager"
      description="Retail customer directory, phone lookup, loyalty membership tiers, lifetime spend statistics, and quick customer registration."
      features={[
        "Quick customer phone number search with auto-fill during POS checkout",
        "Loyalty points balance, tier status & reward voucher balance",
        "Total lifetime spend, visit frequency & last purchase date tracking",
      ]}
    />
  );
}
