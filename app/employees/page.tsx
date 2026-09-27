"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function EmployeesPage() {
  return (
    <ComingSoonPage
      title="Employees"
      category="Employee Manager"
      description="Workforce master directory, employment contracts, designations, contact details, emergency contacts, and compensation profiles."
      features={[
        "Employee personal profiles, ID proofs & joining documentation",
        "Designation, department hierarchy & reporting manager structure",
        "Salary structure definition (Basic, HRA, Allowances, PF/ESI)",
      ]}
    />
  );
}
