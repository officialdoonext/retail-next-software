import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// Helper for fallback to business_settings if public.vendors table is not yet created
async function getVendorsFromSettings(ctx: any): Promise<any[]> {
  const { data: bSettings } = await ctx.supabase
    .from("business_settings")
    .select("settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  return Array.isArray(bSettings?.settings?.vendors) ? bSettings.settings.vendors : [];
}

async function saveVendorsToSettings(ctx: any, vendors: any[]) {
  const { data: existing } = await ctx.supabase
    .from("business_settings")
    .select("id, settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    vendors,
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

// GET: Fetch vendors list with pagination (strictly 24 latest)
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").trim().toLowerCase();
    const fetchAll = searchParams.get("all") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "24", 10));

    let vendors: any[] = [];

    // Try query dedicated vendors table
    try {
      let query = ctx.supabase
        .from("vendors")
        .select("*")
        .eq("business_id", ctx.businessId);

      if (ctx.storeId) {
        query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        vendors = data.map((v: any) => ({
          id: v.id,
          name: v.name,
          companyName: v.company_name || "",
          phone: v.phone || "",
          email: v.email || "",
          gstNumber: v.gst_number || "",
          address: v.address || "",
          city: v.city || "",
          outstandingDue: Number(v.outstanding_due) || 0,
          status: v.status || "Active",
          createdAt: v.created_at ? new Date(v.created_at).getTime() : Date.now(),
        }));
      } else {
        vendors = await getVendorsFromSettings(ctx);
      }
    } catch {
      vendors = await getVendorsFromSettings(ctx);
    }

    // Filters
    if (searchQuery) {
      vendors = vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(searchQuery) ||
          (v.companyName && v.companyName.toLowerCase().includes(searchQuery)) ||
          (v.phone && v.phone.includes(searchQuery)) ||
          (v.gstNumber && v.gstNumber.toLowerCase().includes(searchQuery)) ||
          (v.city && v.city.toLowerCase().includes(searchQuery))
      );
    }

    if (statusFilter && statusFilter !== "all") {
      vendors = vendors.filter((v) => v.status.toLowerCase() === statusFilter);
    }

    // Sort latest first
    vendors.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const total = vendors.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (fetchAll) {
      return NextResponse.json({
        success: true,
        vendors,
        pagination: { total, totalPages: 1, page: 1, limit: total, hasMore: false },
      });
    }

    const startIndex = (page - 1) * limit;
    const paginatedVendors = vendors.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      vendors: paginatedVendors,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
  } catch (err: any) {
    console.error("GET /api/vendors error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch vendors." }, { status: 500 });
  }
}

// POST: Add new vendor
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Vendor name is required." }, { status: 400 });
    }

    const vendorId = randomUUID();
    const newVendor = {
      id: vendorId,
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      company_name: body.companyName || "",
      phone: body.phone || "",
      email: body.email || "",
      gst_number: body.gstNumber || "",
      address: body.address || "",
      city: body.city || "",
      outstanding_due: Number(body.outstandingDue) || 0,
      status: body.status || "Active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let insertedVendor = null;
    try {
      const { data, error } = await ctx.supabase
        .from("vendors")
        .insert(newVendor)
        .select()
        .single();
      if (!error && data) {
        insertedVendor = {
          id: data.id,
          name: data.name,
          companyName: data.company_name,
          phone: data.phone,
          email: data.email,
          gstNumber: data.gst_number,
          address: data.address,
          city: data.city,
          outstandingDue: Number(data.outstanding_due) || 0,
          status: data.status,
          createdAt: new Date(data.created_at).getTime(),
        };
      }
    } catch {
      // fallback
    }

    if (!insertedVendor) {
      const existingVendors = await getVendorsFromSettings(ctx);
      const fallbackVendor = {
        id: vendorId,
        name,
        companyName: body.companyName || "",
        phone: body.phone || "",
        email: body.email || "",
        gstNumber: body.gstNumber || "",
        address: body.address || "",
        city: body.city || "",
        outstandingDue: Number(body.outstandingDue) || 0,
        status: body.status || "Active",
        createdAt: Date.now(),
      };
      existingVendors.unshift(fallbackVendor);
      await saveVendorsToSettings(ctx, existingVendors);
      insertedVendor = fallbackVendor;
    }

    return NextResponse.json({ success: true, vendor: insertedVendor });
  } catch (err: any) {
    console.error("POST /api/vendors error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to create vendor." }, { status: 500 });
  }
}

// PUT / PATCH: Update vendor
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ success: false, error: "Vendor ID is required." }, { status: 400 });
    }

    let updated = false;
    try {
      const { error } = await ctx.supabase
        .from("vendors")
        .update({
          name: body.name,
          company_name: body.companyName,
          phone: body.phone,
          email: body.email,
          gst_number: body.gstNumber,
          address: body.address,
          city: body.city,
          outstanding_due: body.outstandingDue != null ? Number(body.outstandingDue) : undefined,
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("business_id", ctx.businessId);

      if (!error) updated = true;
    } catch {}

    if (!updated) {
      const existingVendors = await getVendorsFromSettings(ctx);
      const nextVendors = existingVendors.map((v) =>
        v.id === id ? { ...v, ...body, updatedAt: Date.now() } : v
      );
      await saveVendorsToSettings(ctx, nextVendors);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to update vendor." }, { status: 500 });
  }
}

// DELETE: Remove vendor
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Vendor ID is required." }, { status: 400 });
    }

    try {
      await ctx.supabase
        .from("vendors")
        .delete()
        .eq("id", id)
        .eq("business_id", ctx.businessId);
    } catch {}

    const existingVendors = await getVendorsFromSettings(ctx);
    const filtered = existingVendors.filter((v) => v.id !== id);
    await saveVendorsToSettings(ctx, filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to delete vendor." }, { status: 500 });
  }
}

