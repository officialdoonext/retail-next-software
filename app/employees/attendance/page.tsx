"use client";

import ComingSoonPage from "@/components/ComingSoonPage";

export default function AttendancePage() {
  return (
    <ComingSoonPage
      title="Employee Attendance"
      category="Employee Manager"
      description="Daily clock-in/out tracking, QR code scanner integration, late arrival penalties, shift schedules, and monthly attendance sheets."
      features={[
        "Real-time clock-in/out timestamps with camera QR scan validation",
        "Shift roster management, half-day & overtime tracking",
        "Monthly attendance muster roll with present, absent & leave tallies",
      ]}
    />
  );
}
