"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function SalesPage() {
  return (
    <ComingSoonPage
      title="Sales"
      category="Sales Manager"
      description="Comprehensive transaction ledger with full invoice history, customer details, tax breakdowns, and PDF/Excel export."
      features={[
        "Chronological invoice register with bill status & payment methods",
        "Detailed bill preview with thermal print reprint option",
        "Date-range filtering, customer name search & CSV export",
      ]}
    />
  );
}
