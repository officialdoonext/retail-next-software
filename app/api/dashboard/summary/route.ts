import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/dashboard/summary: Aggregate dashboard metrics from Supabase
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const todayStr = new Date().toISOString().slice(0, 10);
    const requestedDate = searchParams.get("date") || todayStr;

    let ordersQuery = ctx.supabase
      .from("orders")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      ordersQuery = ordersQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: allOrders } = await ordersQuery.order("created_at", { ascending: false }).limit(200);

    const orders = allOrders || [];
    const todayOrders = orders.filter((o: any) => o.created_at?.startsWith(requestedDate));

    const totalSales = todayOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
    const totalOrders = todayOrders.length;
    const totalTax = todayOrders.reduce((sum: number, o: any) => sum + (Number(o.tax) || 0), 0);
    const totalDiscount = todayOrders.reduce((sum: number, o: any) => sum + (Number(o.discount) || 0), 0);

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    todayOrders.forEach((o: any) => {
      const pMethod = String(o.payment_method || "").toUpperCase();
      const amt = Number(o.total) || 0;
      if (pMethod === "CASH") cashSales += amt;
      else if (pMethod === "UPI") upiSales += amt;
      else if (pMethod === "CARD") cardSales += amt;
      else cashSales += amt;
    });

    const todaySummary = {
      date: requestedDate,
      totalSales,
      totalOrders,
      totalItems: todayOrders.reduce((sum: number, o: any) => sum + (Array.isArray(o.items) ? o.items.length : 1), 0),
      totalTax,
      totalDiscount,
      cashSales,
      upiSales,
      cardSales,
    };

    return NextResponse.json({
      success: true,
      todaySummary,
      summaries: [todaySummary],
    });
  } catch (error: any) {
    console.error("Error reading dashboard summary:", error);
    return NextResponse.json({ success: false, error: "Failed to read summary data." }, { status: 500 });
  }
}
