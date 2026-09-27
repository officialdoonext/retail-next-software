"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function EmployeeSalesPage() {
  return (
    <ComingSoonPage
      title="Employee Sales"
      category="Sales Manager"
      description="Salesperson performance attribution, staff commission calculations, order counts, and target vs achievement tracking."
      features={[
        "Per-employee sales volume, order count & average basket size",
        "Commission tier calculation & incentive payroll summaries",
        "Top performer leaderboard & individual employee sales reports",
      ]}
    />
  );
}
