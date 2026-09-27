import { redirect } from "next/navigation";

export default function OldAttendanceScanRedirect() {
  redirect("/employees/attendance");
}
