"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function WarehousePage() {
  return (
    <ComingSoonPage
      title="Warehouse"
      category="Stock Manager"
      description="Central warehouse and secondary depot storage zones, bin location mapping, inward receiving, and distribution staging."
      features={[
        "Multi-depot & warehouse zone mapping (Aisle, Rack, Shelf, Bin)",
        "Inward bulk goods receiving from manufacturers & suppliers",
        "Storage utilization capacity & stock valuation summaries",
      ]}
    />
  );
}
