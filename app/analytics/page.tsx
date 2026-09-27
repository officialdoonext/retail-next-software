import { redirect } from "next/navigation";

export default function OldAnalyticsRedirect() {
  redirect("/dashboard");
}
