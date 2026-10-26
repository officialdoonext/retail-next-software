import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

export const dynamic = "force-dynamic";

// GET: Fetch return & exchange records for the active business/store or customer
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const customerPhone = searchParams.get("customerPhone");
    const typeFilter = searchParams.get("type"); // 'RETURN' | 'EXCHANGE' | null

    // 1. Query orders table for returned/exchanged records
    let ordersQuery = ctx.supabase
      .from("orders")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (customerId) {
      ordersQuery = ordersQuery.eq("customer_id", customerId);
    } else if (customerPhone) {
      ordersQuery = ordersQuery.eq("customer_phone", customerPhone);
    }

    // Filter orders with status Returned/Exchanged or order_number like RET/EXC
    ordersQuery = ordersQuery.or("status.ilike.%return%,status.ilike.%exchange%,order_number.ilike.RET-%,order_number.ilike.EXC-%");

    const { data: rawReturnOrders } = await ordersQuery.order("created_at", { ascending: false });

    // 2. Also check if order_returns table exists and query it
    let orderReturnsRecords: any[] = [];
    try {
      let returnsQuery = ctx.supabase
        .from("order_returns")
        .select("*")
        .eq("business_id", ctx.businessId);

      if (customerId) {
        returnsQuery = returnsQuery.eq("customer_id", customerId);
      } else if (customerPhone) {
        returnsQuery = returnsQuery.eq("customer_phone", customerPhone);
      }

      const { data: directReturns } = await returnsQuery.order("created_at", { ascending: false });
      if (Array.isArray(directReturns)) {
        orderReturnsRecords = directReturns;
      }
    } catch {
      // table might not exist yet, safe fallback
    }

    // Combine & normalize records
    const normalizedList: any[] = [];
    const seenIds = new Set<string>();

    // Add direct order_returns
    for (const r of orderReturnsRecords) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        normalizedList.push({
          id: r.id,
          returnNumber: r.return_number || `RET-${r.id.slice(0, 8)}`,
          orderNumber: r.order_number || "Direct Return",
          type: (r.type || "RETURN").toUpperCase(),
          customer: {
            id: r.customer_id || customerId || "",
            name: r.customer_name || "Customer",
            phone: r.customer_phone || customerPhone || "",
          },
          items: Array.isArray(r.items) ? r.items : [],
          reason: r.reason || "Customer Return",
          refundAmount: Math.abs(Number(r.refund_amount) || 0),
          refundMethod: r.refund_method || "CASH",
          status: r.status || "COMPLETED",
          staffName: r.staff_name || "Store Cashier",
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        });
      }
    }

    // Add return orders
    for (const o of rawReturnOrders || []) {
      if (!seenIds.has(o.id)) {
        seenIds.add(o.id);
        const rawItems = Array.isArray(o.items) ? o.items : [];
        const returnMeta = rawItems.find((it: any) => it._isReturnMeta) || {};
        const actualItems = rawItems.filter((it: any) => !it._isReturnMeta && !it._isBillMeta);

        const isExchange =
          o.status?.toLowerCase().includes("exchange") ||
          o.order_number?.startsWith("EXC-") ||
          returnMeta.type === "EXCHANGE";

        normalizedList.push({
          id: o.id,
          returnNumber: o.order_number,
          orderNumber: returnMeta.originalOrderNumber || o.order_number,
          type: isExchange ? "EXCHANGE" : "RETURN",
          customer: {
            id: o.customer_id || customerId || "",
            name: o.customer_name || "Customer",
            phone: o.customer_phone || customerPhone || "",
          },
          items: actualItems.length > 0 ? actualItems : returnMeta.returnedItems || [],
          reason: returnMeta.reason || (isExchange ? "Product size/variant exchange" : "Customer return & refund"),
          refundAmount: Math.abs(Number(o.total) || Number(returnMeta.refundAmount) || 0),
          refundMethod: o.payment_method || returnMeta.refundMethod || "CASH",
          status: o.status || "COMPLETED",
          staffName: o.staff_name || "Cashier",
          createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
        });
      }
    }

    // Filter by type if provided
    let finalResults = normalizedList;
    if (typeFilter && typeFilter !== "ALL") {
      finalResults = finalResults.filter((r) => r.type === typeFilter);
    }

    // Sort descending by date
    finalResults.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      returns: finalResults,
      count: finalResults.length,
      totalReturns: finalResults.filter((r) => r.type === "RETURN").length,
      totalExchanges: finalResults.filter((r) => r.type === "EXCHANGE").length,
      totalRefundAmount: finalResults.reduce((acc, curr) => acc + curr.refundAmount, 0),
    });
  } catch (err: any) {
    console.error("Error fetching returns:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch returns data." }, { status: 500 });
  }
}

// POST: Create a new return or exchange entry
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const type = (body.type || "RETURN").toUpperCase(); // 'RETURN' | 'EXCHANGE'
    const originalOrderNumber = String(body.orderNumber || "").trim();
    const customerId = body.customerId || null;
    const customerName = body.customerName || "Customer";
    const customerPhone = body.customerPhone || "";
    const items = Array.isArray(body.items) ? body.items : [];
    const reason = body.reason || "Customer return request";
    const refundAmount = Number(body.refundAmount) || 0;
    const refundMethod = body.refundMethod || "CASH";
    const staffName = body.staffName || "Cashier";

    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `${type === "EXCHANGE" ? "EXC" : "RET"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`;

    // 1. Record into orders table with negative/adjusted total for audit ledger
    const returnMetaItem = {
      _isReturnMeta: true,
      type,
      originalOrderNumber,
      reason,
      refundAmount,
      refundMethod,
      returnedItems: items,
      createdAt: timestamp,
    };

    const orderPayload = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      order_number: returnNumber,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: [returnMetaItem, ...items],
      subtotal: -refundAmount,
      discount: 0,
      tax: 0,
      total: -refundAmount,
      payment_method: refundMethod,
      payment_status: "Refunded",
      status: type === "EXCHANGE" ? "Exchanged" : "Returned",
      staff_name: staffName,
      created_at: new Date().toISOString(),
    };

    const { data: savedOrder, error: orderErr } = await ctx.supabase
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderErr) {
      console.error("Failed to insert return into orders:", orderErr);
      return NextResponse.json({ success: false, error: orderErr.message }, { status: 500 });
    }

    // 2. Try inserting into order_returns if table exists (optional fallback)
    try {
      await ctx.supabase.from("order_returns").insert({
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        return_number: returnNumber,
        type,
        order_number: originalOrderNumber || returnNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        items,
        reason,
        refund_amount: refundAmount,
        refund_method: refundMethod,
        status: "COMPLETED",
        staff_name: staffName,
      });
    } catch {
      // Table might not exist, harmless
    }

    return NextResponse.json({
      success: true,
      returnRecord: {
        id: savedOrder?.id,
        returnNumber,
        orderNumber: originalOrderNumber,
        type,
        customer: { id: customerId, name: customerName, phone: customerPhone },
        items,
        reason,
        refundAmount,
        refundMethod,
        status: "COMPLETED",
        staffName,
        createdAt: timestamp,
      },
    });
  } catch (err: any) {
    console.error("Error creating return/exchange:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to process return." }, { status: 500 });
  }
}
