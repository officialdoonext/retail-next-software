"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function PosPage() {
  return (
    <ComingSoonPage
      title="POS Billing Terminal"
      category="Terminal & Checkout"
      description="Ultra-fast keyboard-first Point of Sale terminal with barcode scanning, instant line discounts, multi-tender payments, and thermal receipt printing."
      features={[
        "Instant barcode scan & product search with variant matrix selector",
        "Split cash, UPI, credit card & customer store credit tenders",
        "Direct thermal printing with 58mm & 80mm ESC/POS hardware support",
      ]}
    />
  );
}
