"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function IndividualCustomerPage() {
  return (
    <ComingSoonPage
      title="Individual Customer"
      category="Customer Manager"
      description="Deep 360-degree customer profile view with complete purchase history, preferred sizes/categories, store credit ledger, and loyalty logs."
      features={[
        "Chronological bill purchase history with item-level drilldown",
        "Store credit & advance balance ledger with manual adjustment options",
        "Loyalty points transaction statement & birthday/anniversary offers",
      ]}
    />
  );
}
