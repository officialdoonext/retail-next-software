"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function VendorsPage() {
  return (
    <ComingSoonPage
      title="Vendors"
      category="Vendors Manager"
      description="Supplier master directory with contact persons, company GSTIN numbers, bank details, credit terms, and catalog mappings."
      features={[
        "Vendor contact master, GSTIN verification & credit terms (e.g. Net 30/60)",
        "Bank NEFT / RTGS settlement account details & payment preferences",
        "Preferred vendor ratings, lead times & supplied SKU categories",
      ]}
    />
  );
}
