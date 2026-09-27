"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function StockTransfersPage() {
  return (
    <ComingSoonPage
      title="Stock Transfers"
      category="Stock Manager"
      description="Inter-branch store-to-store and warehouse-to-store stock transfers with dispatch challans, in-transit tracking, and destination receiving verification."
      features={[
        "Transfer request workflow with approval & stock reservation",
        "Dispatch challan printing with item breakdown & transport details",
        "Destination verification with discrepancy checking & acceptance confirmation",
      ]}
    />
  );
}
