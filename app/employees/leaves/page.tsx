"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function LeavesPage() {
  return (
    <ComingSoonPage
      title="Employee leaves"
      category="Employee Manager"
      description="Leave policy management, annual/sick/casual leave quotas, employee leave requests, manager approval flows, and leave balance statements."
      features={[
        "Configurable leave balance policies (Casual, Sick, Paid Leave)",
        "Leave application portal with manager approval or rejection actions",
        "Automated payroll synchronization for approved vs unpaid leaves",
      ]}
    />
  );
}
