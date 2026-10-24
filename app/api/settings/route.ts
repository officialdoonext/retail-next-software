import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/settings - Retrieve settings for the active store & business
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    if (!ctx.storeId) {
      return NextResponse.json({ success: false, error: "No active store selected." }, { status: 400 });
    }

    const { data: store, error } = await ctx.supabase
      .from("stores")
      .select("*")
      .eq("id", ctx.storeId)
      .eq("business_id", ctx.businessId)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    // Also get business_settings if exists
    const { data: bSettings } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId)
      .maybeSingle();

    const extra = bSettings?.settings || {};

    const settings = {
      id: store.id,
      name: store.name || "",
      phone: store.phone || store.mobile_number || "",
      email: ctx.email || "",
      location: store.location || store.full_address || "",
      address: store.full_address || store.location || "",
      city: store.city || "",
      state: extra.state || "",
      pincode: extra.pincode || "",
      businessType: extra.businessType || "Retail Store",
      code: store.code || "",
      license: store.license || "",
      logoUrl: extra.logoUrl || "",
      tagline: extra.tagline || "",
      website: extra.website || "",

      // GST Settings
      enableGst: Boolean(extra.enableGst),
      gstNumber: store.gst_number || extra.gstNumber || "",
      isPriceInclusiveGst: Boolean(extra.isPriceInclusiveGst),
      cgstPercent: typeof extra.cgstPercent === "number" ? extra.cgstPercent : 9,
      sgstPercent: typeof extra.sgstPercent === "number" ? extra.sgstPercent : 9,

      // Round Off Setting
      enableRoundOff: Boolean(extra.enableRoundOff),
    };

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch store settings." }, { status: 500 });
  }
}

// PUT /api/settings - Update settings for the active store & business
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    if (!ctx.storeId) {
      return NextResponse.json({ success: false, error: "No active store selected." }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Business / Store name is required." }, { status: 400 });
    }

    const enableGst = Boolean(body.enableGst);
    const gstNumber = String(body.gstNumber || "").trim().toUpperCase();

    if (enableGst && !gstNumber) {
      return NextResponse.json({ success: false, error: "GST Number is required when GST is enabled." }, { status: 400 });
    }

    const isPriceInclusiveGst = enableGst ? Boolean(body.isPriceInclusiveGst) : false;
    const cgstPercent = enableGst ? Math.max(0, Number(body.cgstPercent) || 0) : 0;
    const sgstPercent = enableGst ? Math.max(0, Number(body.sgstPercent) || 0) : 0;

    // Update store row
    await ctx.supabase
      .from("stores")
      .update({
        name,
        phone: String(body.phone || "").trim(),
        mobile_number: String(body.phone || "").trim(),
        full_address: String(body.address || "").trim(),
        city: String(body.city || "").trim(),
        gst_number: gstNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.storeId)
      .eq("business_id", ctx.businessId);

    // Save extended settings in business_settings
    const extendedSettings = {
      state: String(body.state || "").trim(),
      pincode: String(body.pincode || "").trim(),
      businessType: String(body.businessType || "Retail Store").trim(),
      logoUrl: String(body.logoUrl || "").trim(),
      tagline: String(body.tagline || "").trim(),
      website: String(body.website || "").trim(),
      enableGst,
      gstNumber,
      isPriceInclusiveGst,
      cgstPercent,
      sgstPercent,
      enableRoundOff: Boolean(body.enableRoundOff),
    };

    await ctx.supabase
      .from("business_settings")
      .upsert({
        business_id: ctx.businessId,
        store_id: ctx.storeId,
        settings: extendedSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id,store_id" });

    return NextResponse.json({
      success: true,
      message: "Store settings updated successfully.",
      settings: {
        id: ctx.storeId,
        name,
        phone: String(body.phone || "").trim(),
        address: String(body.address || "").trim(),
        city: String(body.city || "").trim(),
        ...extendedSettings,
      },
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ success: false, error: "Failed to update store settings." }, { status: 500 });
  }
}
