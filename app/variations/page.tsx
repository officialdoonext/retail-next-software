"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function VariationsPage() {
  return (
    <ComingSoonPage
      title="Variations"
      category="Product Manager"
      description="Manage product attribute sets such as Sizes, Colors, Fabrics, Storage capacities, and custom SKU generation formulas."
      features={[
        "Standardized attribute groups (e.g. Clothing Sizes: S, M, L, XL, XXL)",
        "Matrix generation for multi-dimensional variants (Size × Color)",
        "Variant-specific barcodes, MRPs & wholesale pricing",
      ]}
    />
  );
}
