import { redirect } from "next/navigation";

export default function OldOrdersRedirect() {
  redirect("/sales");
}
