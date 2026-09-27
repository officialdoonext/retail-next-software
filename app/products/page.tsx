"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function ProductsPage() {
  return (
    <ComingSoonPage
      title="Products"
      category="Product Manager"
      description="Central item master catalog, barcode labeling, HSN codes, wholesale/retail pricing, cost price tracking, and batch/expiry rules."
      features={[
        "Single & matrix variant product creation with EAN/UPC barcode support",
        "HSN code tax rules, purchase cost, MRP & selling price margin calculation",
        "Bulk Excel import/export & 50mm thermal barcode label generation",
      ]}
    />
  );
}
