"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function ReturnsPage() {
  return (
    <ComingSoonPage
      title="Returns"
      category="Return & Exchange Manager"
      description="Customer product returns processing against original bill, restocking verification, reason codes, cash refunds, and credit notes."
      features={[
        "Barcode bill lookup for instant item verification & purchase receipt check",
        "Restockable vs damaged inventory classification & reason logging",
        "Automated credit note voucher generation or instant payment refund",
      ]}
    />
  );
}
