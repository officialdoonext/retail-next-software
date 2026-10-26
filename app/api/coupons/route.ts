import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import { getSupabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";
import {
  CouponItem,
  CouponType,
  computeCouponStatus,
} from "@/lib/coupons";

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

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

// Convert DB snake_case row to CouponItem
function rowToCouponItem(row: any): CouponItem {
  return {
    id: row.id,
    type: row.type,
    code: row.code,
    title: row.title,
    description: row.description || "",
    discountType: row.discount_type,
    discountValue: Number(row.discount_value) || 0,
    maxDiscountCap: row.max_discount_cap != null ? Number(row.max_discount_cap) : undefined,
    minOrderValue: row.min_order_value != null ? Number(row.min_order_value) : 0,

    targetType: row.target_type || "all",
    targetProductIds: Array.isArray(row.target_product_ids) ? row.target_product_ids : [],
    targetCategoryIds: Array.isArray(row.target_category_ids) ? row.target_category_ids : [],
    bogoBuyQty: row.bogo_buy_qty != null ? Number(row.bogo_buy_qty) : undefined,
    bogoGetQty: row.bogo_get_qty != null ? Number(row.bogo_get_qty) : undefined,
    bogoDiscountPercent: row.bogo_discount_percent != null ? Number(row.bogo_discount_percent) : undefined,
    bundleQty: row.bundle_qty != null ? Number(row.bundle_qty) : undefined,
    bundlePrice: row.bundle_price != null ? Number(row.bundle_price) : undefined,

    customerScope: row.customer_scope || "all",
    targetCustomerPhones: Array.isArray(row.target_customer_phones) ? row.target_customer_phones : [],
    targetCustomerGroup: row.target_customer_group || "",
    milestoneType: row.milestone_type || undefined,
    isSingleUsePerCustomer: Boolean(row.is_single_use_per_customer),

    totalUsageLimit: row.total_usage_limit != null ? Number(row.total_usage_limit) : undefined,
    usedCount: Number(row.used_count) || 0,
    perCustomerLimit: row.per_customer_limit != null ? Number(row.per_customer_limit) : 1,
    allowedPaymentModes: Array.isArray(row.allowed_payment_modes) ? row.allowed_payment_modes : ["All"],
    excludeSaleItems: Boolean(row.exclude_sale_items),
    autoApplyAtCheckout: Boolean(row.auto_apply_at_checkout),

    startDate: row.start_date || "",
    startTime: row.start_time || "",
    endDate: row.end_date || "",
    endTime: row.end_time || "",
    neverExpires: Boolean(row.never_expires),
    status: row.status || "Active",

    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Convert CouponItem to DB snake_case row
function couponItemToRow(c: Partial<CouponItem>, businessId: string, storeId?: string | null): any {
  const row: any = {
    id: c.id && isValidUUID(c.id) ? c.id : randomUUID(),
    business_id: businessId,
    store_id: storeId || null,
    type: c.type,
    code: c.code,
    title: c.title,
    description: c.description || "",
    discount_type: c.discountType,
    discount_value: c.discountValue ?? 0,
    max_discount_cap: c.maxDiscountCap != null ? c.maxDiscountCap : null,
    min_order_value: c.minOrderValue != null ? c.minOrderValue : 0,

    target_type: c.targetType || "all",
    target_product_ids: c.targetProductIds || [],
    target_category_ids: c.targetCategoryIds || [],
    bogo_buy_qty: c.bogoBuyQty != null ? c.bogoBuyQty : null,
    bogo_get_qty: c.bogoGetQty != null ? c.bogoGetQty : null,
    bogo_discount_percent: c.bogoDiscountPercent != null ? c.bogoDiscountPercent : null,
    bundle_qty: c.bundleQty != null ? c.bundleQty : null,
    bundle_price: c.bundlePrice != null ? c.bundlePrice : null,

    customer_scope: c.customerScope || "all",
    target_customer_phones: c.targetCustomerPhones || [],
    target_customer_group: c.targetCustomerGroup || "",
    milestone_type: c.milestoneType || null,
    is_single_use_per_customer: Boolean(c.isSingleUsePerCustomer),

    total_usage_limit: c.totalUsageLimit != null ? c.totalUsageLimit : null,
    used_count: c.usedCount || 0,
    per_customer_limit: c.perCustomerLimit != null ? c.perCustomerLimit : 1,
    allowed_payment_modes: c.allowedPaymentModes || ["All"],
    exclude_sale_items: Boolean(c.excludeSaleItems),
    auto_apply_at_checkout: Boolean(c.autoApplyAtCheckout),

    start_date: c.startDate || null,
    start_time: c.startTime || null,
    end_date: c.endDate || null,
    end_time: c.endTime || null,
    never_expires: Boolean(c.neverExpires),
    status: c.status || "Active",
    updated_at: new Date().toISOString(),
  };

  return row;
}

// Fallback helpers for business_settings (in case public.coupons table is pending execution in SQL editor)
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
      // First attempt querying the dedicated public.coupons table
      const { data: dbCoupons, error: dbError } = await ctx.supabase
        .from("coupons")
        .select("*")
        .eq("business_id", ctx.businessId);

      if (!dbError && Array.isArray(dbCoupons)) {
        coupons = dbCoupons.map(rowToCouponItem);
      } else {
        // Fallback to business_settings
        const data = await getCouponsFromSettings(ctx);
        coupons = data.coupons;
      }
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
    const couponId = body.id && isValidUUID(body.id) ? body.id : randomUUID();

    const newCoupon: CouponItem = {
      id: couponId,
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

      startDate: body.startDate || "",
      startTime: body.startTime || "",
      endDate: body.endDate || "",
      endTime: body.endTime || "",
      neverExpires: Boolean(body.neverExpires),
      status: (body.status || "Active") as any,

      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Try inserting into public.coupons table first
    const row = couponItemToRow(newCoupon, ctx.businessId, ctx.storeId);
    const { data: insertedRow, error: insertError } = await ctx.supabase
      .from("coupons")
      .insert([row])
      .select("*")
      .single();

    if (!insertError && insertedRow) {
      return NextResponse.json({
        success: true,
        coupon: rowToCouponItem(insertedRow),
        message: `Coupon ${newCoupon.code} created successfully.`,
      });
    }

    // Check duplicate code error from unique constraint
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { success: false, error: `Coupon code '${cleanCode}' already exists.` },
        { status: 409 }
      );
    }

    // If table doesn't exist yet (PGRST205), fallback to business_settings
    if (insertError?.code === "PGRST205") {
      console.warn("coupons table insert fallback:", insertError?.message);
      const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
      const duplicate = coupons.find((c) => c.code.toUpperCase() === cleanCode);
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Coupon code '${cleanCode}' already exists.` },
          { status: 409 }
        );
      }

      coupons.unshift(newCoupon);
      await saveCouponsToSettings(ctx, coupons, rawSettingsRow);

      return NextResponse.json({
        success: true,
        coupon: newCoupon,
        message: `Coupon ${newCoupon.code} created successfully.`,
      });
    }

    console.error("Coupons insert error:", insertError);
    return NextResponse.json(
      { success: false, error: insertError?.message || "Failed to create coupon." },
      { status: 500 }
    );
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

    const cleanCode = code ? String(code).trim().toUpperCase() : undefined;

    // Try updating public.coupons table if valid UUID
    if (isValidUUID(id)) {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (cleanCode) updateData.code = cleanCode;
      if (body.title !== undefined) updateData.title = String(body.title).trim();
      if (body.description !== undefined) updateData.description = body.description || "";
      if (body.type !== undefined) updateData.type = body.type;
      if (body.discountType !== undefined) updateData.discount_type = body.discountType;
      if (body.discountValue !== undefined) updateData.discount_value = Math.max(0, Number(body.discountValue) || 0);
      if (body.maxDiscountCap !== undefined) updateData.max_discount_cap = body.maxDiscountCap ? Number(body.maxDiscountCap) : null;
      if (body.minOrderValue !== undefined) updateData.min_order_value = body.minOrderValue ? Number(body.minOrderValue) : 0;
      if (body.targetType !== undefined) updateData.target_type = body.targetType;
      if (body.targetProductIds !== undefined) updateData.target_product_ids = body.targetProductIds;
      if (body.targetCategoryIds !== undefined) updateData.target_category_ids = body.targetCategoryIds;
      if (body.bogoBuyQty !== undefined) updateData.bogo_buy_qty = body.bogoBuyQty ? Number(body.bogoBuyQty) : null;
      if (body.bogoGetQty !== undefined) updateData.bogo_get_qty = body.bogoGetQty ? Number(body.bogoGetQty) : null;
      if (body.bogoDiscountPercent !== undefined) updateData.bogo_discount_percent = body.bogoDiscountPercent ? Number(body.bogoDiscountPercent) : null;
      if (body.bundleQty !== undefined) updateData.bundle_qty = body.bundleQty ? Number(body.bundleQty) : null;
      if (body.bundlePrice !== undefined) updateData.bundle_price = body.bundlePrice ? Number(body.bundlePrice) : null;
      if (body.customerScope !== undefined) updateData.customer_scope = body.customerScope;
      if (body.targetCustomerPhones !== undefined) updateData.target_customer_phones = body.targetCustomerPhones;
      if (body.targetCustomerGroup !== undefined) updateData.target_customer_group = body.targetCustomerGroup;
      if (body.milestoneType !== undefined) updateData.milestone_type = body.milestoneType || null;
      if (body.isSingleUsePerCustomer !== undefined) updateData.is_single_use_per_customer = Boolean(body.isSingleUsePerCustomer);
      if (body.totalUsageLimit !== undefined) updateData.total_usage_limit = body.totalUsageLimit ? Number(body.totalUsageLimit) : null;
      if (body.perCustomerLimit !== undefined) updateData.per_customer_limit = body.perCustomerLimit ? Number(body.perCustomerLimit) : 1;
      if (body.allowedPaymentModes !== undefined) updateData.allowed_payment_modes = body.allowedPaymentModes;
      if (body.excludeSaleItems !== undefined) updateData.exclude_sale_items = Boolean(body.excludeSaleItems);
      if (body.autoApplyAtCheckout !== undefined) updateData.auto_apply_at_checkout = Boolean(body.autoApplyAtCheckout);
      if (body.startDate !== undefined) updateData.start_date = body.startDate || null;
      if (body.startTime !== undefined) updateData.start_time = body.startTime || null;
      if (body.endDate !== undefined) updateData.end_date = body.endDate || null;
      if (body.endTime !== undefined) updateData.end_time = body.endTime || null;
      if (body.neverExpires !== undefined) updateData.never_expires = Boolean(body.neverExpires);
      if (body.status !== undefined) updateData.status = body.status;

      const { data: updatedRow, error: updateError } = await ctx.supabase
        .from("coupons")
        .update(updateData)
        .eq("id", id)
        .eq("business_id", ctx.businessId)
        .select("*")
        .maybeSingle();

      if (!updateError && updatedRow) {
        return NextResponse.json({
          success: true,
          coupon: rowToCouponItem(updatedRow),
          message: `Coupon ${updatedRow.code} updated successfully.`,
        });
      }

      if (updateError?.code === "23505") {
        return NextResponse.json(
          { success: false, error: `Coupon code '${cleanCode}' is already in use.` },
          { status: 409 }
        );
      }

      if (updateError && updateError.code !== "PGRST205") {
        console.error("Coupons update error:", updateError);
        return NextResponse.json(
          { success: false, error: updateError.message || "Failed to update coupon in database." },
          { status: 500 }
        );
      }
    }

    // Fallback to business_settings
    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
    const index = coupons.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: "Coupon not found." }, { status: 404 });
    }

    const finalCode = cleanCode || coupons[index].code;
    const conflict = coupons.find(
      (c) => c.id !== id && c.code.toUpperCase() === finalCode
    );
    if (conflict) {
      return NextResponse.json(
        { success: false, error: `Coupon code '${finalCode}' is already in use by another campaign.` },
        { status: 409 }
      );
    }

    const updated: CouponItem = {
      ...coupons[index],
      ...body,
      id,
      code: finalCode,
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

    // Try deleting from public.coupons table
    if (isValidUUID(id)) {
      const { data: deletedRows, error: deleteError } = await ctx.supabase
        .from("coupons")
        .delete()
        .eq("id", id)
        .eq("business_id", ctx.businessId)
        .select("id");

      if (!deleteError && deletedRows && deletedRows.length > 0) {
        return NextResponse.json({
          success: true,
          message: "Coupon deleted successfully.",
        });
      }
    }

    // Fallback to business_settings
    const { coupons, rawSettingsRow } = await getCouponsFromSettings(ctx);
    const filtered = coupons.filter((c) => c.id !== id);

    if (filtered.length !== coupons.length) {
      await saveCouponsToSettings(ctx, filtered, rawSettingsRow);
      return NextResponse.json({
        success: true,
        message: "Coupon deleted successfully.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Coupon removed.",
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

    // Try updating public.coupons table
    if (isValidUUID(id)) {
      const { data: existingRow } = await ctx.supabase
        .from("coupons")
        .select("status")
        .eq("id", id)
        .eq("business_id", ctx.businessId)
        .maybeSingle();

      if (existingRow) {
        const nextStatus = status || (existingRow.status === "Active" ? "Inactive" : "Active");
        const { data: updatedRow, error: updateError } = await ctx.supabase
          .from("coupons")
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("business_id", ctx.businessId)
          .select("*")
          .single();

        if (!updateError && updatedRow) {
          return NextResponse.json({
            success: true,
            status: nextStatus,
            coupon: rowToCouponItem(updatedRow),
          });
        }
      }
    }

    // Fallback to business_settings
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
