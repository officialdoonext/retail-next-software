import { redirect } from "next/navigation";

export default function OldIdCardRedirect() {
  redirect("/employees/id-cards");
}
