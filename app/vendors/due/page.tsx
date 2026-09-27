"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function VendorsDuePage() {
  return (
    <ComingSoonPage
      title="Vendors Due"
      category="Vendors Manager"
      description="Outstanding accounts payable ledger, aging reports (30/60/90 days), upcoming payment schedules, and settlement transaction logs."
      features={[
        "Outstanding vendor dues summary & aging breakdown (0-30, 31-60, 60+ days)",
        "Upcoming payment due reminders with cash-flow planning projections",
        "Payment disbursement logging with cheque / UTR transaction references",
      ]}
    />
  );
}
