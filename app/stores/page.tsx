"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function StoresPage() {
  return (
    <ComingSoonPage
      title="Stores"
      category="Store Network"
      description="Centralized multi-store franchise management, location details, branch license registration, and active terminal switcher."
      features={[
        "Branch network listing, address details & trade license tracking",
        "Per-store tax configuration, currency settings & receipt headers",
        "Terminal assignment & real-time store synchronization",
      ]}
    />
  );
}
