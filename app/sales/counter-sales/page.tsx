"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function CounterSalesPage() {
  return (
    <ComingSoonPage
      title="Counter Sales"
      category="Sales Manager"
      description="Terminal & counter checkout breakdown with cash drawer reconciliation, shift opening/closing float, and discrepancy logs."
      features={[
        "Counter-wise bill totals, hourly volume & active cashier tracking",
        "Shift opening & closing cash drawer float reconciliation",
        "Over/short variance reports & shift audit summaries",
      ]}
    />
  );
}
