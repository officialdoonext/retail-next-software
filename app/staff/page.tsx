"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function StaffPage() {
  return (
    <ComingSoonPage
      title="Staff"
      category="Staff Manager"
      description="Store cashier & operator logins, mobile MPIN setup, store assignments, and granular per-page software permissions."
      features={[
        "Staff member mobile & 4-6 digit numeric MPIN login configuration",
        "Granular per-page access permission assignment (e.g. POS only vs Inventory)",
        "Assigned store branch mapping & account activation/deactivation toggles",
      ]}
    />
  );
}
