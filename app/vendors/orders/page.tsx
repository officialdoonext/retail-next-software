"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function VendorsOrdersPage() {
  return (
    <ComingSoonPage
      title="Vendors Orders"
      category="Vendors Manager"
      description="Purchase orders (PO) generation, supplier order tracking, delivery schedule monitoring, and Goods Received Note (GRN) processing."
      features={[
        "Automated Purchase Order (PO) creation based on low stock alerts",
        "Goods Received Note (GRN) verification with excess/shortage checks",
        "PO approval hierarchy, delivery date tracking & status updates",
      ]}
    />
  );
}
