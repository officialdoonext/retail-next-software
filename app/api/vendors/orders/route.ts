import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function getOrdersFromSettings(ctx: any): Promise<any[]> {
  const { data: bSettings } = await ctx.supabase
    .from("business_settings")
    .select("settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  return Array.isArray(bSettings?.settings?.vendor_orders) ? bSettings.settings.vendor_orders : [];
}

async function saveOrdersToSettings(ctx: any, orders: any[]) {
  const { data: existing } = await ctx.supabase
    .from("business_settings")
    .select("id, settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    vendor_orders: orders,
  };

  if (existing?.id) {
    await ctx.supabase
      .from("business_settings")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await ctx.supabase
      .from("business_settings")
      .insert({
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      });
  }
}

// GET: List vendor purchase orders with 24 pagination
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").trim().toLowerCase();
    const vendorId = searchParams.get("vendorId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "24", 10));

    let orders: any[] = [];
    try {
      let query = ctx.supabase
        .from("vendor_orders")
        .select("*")
        .eq("business_id", ctx.businessId);

      if (ctx.storeId) {
        query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
      }
      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        orders = data.map((o: any) => ({
          id: o.id,
          vendorId: o.vendor_id,
          vendorName: o.vendor_name,
          poNumber: o.po_number,
          items: Array.isArray(o.items) ? o.items : [],
          totalAmount: Number(o.total_amount) || 0,
          expectedDelivery: o.expected_delivery || "",
          status: o.status || "Pending",
          notes: o.notes || "",
          createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
        }));
      } else {
        orders = await getOrdersFromSettings(ctx);
      }
    } catch {
      orders = await getOrdersFromSettings(ctx);
    }

    if (searchQuery) {
      orders = orders.filter(
        (o) =>
          o.poNumber.toLowerCase().includes(searchQuery) ||
          o.vendorName.toLowerCase().includes(searchQuery)
      );
    }

    if (statusFilter && statusFilter !== "all") {
      orders = orders.filter((o) => o.status.toLowerCase() === statusFilter);
    }

    orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const total = orders.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      orders: paginatedOrders,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch vendor orders." }, { status: 500 });
  }
}

// POST: Create purchase order
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const vendorName = String(body.vendorName || "").trim();
    if (!vendorName) {
      return NextResponse.json({ success: false, error: "Vendor name is required." }, { status: 400 });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const poNumber = body.poNumber || `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomNum}`;
    const orderId = randomUUID();

    const newOrder = {
      id: orderId,
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      vendor_id: body.vendorId || null,
      vendor_name: vendorName,
      po_number: poNumber,
      items: Array.isArray(body.items) ? body.items : [],
      total_amount: Number(body.totalAmount) || 0,
      expected_delivery: body.expectedDelivery || null,
      status: body.status || "Pending",
      notes: body.notes || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let inserted = null;
    try {
      const { data, error } = await ctx.supabase
        .from("vendor_orders")
        .insert(newOrder)
        .select()
        .single();
      if (!error && data) {
        inserted = {
          id: data.id,
          vendorId: data.vendor_id,
          vendorName: data.vendor_name,
          poNumber: data.po_number,
          items: data.items,
          totalAmount: Number(data.total_amount) || 0,
          expectedDelivery: data.expected_delivery,
          status: data.status,
          notes: data.notes,
          createdAt: new Date(data.created_at).getTime(),
        };
      }
    } catch {}

    if (!inserted) {
      const existing = await getOrdersFromSettings(ctx);
      const fallback = {
        id: orderId,
        vendorId: body.vendorId || null,
        vendorName,
        poNumber,
        items: Array.isArray(body.items) ? body.items : [],
        totalAmount: Number(body.totalAmount) || 0,
        expectedDelivery: body.expectedDelivery || "",
        status: body.status || "Pending",
        notes: body.notes || "",
        createdAt: Date.now(),
      };
      existing.unshift(fallback);
      await saveOrdersToSettings(ctx, existing);
      inserted = fallback;
    }

    return NextResponse.json({ success: true, order: inserted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to create PO." }, { status: 500 });
  }
}

// PATCH: Update order status
export async function PATCH(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const id = body.id;
    if (!id) return NextResponse.json({ success: false, error: "Order ID is required." }, { status: 400 });

    try {
      await ctx.supabase
        .from("vendor_orders")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", ctx.businessId);
    } catch {}

    const existing = await getOrdersFromSettings(ctx);
    const updated = existing.map((o) => (o.id === id ? { ...o, status: body.status } : o));
    await saveOrdersToSettings(ctx, updated);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to update PO status." }, { status: 500 });
  }
}

