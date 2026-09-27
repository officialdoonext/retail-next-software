"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function DashboardPage() {
  return (
    <ComingSoonPage
      title="Dashboard"
      category="Main Overview"
      description="Executive KPI dashboard with sales analytics, daily gross profit, real-time footfall metrics, and top-selling store performance."
      features={[
        "Real-time revenue, gross margin & total customer ticket size counters",
        "Today's hourly sales velocity graph & counter-wise metrics",
        "Low stock inventory alerts & re-order recommendations",
      ]}
    />
  );
}
