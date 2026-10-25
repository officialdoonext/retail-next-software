import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// Generate customer code (e.g. MC8539)
export function generateCustomerCode(prefix = "MC"): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix.toUpperCase().slice(0, 3)}${randomNum}`;
}

// Convert database customer row to rich frontend view model
export function toCustomerViewModel(c: any) {
  let extra: Record<string, any> = {};
  let addressText = c.address || "";

  if (addressText && typeof addressText === "string" && addressText.startsWith("{")) {
    try {
      const parsed = JSON.parse(addressText);
      if (parsed && typeof parsed === "object") {
        extra = parsed;
        addressText = parsed.addressText || parsed.address || "";
      }
    } catch {}
  }

  const phone = String(c.phone || "").trim();
  const fallbackCode = `MC${phone ? phone.slice(-4) : Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: c.id,
    customerCode: extra.customerCode || c.customer_code || fallbackCode,
    name: c.name || "",
    phone: phone,
    email: c.email || extra.email || "",
    address: addressText,
    city: c.city || extra.city || "VIJAYAWADA",
    birthDate: extra.birthDate || "",
    hasBirthDate: Boolean(extra.hasBirthDate),
    anniversaryDate: extra.anniversaryDate || "",
    hasAnniversary: Boolean(extra.hasAnniversary),
    cardNo: extra.cardNo || "",
    cardValidity: extra.cardValidity || "2500-01-01",
    entryDate: extra.entryDate || (c.created_at ? new Date(c.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
    pin: extra.pin || "",
    tin: extra.tin || "",
    branch: extra.branch || "MADHU CREATIONS",
    ledger: extra.ledger || "Sundry Debtors",
    stopCredit: Boolean(extra.stopCredit),
    opCreditBalance: Number(extra.opCreditBalance) || 0,
    creditDays: Number(extra.creditDays) || 0,
    creditLimit: Number(extra.creditLimit) || 0,
    customerGroup: extra.customerGroup || "Retail",
    classification: extra.classification || "General",
    landline: extra.landline || "",
    billCycle: Number(extra.billCycle) || 1,
    opSales: Number(extra.opSales) || 0,
    remarks: extra.remarks || "",
    gstNumber: c.gst_number || extra.gstNumber || "",
    placeOfSupply: extra.placeOfSupply || "37-Andhra Pradesh",
    discountPercent: Number(extra.discountPercent) || 0,
    applyDiscountNonDisc: Boolean(extra.applyDiscountNonDisc),
    isInactive: Boolean(extra.isInactive),
    blockTSms: Boolean(extra.blockTSms),
    blockPSms: Boolean(extra.blockPSms),
    blockWa: Boolean(extra.blockWa),
    dontFollowup: Boolean(extra.dontFollowup),
    totalPurchases: Number(c.total_purchases) || 0,
    totalSpend: Number(c.total_purchases) || 0,
    loyaltyPoints: Number(c.loyalty_points) || 0,
    storeId: c.store_id,
    businessId: c.business_id,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
    updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
  };
}

// GET: Fetch customers with search & strict 24-item pagination
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fetchAll = searchParams.get("all") === "true";
    const searchQuery = searchParams.get("search")?.trim().toLowerCase() || "";
    const cityFilter = searchParams.get("city")?.trim() || "";
    const groupFilter = searchParams.get("group")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "all"; // all, active, inactive

    let query = ctx.supabase
      .from("customers")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: rawCustomers, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map to view models
    let allCustomers = (rawCustomers || []).map((c: any) => toCustomerViewModel(c));

    // Filter by search query
    if (searchQuery) {
      allCustomers = allCustomers.filter((c: any) => {
        return (
          c.name.toLowerCase().includes(searchQuery) ||
          c.phone.includes(searchQuery) ||
          c.customerCode.toLowerCase().includes(searchQuery) ||
          c.city.toLowerCase().includes(searchQuery) ||
          c.email.toLowerCase().includes(searchQuery) ||
          c.cardNo.toLowerCase().includes(searchQuery) ||
          c.gstNumber.toLowerCase().includes(searchQuery)
        );
      });
    }

    // Filter by city
    if (cityFilter && cityFilter !== "ALL") {
      allCustomers = allCustomers.filter((c: any) => c.city.toLowerCase() === cityFilter.toLowerCase());
    }

    // Filter by customer group
    if (groupFilter && groupFilter !== "ALL") {
      allCustomers = allCustomers.filter((c: any) => c.customerGroup.toLowerCase() === groupFilter.toLowerCase());
    }

    // Filter by status (active / inactive)
    if (statusFilter === "active") {
      allCustomers = allCustomers.filter((c: any) => !c.isInactive);
    } else if (statusFilter === "inactive") {
      allCustomers = allCustomers.filter((c: any) => c.isInactive);
    }

    // Return All if requested (e.g. for POS checkout dropdowns)
    if (fetchAll) {
      return NextResponse.json({
        success: true,
        customers: allCustomers,
        pagination: {
          total: allCustomers.length,
          totalPages: 1,
          page: 1,
          limit: allCustomers.length,
          hasMore: false,
        },
      });
    }

    // Strictly 24 items per page default pagination
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 24;

    const total = allCustomers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = allCustomers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      customers: paginatedCustomers,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch customers." }, { status: 500 });
  }
}

// POST: Add new customer with all fields
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const addressText = String(body.address || "").trim();
    const gstNumber = String(body.gstNumber || body.gstNo || "").trim().toUpperCase();

    if (!name) {
      return NextResponse.json({ success: false, error: "Customer name is required." }, { status: 400 });
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    // Check duplicate mobile within this business
    const { data: existingCust } = await ctx.supabase
      .from("customers")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("phone", phone)
      .limit(1);

    if (existingCust && existingCust.length > 0) {
      return NextResponse.json(
        { success: false, error: `Customer with mobile number ${phone} is already registered.` },
        { status: 409 }
      );
    }

    const customerCode = String(body.customerCode || "").trim() || generateCustomerCode("MC");

    // Store rich POS window fields packed into address JSON payload
    const extraFields = {
      customerCode,
      addressText,
      birthDate: body.birthDate || "",
      hasBirthDate: Boolean(body.hasBirthDate),
      anniversaryDate: body.anniversaryDate || "",
      hasAnniversary: Boolean(body.hasAnniversary),
      cardNo: String(body.cardNo || "").trim(),
      cardValidity: body.cardValidity || "2500-01-01",
      entryDate: body.entryDate || new Date().toISOString().split("T")[0],
      pin: String(body.pin || "").trim(),
      tin: String(body.tin || "").trim(),
      branch: String(body.branch || "MADHU CREATIONS").trim(),
      ledger: String(body.ledger || "Sundry Debtors").trim(),
      stopCredit: Boolean(body.stopCredit),
      opCreditBalance: Number(body.opCreditBalance) || 0,
      creditDays: Number(body.creditDays) || 0,
      creditLimit: Number(body.creditLimit) || 0,
      customerGroup: String(body.customerGroup || body.group || "Retail").trim(),
      classification: String(body.classification || "General").trim(),
      landline: String(body.landline || "").trim(),
      billCycle: Number(body.billCycle) || 1,
      opSales: Number(body.opSales) || 0,
      remarks: String(body.remarks || "").trim(),
      placeOfSupply: String(body.placeOfSupply || body.plOfSupp || "37-Andhra Pradesh").trim(),
      discountPercent: Number(body.discountPercent || body.discPercent) || 0,
      applyDiscountNonDisc: Boolean(body.applyDiscountNonDisc),
      isInactive: Boolean(body.isInactive),
      blockTSms: Boolean(body.blockTSms),
      blockPSms: Boolean(body.blockPSms),
      blockWa: Boolean(body.blockWa),
      dontFollowup: Boolean(body.dontFollowup),
    };

    const customerData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      phone,
      city: city || "VIJAYAWADA",
      email: email || "",
      address: JSON.stringify(extraFields),
      gst_number: gstNumber || null,
      total_purchases: 0,
      loyalty_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedCust, error } = await ctx.supabase
      .from("customers")
      .insert([customerData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      customer: toCustomerViewModel(insertedCust),
    });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ success: false, error: "Failed to save customer." }, { status: 500 });
  }
}

// PUT: Update customer details in Supabase
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Customer ID is required." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const addressText = String(body.address || "").trim();
    const gstNumber = String(body.gstNumber || body.gstNo || "").trim().toUpperCase();

    if (!name) {
      return NextResponse.json({ success: false, error: "Customer name is required." }, { status: 400 });
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }

    // Check duplicate phone
    const { data: dupList } = await ctx.supabase
      .from("customers")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("phone", phone);

    const hasDuplicate = (dupList || []).some((d: any) => d.id !== id);
    if (hasDuplicate) {
      return NextResponse.json(
        { success: false, error: `Another customer is already registered with mobile number ${phone}.` },
        { status: 409 }
      );
    }

    const customerCode = String(body.customerCode || "").trim() || generateCustomerCode("MC");

    const extraFields = {
      customerCode,
      addressText,
      birthDate: body.birthDate || "",
      hasBirthDate: Boolean(body.hasBirthDate),
      anniversaryDate: body.anniversaryDate || "",
      hasAnniversary: Boolean(body.hasAnniversary),
      cardNo: String(body.cardNo || "").trim(),
      cardValidity: body.cardValidity || "2500-01-01",
      entryDate: body.entryDate || new Date().toISOString().split("T")[0],
      pin: String(body.pin || "").trim(),
      tin: String(body.tin || "").trim(),
      branch: String(body.branch || "MADHU CREATIONS").trim(),
      ledger: String(body.ledger || "Sundry Debtors").trim(),
      stopCredit: Boolean(body.stopCredit),
      opCreditBalance: Number(body.opCreditBalance) || 0,
      creditDays: Number(body.creditDays) || 0,
      creditLimit: Number(body.creditLimit) || 0,
      customerGroup: String(body.customerGroup || body.group || "Retail").trim(),
      classification: String(body.classification || "General").trim(),
      landline: String(body.landline || "").trim(),
      billCycle: Number(body.billCycle) || 1,
      opSales: Number(body.opSales) || 0,
      remarks: String(body.remarks || "").trim(),
      placeOfSupply: String(body.placeOfSupply || body.plOfSupp || "37-Andhra Pradesh").trim(),
      discountPercent: Number(body.discountPercent || body.discPercent) || 0,
      applyDiscountNonDisc: Boolean(body.applyDiscountNonDisc),
      isInactive: Boolean(body.isInactive),
      blockTSms: Boolean(body.blockTSms),
      blockPSms: Boolean(body.blockPSms),
      blockWa: Boolean(body.blockWa),
      dontFollowup: Boolean(body.dontFollowup),
    };

    const updatePayload = {
      name,
      phone,
      city: city || "VIJAYAWADA",
      email: email || "",
      address: JSON.stringify(extraFields),
      gst_number: gstNumber || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCust, error } = await ctx.supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedCust) {
      return NextResponse.json({ success: false, error: error?.message || "Failed to update customer." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      customer: toCustomerViewModel(updatedCust),
    });
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json({ success: false, error: "Failed to update customer." }, { status: 500 });
  }
}

// DELETE: Remove customer in Supabase
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Customer ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Customer deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return NextResponse.json({ success: false, error: "Failed to delete customer." }, { status: 500 });
  }
}
