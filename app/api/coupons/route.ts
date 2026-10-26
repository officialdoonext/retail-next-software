import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  CouponItem,
  CouponType,
  INITIAL_ORDER_COUPONS,
  INITIAL_PRODUCT_COUPONS,
  INITIAL_CUSTOMER_COUPONS,
  computeCouponStatus,
} from "@/lib/coupons";

async function resolveContext() {
  let ctx = await getBusinessContext();
  if (!ctx) {
    try {
      const admin = getSupabaseAdmin();
      const { data: bData } = await admin.from("businesses").select("id").limit(1).maybeSingle();
      if (bData?.id) {
        ctx = {
          businessId: bData.id,
          storeId: undefined,
          supabase: admin,
          email: "admin@doonext.com",
          role: "Admin",
        } as any;
      }
    } catch (e) {
      console.warn("Fallback business lookup failed:", e);
    }
  }
  return ctx;
}

async function getCouponsFromSettings(ctx: any): Promise<{ coupons: CouponItem[]; rawSettingsRow: any }> {
  const { data: bSettings } = await ctx.supabase
    .from("business_settings")
    .select("id, settings")
    .eq("business_id", ctx.businessId)
    .eq("store_id", ctx.storeId || null)
    .maybeSingle();

  let existingCoupons: CouponItem[] = bSettings?.settings?.coupons;

  if (!Array.isArray(existingCoupons)) {
    existingCoupons = [];
  } else {
    const dummyCodes = new Set([
      "WELCOME100", "FESTIVE20", "FLAT500", "UPI50", "WEEKEND15",
      "DENIM30", "BOGO-SHIRT", "BUNDLE-TEE", "SILK-15", "WINTER-FLAT400",
      "VIP-PRIVILEGE", "BDAY-OCT500", "ANNIV-GIFT", "WINBACK300", "PATRON-ANANYA"
    ]);

    const filtered = existingCoupons.filter(
      (c) =>
        !c.id.startsWith("ord-cp-") &&
        !c.id.startsWith("prd-cp-") &&
        !c.id.startsWith("cst-cp-") &&
        !dummyCodes.has(c.code.toUpperCase())
    );

    if (filtered.length !== existingCoupons.length) {
      existingCoupons = filtered;
      if (bSettings?.id) {
        await ctx.supabase
          .from("business_settings")
          .update({
            settings: { ...(bSettings.settings || {}), coupons: filtered },
            updated_at: new Date().toISOString(),
          })
          .eq("id", bSettings.id);
      }
    }
  }

  return { coupons: existingCoupons, rawSettingsRow: bSettings };
}

async function saveCouponsToSettings(ctx: any, coupons: CouponItem[], bSettings: any) {
  const updatedSettings = {
    ...(bSettings?.settings || {}),
    coupons,
  };

  if (bSettings?.id) {
    const { error } = await ctx.supabase
      .from("business_settings")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("id", bSettings.id);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await ctx.supabase
      .from("business_settings")
      .insert({
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        settings: updatedSettings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    if (inserted) bSettings = { id: inserted.id, settings: updatedSettings };
  }
}

// GET: Fetch coupons filtered by type (order, product, customer), search query & status
export async function GET(request: Request) {
  try {
    const ctx = await resolveContext();

    const { searchParams } = new URL(request.url);
    const filterType = (searchParams.get("type") || "order").toLowerCase() as CouponType | "all";
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").trim();

    let coupons: CouponItem[] = [];

    if (ctx) {
      const data = await getCouponsFromSettings(ctx);
      coupons = data.coupons;
    } else {
      coupons = [];
    }

    // Refresh status based on dates
    let processed = coupons.map((c) => ({
      ...c,
      status: computeCouponStatus(c),
    }));

    if (filterType !== "all") {
      processed = processed.filter((c) => c.type === filterType);
    }

    if (searchQuery) {
      processed = processed.filter(
        (c) =>
          c.code.toLowerCase().includes(searchQuery) ||
          c.title.toLowerCase().includes(searchQuery) ||
          (c.description && c.description.toLowerCase().includes(searchQuery))
      );
    }

    if (statusFilter && statusFilter.toLowerCase() !== "all") {
      processed = processed.filter(
        (c) => c.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Sort newest first
    processed.sort((a, b) => b.createdAt - a.createdAt);

    // Compute stats
    const totalCount = processed.length;
    const activeCount = processed.filter((c) => c.status === "Active").length;
    const totalRedemptions = processed.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    const totalSavingsEstimated = processed.reduce((sum, c) => {
      const avgSaving = c.discountType === "flat" ? c.discountValue : 250;
      return sum + (c.usedCount || 0) * avgSaving;
    }, 0);

    return NextResponse.json({
      success: true,
      coupons: processed,
      stats: {
        total: totalCount,
        active: activeCount,
        totalRedemptions,
        totalSavingsEstimated,
      },
    });
  } catch (err: any) {
    console.error("GET /api/coupons error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load coupons." },
      { status: 500 }
    );
  }
}

// POST: Create a new coupon
export async function POST(request: Request) {
  try {
    const ctx = await resolveContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { code, title, type, discountType, discountValue } = body;

    if (!code || !String(code).trim()) {
      return NextResponse.json({ success: false, error: "Coupon code is required." }, { status: 400 });
    }
    if (!title || !String(title).trim()) {
      return NextResponse.json({ success: false, error: "Coupon title is required." }, { status: 400 });
    }

    const cleanCode = String(code).trim().toUpperCase();

    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);

    // Check duplicate code
    const duplicate = coupons.find(
      (c) => c.code.toUpperCase() === cleanCode
    );
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: `Coupon code '${cleanCode}' already exists.` },
        { status: 409 }
      );
    }

    const newCoupon: CouponItem = {
      id: `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: (type || "order") as CouponType,
      code: cleanCode,
      title: String(title).trim(),
      description: body.description || "",
      discountType: (discountType || "percentage") as any,
      discountValue: Math.max(0, Number(discountValue) || 0),
      maxDiscountCap: body.maxDiscountCap ? Number(body.maxDiscountCap) : undefined,
      minOrderValue: body.minOrderValue ? Number(body.minOrderValue) : 0,

      targetType: body.targetType || "all",
      targetProductIds: Array.isArray(body.targetProductIds) ? body.targetProductIds : [],
      targetCategoryIds: Array.isArray(body.targetCategoryIds) ? body.targetCategoryIds : [],
      bogoBuyQty: body.bogoBuyQty ? Number(body.bogoBuyQty) : undefined,
      bogoGetQty: body.bogoGetQty ? Number(body.bogoGetQty) : undefined,
      bogoDiscountPercent: body.bogoDiscountPercent ? Number(body.bogoDiscountPercent) : undefined,
      bundleQty: body.bundleQty ? Number(body.bundleQty) : undefined,
      bundlePrice: body.bundlePrice ? Number(body.bundlePrice) : undefined,

      customerScope: body.customerScope || "all",
      targetCustomerPhones: Array.isArray(body.targetCustomerPhones) ? body.targetCustomerPhones : [],
      targetCustomerGroup: body.targetCustomerGroup || "",
      milestoneType: body.milestoneType || undefined,
      isSingleUsePerCustomer: Boolean(body.isSingleUsePerCustomer),

      totalUsageLimit: body.totalUsageLimit ? Number(body.totalUsageLimit) : undefined,
      usedCount: 0,
      perCustomerLimit: body.perCustomerLimit ? Number(body.perCustomerLimit) : 1,
      allowedPaymentModes: Array.isArray(body.allowedPaymentModes) && body.allowedPaymentModes.length > 0
        ? body.allowedPaymentModes
        : ["All"],
      excludeSaleItems: Boolean(body.excludeSaleItems),
      autoApplyAtCheckout: Boolean(body.autoApplyAtCheckout),

      startDate: body.startDate || new Date().toISOString().split("T")[0],
      startTime: body.startTime || "00:00",
      endDate: body.endDate || "2026-12-31",
      endTime: body.endTime || "23:59",
      neverExpires: Boolean(body.neverExpires),
      status: (body.status || "Active") as any,

      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    coupons.unshift(newCoupon);
    await saveCouponsToSettings(ctx, coupons, rawSettingsRow);

    return NextResponse.json({
      success: true,
      coupon: newCoupon,
      message: `Coupon ${newCoupon.code} created successfully.`,
    });
  } catch (err: any) {
    console.error("POST /api/coupons error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create coupon." },
      { status: 500 }
    );
  }
}

// PUT: Update an existing coupon
export async function PUT(request: Request) {
  try {
    const ctx = await resolveContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { id, code } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Coupon ID is required." }, { status: 400 });
    }

    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
    const index = coupons.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: "Coupon not found." }, { status: 404 });
    }

    const cleanCode = code ? String(code).trim().toUpperCase() : coupons[index].code;

    // Check code collision with other coupons
    const conflict = coupons.find(
      (c) => c.id !== id && c.code.toUpperCase() === cleanCode
    );
    if (conflict) {
      return NextResponse.json(
        { success: false, error: `Coupon code '${cleanCode}' is already in use by another campaign.` },
        { status: 409 }
      );
    }

    const updated: CouponItem = {
      ...coupons[index],
      ...body,
      id, // Preserve ID
      code: cleanCode,
      discountValue: body.discountValue !== undefined ? Math.max(0, Number(body.discountValue) || 0) : coupons[index].discountValue,
      minOrderValue: body.minOrderValue !== undefined ? Math.max(0, Number(body.minOrderValue) || 0) : coupons[index].minOrderValue,
      maxDiscountCap: body.maxDiscountCap !== undefined ? (body.maxDiscountCap ? Number(body.maxDiscountCap) : undefined) : coupons[index].maxDiscountCap,
      updatedAt: Date.now(),
    };

    coupons[index] = updated;
    await saveCouponsToSettings(ctx, coupons, rawSettingsRow);

    return NextResponse.json({
      success: true,
      coupon: updated,
      message: `Coupon ${updated.code} updated successfully.`,
    });
  } catch (err: any) {
    console.error("PUT /api/coupons error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update coupon." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a coupon by ID
export async function DELETE(request: Request) {
  try {
    const ctx = await resolveContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Coupon ID is required." }, { status: 400 });
    }

    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
    const filtered = coupons.filter((c) => c.id !== id);

    if (filtered.length === coupons.length) {
      return NextResponse.json({ success: false, error: "Coupon not found." }, { status: 404 });
    }

    await saveCouponsToSettings(ctx, filtered, rawSettingsRow);

    return NextResponse.json({
      success: true,
      message: "Coupon deleted successfully.",
    });
  } catch (err: any) {
    console.error("DELETE /api/coupons error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete coupon." },
      { status: 500 }
    );
  }
}

// PATCH: Toggle active/inactive status
export async function PATCH(request: Request) {
  try {
    const ctx = await resolveContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Coupon ID is required." }, { status: 400 });
    }

    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
    const index = coupons.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: "Coupon not found." }, { status: 404 });
    }

    const nextStatus = status || (coupons[index].status === "Active" ? "Inactive" : "Active");
    coupons[index].status = nextStatus;
    coupons[index].updatedAt = Date.now();

    await saveCouponsToSettings(ctx, coupons, rawSettingsRow);

    return NextResponse.json({
      success: true,
      status: nextStatus,
      coupon: coupons[index],
    });
  } catch (err: any) {
    console.error("PATCH /api/coupons error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to toggle status." },
      { status: 500 }
    );
  }
}
