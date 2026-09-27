"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function PayrollPage() {
  return (
    <ComingSoonPage
      title="Payroll"
      category="Employee Manager"
      description="Automated monthly payroll generation, attendance-based salary calculations, advance deductions, payslip generation, and bank export."
      features={[
        "Automatic attendance & loss-of-pay salary adjustments",
        "Advance repayment and loan deduction integration",
        "Printable employee payslips & bank NEFT salary transfer CSVs",
      ]}
    />
  );
}
