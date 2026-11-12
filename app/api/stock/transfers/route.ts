import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function getTransfersFromSettings(ctx: any): Promise<any[]> {
  const { data: bSettings } = await ctx.supabase
    .from("business_settings")
    .select("settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  return Array.isArray(bSettings?.settings?.stock_transfers) ? bSettings.settings.stock_transfers : [];
}

async function saveTransfersToSettings(ctx: any, transfers: any[]) {
  const { data: existing } = await ctx.supabase
    .from("business_settings")
    .select("id, settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    stock_transfers: transfers,
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

// GET: List stock transfers with pagination (strictly 24 latest)
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "24", 10));

    let transfers: any[] = [];
    try {
      const { data, error } = await ctx.supabase
        .from("stock_transfers")
        .select("*")
        .eq("business_id", ctx.businessId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        transfers = data.map((t: any) => ({
          id: t.id,
          transferNumber: t.transfer_number,
          fromType: t.from_type,
          fromId: t.from_id,
          fromName: t.from_name,
          toType: t.to_type,
          toId: t.to_id,
          toName: t.to_name,
          items: Array.isArray(t.items) ? t.items : [],
          totalQty: Number(t.total_qty) || 0,
          status: t.status || "Pending",
          notes: t.notes || "",
          transferredBy: t.transferred_by || "Store Manager",
          createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
        }));
      } else {
        transfers = await getTransfersFromSettings(ctx);
      }
    } catch {
      transfers = await getTransfersFromSettings(ctx);
    }

    if (searchQuery) {
      transfers = transfers.filter(
        (t) =>
          t.transferNumber.toLowerCase().includes(searchQuery) ||
          t.fromName.toLowerCase().includes(searchQuery) ||
          t.toName.toLowerCase().includes(searchQuery)
      );
    }

    if (statusFilter && statusFilter !== "all") {
      transfers = transfers.filter((t) => t.status.toLowerCase() === statusFilter);
    }

    transfers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const total = transfers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedTransfers = transfers.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      transfers: paginatedTransfers,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch stock transfers." }, { status: 500 });
  }
}

// POST: Create stock transfer
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const fromName = String(body.fromName || "").trim();
    const toName = String(body.toName || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || Number(it.quantity) || 1), 0);

    if (!fromName || !toName || items.length === 0) {
      return NextResponse.json({ success: false, error: "Origin, destination, and at least 1 transfer item are required." }, { status: 400 });
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const transferNumber = body.transferNumber || `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`;
    const transferId = randomUUID();

    const newTransfer = {
      id: transferId,
      business_id: ctx.businessId,
      transfer_number: transferNumber,
      from_type: body.fromType || "Store",
      from_id: body.fromId || "",
      from_name: fromName,
      to_type: body.toType || "Warehouse",
      to_id: body.toId || "",
      to_name: toName,
      items,
      total_qty: totalQty,
      status: body.status || "Pending",
      notes: body.notes || "",
      transferred_by: body.transferredBy || "Manager",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let inserted = null;
    try {
      const { data, error } = await ctx.supabase
        .from("stock_transfers")
        .insert(newTransfer)
        .select()
        .single();

      if (!error && data) {
        inserted = {
          id: data.id,
          transferNumber: data.transfer_number,
          fromType: data.from_type,
          fromId: data.from_id,
          fromName: data.from_name,
          toType: data.to_type,
          toId: data.to_id,
          toName: data.to_name,
          items: data.items,
          totalQty: Number(data.total_qty) || 0,
          status: data.status,
          notes: data.notes,
          transferredBy: data.transferred_by,
          createdAt: new Date(data.created_at).getTime(),
        };
      }
    } catch {}

    if (!inserted) {
      const existing = await getTransfersFromSettings(ctx);
      const fallback = {
        id: transferId,
        transferNumber,
        fromType: body.fromType || "Store",
        fromId: body.fromId || "",
        fromName,
        toType: body.toType || "Warehouse",
        toId: body.toId || "",
        toName,
        items,
        totalQty,
        status: body.status || "Pending",
        notes: body.notes || "",
        transferredBy: body.transferredBy || "Manager",
        createdAt: Date.now(),
      };
      existing.unshift(fallback);
      await saveTransfersToSettings(ctx, existing);
      inserted = fallback;
    }

    return NextResponse.json({ success: true, transfer: inserted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to create transfer." }, { status: 500 });
  }
}

// PATCH: Update status (e.g. In-Transit, Received, Cancelled)
export async function PATCH(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const id = body.id;
    const status = body.status;
    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Transfer ID and status are required." }, { status: 400 });
    }

    try {
      await ctx.supabase
        .from("stock_transfers")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", ctx.businessId);
    } catch {}

    const existing = await getTransfersFromSettings(ctx);
    const updated = existing.map((t) => (t.id === id ? { ...t, status } : t));
    await saveTransfersToSettings(ctx, updated);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to update transfer status." }, { status: 500 });
  }
}

