"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function ExchangesPage() {
  return (
    <ComingSoonPage
      title="Exchanges"
      category="Return & Exchange Manager"
      description="Seamless same-value and differential-value item exchanges with automatic cart adjustment, size swapping, and balance settlement."
      features={[
        "Instant size & color variant swap without creating complex return bills",
        "Differential value calculation (customer pays extra or receives credit note)",
        "Real-time stock ledger adjustment for swapped and returned items",
      ]}
    />
  );
}
