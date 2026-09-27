"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function VendorsInvoicesPage() {
  return (
    <ComingSoonPage
      title="Vendors Invoices"
      category="Vendors Manager"
      description="Supplier purchase invoices, 3-way matching against purchase orders and received stock, tax credit logging, and payment verification."
      features={[
        "Vendor invoice entry with tax breakdown (CGST, SGST, IGST)",
        "3-way matching of Purchase Order, Inward GRN & Vendor Invoice",
        "Payment status tracking (Unpaid, Partially Paid, Settled)",
      ]}
    />
  );
}
