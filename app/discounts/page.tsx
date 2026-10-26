import { redirect } from "next/navigation";

export default function DiscountsIndexPage() {
  redirect("/discounts/order-coupons");
}
