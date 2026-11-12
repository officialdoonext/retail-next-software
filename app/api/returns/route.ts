import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

export const dynamic = "force-dynamic";

// Helper to adjust inventory stock for a returned or replacement product
async function adjustProductStock(
  supabase: any,
  businessId: string,
  productId: string,
  variantId: string | null | undefined,
  delta: number // positive = add stock, negative = deduct stock
) {
  if (!productId || delta === 0) return;
  try {
    const { data: prod } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("business_id", businessId)
      .single();

    if (prod) {
      const currentStock = Number(prod.stock) || 0;
      const newStock = Math.max(0, currentStock + delta);
      let variationOptions =
        typeof prod.variation_options === "object" && prod.variation_options
          ? { ...prod.variation_options }
          : {};

      if (prod.has_variations && Array.isArray(variationOptions.variants) && variantId) {
        const vIdx = variationOptions.variants.findIndex((v: any) => v.id === variantId);
        if (vIdx !== -1) {
          const currentVStock = Number(variationOptions.variants[vIdx].stock) || 0;
          variationOptions.variants[vIdx].stock = Math.max(0, currentVStock + delta);
        }
        variationOptions.totalStock = variationOptions.variants.reduce(
          (acc: number, curr: any) => acc + (curr.stock || 0),
          0
        );
      }

      await supabase
        .from("products")
        .update({
          stock: newStock,
          variation_options: variationOptions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prod.id);
    }
  } catch (err) {
    console.error("Error adjusting product stock:", err);
  }
}

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
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const activeOnly = searchParams.get("activeOnly") === "true";
    const fetchAll = searchParams.get("all") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "24", 10));

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
          originalBillNumber: returnMeta.originalOrderNumber || o.order_number,
          type: isExchange ? "EXCHANGE" : "RETURN",
          customer: {
            id: o.customer_id || customerId || "",
            name: o.customer_name || "Customer",
            phone: o.customer_phone || customerPhone || "",
          },
          items: actualItems.length > 0 ? actualItems : returnMeta.returnedItems || [],
          returnedItems: returnMeta.returnedItems || actualItems,
          replacementItems: returnMeta.replacementItems || [],
          exchangeValue: Number(returnMeta.exchangeValue) || Math.abs(Number(o.total)) || 0,
          replacementValue: Number(returnMeta.replacementValue) || 0,
          netAmount: Number(returnMeta.netAmount) || 0,
          exchangeVoucherNumber: returnMeta.exchangeVoucherNumber || o.order_number,
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

    // Filter active (non-redeemed) vouchers if requested
    if (activeOnly) {
      finalResults = finalResults.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        return !s.includes("redeem") && Number(r.exchangeValue || r.refundAmount || 0) > 0;
      });
    }

    // Filter by search query
    if (searchQuery) {
      finalResults = finalResults.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(searchQuery) ||
          r.orderNumber.toLowerCase().includes(searchQuery) ||
          (r.customer?.name && r.customer.name.toLowerCase().includes(searchQuery)) ||
          (r.customer?.phone && r.customer.phone.includes(searchQuery))
      );
    }

    // Sort descending by date
    finalResults.sort((a, b) => b.createdAt - a.createdAt);

    const totalCount = finalResults.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const paginatedReturns = fetchAll ? finalResults : finalResults.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      returns: paginatedReturns,
      count: totalCount,
      totalReturns: finalResults.filter((r) => r.type === "RETURN").length,
      totalExchanges: finalResults.filter((r) => r.type === "EXCHANGE").length,
      totalRefundAmount: finalResults.reduce((acc, curr) => acc + curr.refundAmount, 0),
      pagination: {
        total: totalCount,
        totalPages: fetchAll ? 1 : totalPages,
        page: fetchAll ? 1 : page,
        limit: fetchAll ? totalCount : limit,
        hasMore: fetchAll ? false : page < totalPages,
      },
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
    const returnedItems = Array.isArray(body.items) ? body.items : [];
    const replacementItems = Array.isArray(body.replacementItems) ? body.replacementItems : [];
    const reason = body.reason || (type === "EXCHANGE" ? "Product exchange" : "Customer return request");
    
    // Values
    const exchangeValue = Number(body.exchangeValue) || Number(body.refundAmount) || 0;
    const replacementValue = Number(body.replacementValue) || 0;
    const netAmount = body.netAmount !== undefined ? Number(body.netAmount) : replacementValue - exchangeValue;
    const refundAmount = type === "EXCHANGE" ? Math.max(0, -netAmount) : (Number(body.refundAmount) || exchangeValue || 0);
    const refundMethod = body.refundMethod || body.paymentMethod || "CASH";
    const staffName = body.staffName || "Cashier";

    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `${type === "EXCHANGE" ? "EXC" : "RET"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`;

    // 1. ADD STOCK BACK TO PRODUCTS FOR ALL RETURNED / RECEIVED ITEMS
    for (const item of returnedItems) {
      const prodId = item.productId || item.id;
      const qty = Number(item.quantity) || 1;
      await adjustProductStock(ctx.supabase, ctx.businessId, prodId, item.variantId, qty);
    }

    // 2. DEDUCT STOCK FOR REPLACEMENT ITEMS (IF IMMEDIATE REPLACEMENT ON SPOT)
    for (const item of replacementItems) {
      const prodId = item.productId || item.id;
      const qty = Number(item.quantity) || 1;
      await adjustProductStock(ctx.supabase, ctx.businessId, prodId, item.variantId, -qty);
    }

    // 3. Record into orders table with negative/adjusted total for audit ledger
    const returnMetaItem = {
      _isReturnMeta: true,
      type,
      originalOrderNumber,
      reason,
      exchangeValue,
      replacementValue,
      netAmount,
      refundAmount,
      refundMethod,
      returnedItems,
      replacementItems,
      exchangeVoucherNumber: returnNumber,
      createdAt: timestamp,
    };

    const finalAmount = type === "EXCHANGE" ? netAmount : -refundAmount;

    const orderPayload = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      order_number: returnNumber,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: [returnMetaItem, ...returnedItems],
      subtotal: finalAmount,
      discount: 0,
      tax: 0,
      total: finalAmount,
      payment_method: refundMethod,
      payment_status: type === "EXCHANGE" ? (netAmount > 0 ? "Paid Extra" : netAmount < 0 ? "Refunded" : "Even Exchange") : "Refunded",
      status: type === "EXCHANGE" ? "ACTIVE" : "Returned",
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

    // 4. Try inserting into order_returns if table exists (optional fallback)
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
        items: returnedItems,
        reason,
        refund_amount: refundAmount,
        refund_method: refundMethod,
        status: type === "EXCHANGE" ? "ACTIVE" : "COMPLETED",
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
        items: returnedItems,
        replacementItems,
        exchangeValue,
        replacementValue,
        netAmount,
        reason,
        refundAmount,
        refundMethod,
        status: type === "EXCHANGE" ? "ACTIVE" : "COMPLETED",
        exchangeVoucherNumber: returnNumber,
        staffName,
        createdAt: timestamp,
      },
    });
  } catch (err: any) {
    console.error("Error creating return/exchange:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to process return." }, { status: 500 });
  }
}
