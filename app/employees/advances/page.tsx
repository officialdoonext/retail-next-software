"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function AdvancesPage() {
  return (
    <ComingSoonPage
      title="Employee Advances"
      category="Employee Manager"
      description="Staff salary advance disbursements, EMI deduction schedules, outstanding advance ledgers, and automated monthly salary deduction."
      features={[
        "Salary advance request submission with approval tracking",
        "Configurable monthly installment (EMI) recovery schedules",
        "Real-time outstanding advance balance ledger per employee",
      ]}
    />
  );
}
