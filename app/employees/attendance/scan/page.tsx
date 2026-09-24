import { redirect } from "next/navigation";

export default function RedirectToScan() {
  redirect("/attendance-scan");
}
