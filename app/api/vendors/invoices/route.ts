import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function getInvoicesFromSettings(ctx: any): Promise<any[]> {
  const { data: bSettings } = await ctx.supabase
    .from("business_settings")
    .select("settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  return Array.isArray(bSettings?.settings?.vendor_invoices) ? bSettings.settings.vendor_invoices : [];
}

async function saveInvoicesToSettings(ctx: any, invoices: any[]) {
  const { data: existing } = await ctx.supabase
    .from("business_settings")
    .select("id, settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    vendor_invoices: invoices,
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

// GET: List invoices with pagination (strictly 24 latest)
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").trim().toLowerCase();
    const dueOnly = searchParams.get("dueOnly") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "24", 10));

    let invoices: any[] = [];
    try {
      let query = ctx.supabase
        .from("vendor_invoices")
        .select("*")
        .eq("business_id", ctx.businessId);

      if (ctx.storeId) {
        query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        invoices = data.map((inv: any) => ({
          id: inv.id,
          vendorId: inv.vendor_id,
          vendorName: inv.vendor_name,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date || "",
          amount: Number(inv.amount) || 0,
          paidAmount: Number(inv.paid_amount) || 0,
          dueAmount: (Number(inv.amount) || 0) - (Number(inv.paid_amount) || 0),
          paymentMethod: inv.payment_method || "Bank Transfer",
          status: inv.status || "Unpaid",
          notes: inv.notes || "",
          createdAt: inv.created_at ? new Date(inv.created_at).getTime() : Date.now(),
        }));
      } else {
        invoices = await getInvoicesFromSettings(ctx);
      }
    } catch {
      invoices = await getInvoicesFromSettings(ctx);
    }

    if (searchQuery) {
      invoices = invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(searchQuery) ||
          inv.vendorName.toLowerCase().includes(searchQuery)
      );
    }

    if (dueOnly) {
      invoices = invoices.filter((inv) => (Number(inv.dueAmount) > 0 || inv.status !== "Paid"));
    } else if (statusFilter && statusFilter !== "all") {
      invoices = invoices.filter((inv) => inv.status.toLowerCase() === statusFilter);
    }

    invoices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const total = invoices.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedInvoices = invoices.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      invoices: paginatedInvoices,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch invoices." }, { status: 500 });
  }
}

// POST: Add new vendor invoice
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const vendorName = String(body.vendorName || "").trim();
    const invoiceNumber = String(body.invoiceNumber || "").trim();
    const amount = Number(body.amount) || 0;
    const paidAmount = Number(body.paidAmount) || 0;

    if (!vendorName || !invoiceNumber || amount <= 0) {
      return NextResponse.json({ success: false, error: "Vendor name, invoice number and valid amount are required." }, { status: 400 });
    }

    const status = paidAmount >= amount ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Unpaid";
    const invoiceId = randomUUID();

    const newInvoice = {
      id: invoiceId,
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      vendor_id: body.vendorId || null,
      vendor_name: vendorName,
      invoice_number: invoiceNumber,
      invoice_date: body.invoiceDate || new Date().toISOString().slice(0, 10),
      due_date: body.dueDate || null,
      amount,
      paid_amount: paidAmount,
      payment_method: body.paymentMethod || "Bank Transfer",
      status,
      notes: body.notes || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let inserted = null;
    try {
      const { data, error } = await ctx.supabase
        .from("vendor_invoices")
        .insert(newInvoice)
        .select()
        .single();
      if (!error && data) {
        inserted = {
          id: data.id,
          vendorId: data.vendor_id,
          vendorName: data.vendor_name,
          invoiceNumber: data.invoice_number,
          invoiceDate: data.invoice_date,
          dueDate: data.due_date,
          amount: Number(data.amount) || 0,
          paidAmount: Number(data.paid_amount) || 0,
          dueAmount: (Number(data.amount) || 0) - (Number(data.paid_amount) || 0),
          status: data.status,
          createdAt: new Date(data.created_at).getTime(),
        };
      }
    } catch {}

    if (!inserted) {
      const existing = await getInvoicesFromSettings(ctx);
      const fallback = {
        id: invoiceId,
        vendorId: body.vendorId || null,
        vendorName,
        invoiceNumber,
        invoiceDate: body.invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: body.dueDate || "",
        amount,
        paidAmount,
        dueAmount: amount - paidAmount,
        paymentMethod: body.paymentMethod || "Bank Transfer",
        status,
        notes: body.notes || "",
        createdAt: Date.now(),
      };
      existing.unshift(fallback);
      await saveInvoicesToSettings(ctx, existing);
      inserted = fallback;
    }

    return NextResponse.json({ success: true, invoice: inserted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to create invoice." }, { status: 500 });
  }
}

// PATCH: Record payment on invoice
export async function PATCH(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const id = body.id;
    const additionalPayment = Number(body.paymentAmount) || 0;

    if (!id || additionalPayment <= 0) {
      return NextResponse.json({ success: false, error: "Invoice ID and payment amount are required." }, { status: 400 });
    }

    // Update in database or settings
    let currentInvoices = await getInvoicesFromSettings(ctx);
    try {
      const { data: invRow } = await ctx.supabase
        .from("vendor_invoices")
        .select("*")
        .eq("id", id)
        .eq("business_id", ctx.businessId)
        .maybeSingle();

      if (invRow) {
        const newPaid = (Number(invRow.paid_amount) || 0) + additionalPayment;
        const totalAmt = Number(invRow.amount) || 0;
        const newStatus = newPaid >= totalAmt ? "Paid" : "Partially Paid";

        await ctx.supabase
          .from("vendor_invoices")
          .update({
            paid_amount: newPaid,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }
    } catch {}

    // Update fallback settings
    currentInvoices = currentInvoices.map((inv) => {
      if (inv.id === id) {
        const newPaid = (inv.paidAmount || 0) + additionalPayment;
        const newStatus = newPaid >= inv.amount ? "Paid" : "Partially Paid";
        return {
          ...inv,
          paidAmount: newPaid,
          dueAmount: Math.max(0, inv.amount - newPaid),
          status: newStatus,
        };
      }
      return inv;
    });
    await saveInvoicesToSettings(ctx, currentInvoices);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to record payment." }, { status: 500 });
  }
}

