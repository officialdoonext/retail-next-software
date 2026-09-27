"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function StockPage() {
  return (
    <ComingSoonPage
      title="Stock"
      category="Stock Manager"
      description="Live stock ledger, reorder threshold alerts, physical count audit audits, variance adjustments, and shrinkage tracking."
      features={[
        "Real-time store inventory on hand, reserved & in-transit counts",
        "Automated low-stock notifications & minimum stock level warnings",
        "Stock audit reconciliation with barcode scanner bulk check mode",
      ]}
    />
  );
}
