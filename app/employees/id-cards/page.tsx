"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function IdCardsPage() {
  return (
    <ComingSoonPage
      title="Id Cards"
      category="Employee Manager"
      description="Professional printable employee identification badges with staff photo, store branch name, unique employee ID, and QR code for rapid attendance scan."
      features={[
        "Standard PVC format badge design with corporate retail branding",
        "Unique QR code encoded with employee credentials for instant scanner check-in",
        "Single & batch printable sheets with high-resolution output",
      ]}
    />
  );
}
