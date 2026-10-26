import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch settled sales/orders for the active business & store
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const fetchAll = searchParams.get("all") === "true";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const maxLimit = fetchAll ? 5000 : (limitParam ? parseInt(limitParam, 10) : 1000);

    let query = ctx.supabase
      .from("orders")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: rawOrders, error } = await query
      .order("created_at", { ascending: false })
      .limit(maxLimit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const orders = (rawOrders || []).map((o: any) => {
      const rawItems = Array.isArray(o.items) ? o.items : [];
      const billMeta = rawItems.find((it: any) => it._isBillMeta) || {};
      const actualItems = rawItems.filter((it: any) => !it._isBillMeta);

      return {
        id: o.id,
        billNumber: o.order_number,
        storeId: o.store_id,
        businessId: o.business_id,
        status: o.status || "SETTLED",
        customer: {
          id: o.customer_id || "",
          name: o.customer_name || "Walk-in Customer",
          phone: o.customer_phone || "",
        },
        items: actualItems,
        subtotal: Number(o.subtotal) || 0,
        discount: Number(o.discount) || 0,
        tax: Number(o.tax) || 0,
        grandTotal: Number(o.total) || 0,
        total: Number(o.total) || 0,
        paymentMethod: o.payment_method || "CASH",
        splitDetails: billMeta.splitDetails || null,
        couponCode: billMeta.couponCode || null,
        couponDiscount: billMeta.couponDiscount || 0,
        customerDiscount: billMeta.customerDiscount || 0,
        settledBy: o.staff_name || "",
        createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
      };
    });

    return NextResponse.json({ success: true, orders, count: orders.length });
  } catch (error: any) {
    console.error("Error fetching settled orders:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch sales records." }, { status: 500 });
  }
}

// POST: Settle a bill in Supabase
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Cannot settle an empty bill." }, { status: 400 });
    }

    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase();
    const subtotal = Number(body.subtotal) || 0;
    const discount = Number(body.discount) || 0;
    const cgst = Number(body.cgst) || 0;
    const sgst = Number(body.sgst) || 0;
    const totalTax = cgst + sgst;
    const grandTotal = Number(body.grandTotal) || 0;

    let splitDetails = null;
    if (paymentMethod === "SPLIT") {
      const upi = Number(body.splitDetails?.upi) || 0;
      const cash = Number(body.splitDetails?.cash) || 0;
      const card = Number(body.splitDetails?.card) || 0;
      splitDetails = { upi, cash, card };
    }

    // Generate readable Bill / Invoice ID
    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const billNumber = `INV-${yyyymmdd}-${randomSuffix}`;

    // 1. DEDUCT STOCK FOR EACH ITEM IN SUPABASE
    for (const item of items) {
      if (!item.productId) continue;
      try {
        const { data: prod } = await ctx.supabase
          .from("products")
          .select("*")
          .eq("id", item.productId)
          .eq("business_id", ctx.businessId)
          .single();

        if (prod) {
          const qty = Number(item.quantity) || 1;
          const newStock = Math.max(0, (Number(prod.stock) || 0) - qty);
          let variationOptions = typeof prod.variation_options === "object" && prod.variation_options ? { ...prod.variation_options } : {};

          if (prod.has_variations && Array.isArray(variationOptions.variants)) {
            const vIdx = variationOptions.variants.findIndex((v: any) => v.id === item.variantId);
            if (vIdx !== -1) {
              const currentVStock = Number(variationOptions.variants[vIdx].stock) || 0;
              variationOptions.variants[vIdx].stock = Math.max(0, currentVStock - qty);
            }
            variationOptions.totalStock = variationOptions.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
          }

          await ctx.supabase
            .from("products")
            .update({
              stock: newStock,
              variation_options: variationOptions,
              updated_at: new Date().toISOString(),
            })
            .eq("id", prod.id);
        }
      } catch (stockErr) {
        console.error("Stock deduction error:", stockErr);
      }
    }

    // 2. UPDATE CUSTOMER STATS IF CUSTOMER IS ATTACHED
    const customer = body.customer || null;
    let customerId = customer?.id || null;
    let customerName = customer?.name || "Walk-in Customer";
    let customerPhone = customer?.phone || "";

    if (customer && customer.id) {
      try {
        const { data: cust } = await ctx.supabase
          .from("customers")
          .select("total_purchases")
          .eq("id", customer.id)
          .single();

        if (cust) {
          const newTotal = (Number(cust.total_purchases) || 0) + grandTotal;
          await ctx.supabase
            .from("customers")
            .update({ total_purchases: newTotal, updated_at: new Date().toISOString() })
            .eq("id", customer.id);
        }
      } catch (custErr) {
        console.error("Error updating customer stats:", custErr);
      }
    }

    // 3. IF SAVED BILL DRAFT WAS USED, REMOVE FROM saved_bills
    if (body.savedBillId) {
      try {
        await ctx.supabase
          .from("saved_bills")
          .delete()
          .eq("id", body.savedBillId)
          .eq("business_id", ctx.businessId);
      } catch {}
    }

    // 4. MAP LINE ITEMS WITH FULL METADATA & EMPLOYEE ATTRIBUTION
    const mappedItems = items.map((it: any) => ({
      productId: it.productId,
      productName: it.productName || it.name,
      variantId: it.variantId || null,
      variantName: it.variantName || null,
      barcode: it.barcode || "",
      sku: it.sku || "",
      listPrice: Number(it.listPrice || it.mrp || it.price) || 0,
      salePrice: Number(it.salePrice || it.price) || 0,
      price: Number(it.salePrice || it.price) || 0,
      quantity: Number(it.quantity) || 1,
      taxRate: Number(it.taxRate) || 0,
      isTaxInclusive: it.isTaxInclusive !== undefined ? Boolean(it.isTaxInclusive) : true,
      taxableAmount: Number(it.taxableAmount) || 0,
      taxAmount: Number(it.taxAmount) || 0,
      subtotal: Number(it.subtotal) || (Number(it.salePrice || it.price) || 0) * (Number(it.quantity) || 1),
      total: Number(it.subtotal) || (Number(it.salePrice || it.price) || 0) * (Number(it.quantity) || 1),
      // Employee attribution per line item
      employeeId: it.employeeId || null,
      employeeName: it.employeeName || null,
      employeeNumericId: it.employeeNumericId || null,
      employeeMobile: it.employeeMobile || null,
    }));

    // Attach bill meta inside items array
    const billMetaItem = {
      _isBillMeta: true,
      splitDetails,
      couponCode: body.couponCode || null,
      couponDiscount: Number(body.couponDiscount) || 0,
      customerDiscount: Number(body.customerDiscount) || 0,
    };

    const finalPaymentMethod = paymentMethod === "SPLIT" && splitDetails
      ? `SPLIT (Cash: ₹${splitDetails.cash || 0}, UPI: ₹${splitDetails.upi || 0}, Card: ₹${splitDetails.card || 0})`
      : paymentMethod;

    // 5. INSERT SETTLED ORDER IN SUPABASE orders TABLE
    const orderRecord = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      order_number: billNumber,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: [...mappedItems, billMetaItem],
      subtotal,
      discount,
      tax: totalTax,
      total: grandTotal,
      payment_method: finalPaymentMethod,
      payment_status: "Paid",
      status: "Completed",
      staff_name: ctx.session.staffName || ctx.session.email,
      created_at: new Date().toISOString(),
    };

    const { data: insertedOrder, error: orderErr } = await ctx.supabase
      .from("orders")
      .insert([orderRecord])
      .select()
      .single();

    if (orderErr) {
      return NextResponse.json({ success: false, error: orderErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Bill settled successfully!",
      order: {
        id: insertedOrder.id,
        billNumber,
        ...orderRecord,
        items: mappedItems, // Clean items without _isBillMeta
        grandTotal,
        splitDetails,
      },
    });
  } catch (error: any) {
    console.error("Error settling bill:", error);
    return NextResponse.json({ success: false, error: "Failed to settle bill." }, { status: 500 });
  }
}
