"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="Settings"
      category="Configuration"
      description="Store business settings, invoice customization, tax registrations, default thermal print sizes, and system preferences."
      features={[
        "Business profile, GSTIN & invoice header/footer notes customization",
        "ESC/POS thermal printer default line feed & cut configurations",
        "Backup, data export & audit log retention settings",
      ]}
    />
  );
}
