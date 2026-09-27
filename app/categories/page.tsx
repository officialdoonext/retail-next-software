"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function CategoriesPage() {
  return (
    <ComingSoonPage
      title="Categories"
      category="Product Manager"
      description="Organize your store catalog into nested hierarchy, parent-child departments, tax slabs, and POS quick-filter tiles."
      features={[
        "Multi-level category tree with custom display icons & colors",
        "Category-level GST / tax rates and profit margin rules",
        "Instant POS quick-key tile layout customization",
      ]}
    />
  );
}
