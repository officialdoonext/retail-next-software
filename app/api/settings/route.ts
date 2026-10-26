import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/settings - Retrieve settings for the active business & store
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    // 1. Fetch Business record
    const { data: business } = await ctx.supabase
      .from("businesses")
      .select("*")
      .eq("id", ctx.businessId)
      .maybeSingle();

    // 2. Fetch Store record if active store exists
    let store: any = null;
    if (ctx.storeId) {
      const { data: sData } = await ctx.supabase
        .from("stores")
        .select("*")
        .eq("id", ctx.storeId)
        .eq("business_id", ctx.businessId)
        .maybeSingle();
      store = sData;
    }

    // 3. Fetch extended business settings
    let bQuery = ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      bQuery = bQuery.eq("store_id", ctx.storeId);
    }

    const { data: bSettings } = await bQuery.limit(1).maybeSingle();
    const extra = bSettings?.settings || {};
    const profile = extra.profile || {};

    const settings = {
      id: store?.id || business?.id || ctx.businessId,
      businessId: ctx.businessId,
      storeId: ctx.storeId || null,

      // Profile details requested: logo, name, mobile, email, address, GST
      logoUrl: profile.logoUrl || extra.logoUrl || business?.logo_url || "",
      name: profile.name || business?.name || store?.name || "",
      mobileNumber: profile.mobileNumber || business?.mobile_number || store?.phone || store?.mobile_number || "",
      phone: profile.mobileNumber || store?.phone || business?.mobile_number || "",
      email: profile.email || business?.email || ctx.email || "",
      address: profile.address || extra.address || business?.address || store?.full_address || store?.location || "",
      city: profile.city || store?.city || extra.city || "",
      state: profile.state || extra.state || "",
      pincode: profile.pincode || extra.pincode || "",
      gstNumber: profile.gstNumber || store?.gst_number || extra.gstNumber || business?.gst_number || "",

      // Business & Store Meta
      businessType: extra.businessType || "Retail Store",
      code: store?.code || "",
      license: store?.license || "",
      tagline: extra.tagline || "",
      website: extra.website || "",

      // GST Settings
      enableGst: Boolean(extra.enableGst ?? Boolean(profile.gstNumber || store?.gst_number)),
      isPriceInclusiveGst: Boolean(extra.isPriceInclusiveGst ?? true),
      cgstPercent: typeof extra.cgstPercent === "number" ? extra.cgstPercent : 9,
      sgstPercent: typeof extra.sgstPercent === "number" ? extra.sgstPercent : 9,

      // Round Off & Receipt Formatting
      enableRoundOff: Boolean(extra.enableRoundOff ?? true),
      invoicePrefix: extra.invoicePrefix || "INV",
      thermalReceiptFooter: extra.thermalReceiptFooter || "Thank you for shopping with us! Visit again.",
      printerPaperSize: extra.printerPaperSize || "80mm",
    };

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to fetch settings." }, { status: 500 });
  }
}

// PUT /api/settings - Update settings for the active business & store
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || body.businessName || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Business name is required." }, { status: 400 });
    }

    const mobileNumber = String(body.mobileNumber || body.phone || "").trim();
    const email = String(body.email || ctx.email || "").trim();
    const address = String(body.address || "").trim();
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim();
    const pincode = String(body.pincode || "").trim();
    const gstNumber = String(body.gstNumber || "").trim().toUpperCase();
    const logoUrl = String(body.logoUrl || "").trim();

    const enableGst = body.enableGst !== undefined ? Boolean(body.enableGst) : Boolean(gstNumber);
    const isPriceInclusiveGst = body.isPriceInclusiveGst !== undefined ? Boolean(body.isPriceInclusiveGst) : true;
    const cgstPercent = Math.max(0, Number(body.cgstPercent) || 0);
    const sgstPercent = Math.max(0, Number(body.sgstPercent) || 0);

    // 1. Update businesses table (core columns)
    const businessUpdateData: any = {
      name,
      mobile_number: mobileNumber,
      email: email || ctx.email,
      updated_at: new Date().toISOString(),
    };

    // Attempt direct columns if available in database
    try {
      await ctx.supabase
        .from("businesses")
        .update(businessUpdateData)
        .eq("id", ctx.businessId);
    } catch (bErr) {
      console.warn("Could not update core businesses table:", bErr);
    }

    // 2. Update store row if active store is selected
    if (ctx.storeId) {
      try {
        await ctx.supabase
          .from("stores")
          .update({
            name,
            phone: mobileNumber,
            mobile_number: mobileNumber,
            full_address: address,
            city,
            gst_number: gstNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ctx.storeId)
          .eq("business_id", ctx.businessId);
      } catch (sErr) {
        console.warn("Could not update store row:", sErr);
      }
    }

    // 3. Upsert extended profile & configuration into business_settings
    const extendedSettings = {
      profile: {
        logoUrl,
        name,
        mobileNumber,
        email,
        address,
        city,
        state,
        pincode,
        gstNumber,
      },
      logoUrl,
      address,
      city,
      state,
      pincode,
      gstNumber,
      businessType: String(body.businessType || "Retail Store").trim(),
      tagline: String(body.tagline || "").trim(),
      website: String(body.website || "").trim(),
      enableGst,
      isPriceInclusiveGst,
      cgstPercent,
      sgstPercent,
      enableRoundOff: Boolean(body.enableRoundOff ?? true),
      invoicePrefix: String(body.invoicePrefix || "INV").trim(),
      thermalReceiptFooter: String(body.thermalReceiptFooter || "Thank you for shopping with us! Visit again.").trim(),
      printerPaperSize: String(body.printerPaperSize || "80mm").trim(),
    };

    // Upsert into business_settings (handles both with and without storeId)
    const upsertPayload: any = {
      business_id: ctx.businessId,
      settings: extendedSettings,
      updated_at: new Date().toISOString(),
    };
    if (ctx.storeId) {
      upsertPayload.store_id = ctx.storeId;
    }

    const { error: setErr } = await ctx.supabase
      .from("business_settings")
      .upsert(upsertPayload, { onConflict: "business_id,store_id" });

    if (setErr) {
      console.warn("Upsert with store_id conflict failed, trying fallback:", setErr.message);
      // Fallback update without composite conflict constraint if needed
      await ctx.supabase
        .from("business_settings")
        .update({ settings: extendedSettings, updated_at: new Date().toISOString() })
        .eq("business_id", ctx.businessId);
    }

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully.",
      settings: {
        businessId: ctx.businessId,
        storeId: ctx.storeId || null,
        ...extendedSettings.profile,
        ...extendedSettings,
      },
    });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to update settings." }, { status: 500 });
  }
}
