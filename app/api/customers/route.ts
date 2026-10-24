import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch customers for the active business & store
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
    const limitParam = searchParams.get("limit");
    const fetchAll = searchParams.get("all") === "true";
    const maxLimit = fetchAll ? 1000 : (limitParam ? parseInt(limitParam, 10) : 100);

    let query = ctx.supabase
      .from("customers")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: rawCustomers, error } = await query
      .order("created_at", { ascending: false })
      .limit(maxLimit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const customers = (rawCustomers || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      city: c.city || "",
      address: c.address || "",
      gstNumber: c.gst_number || "",
      totalSpend: Number(c.total_purchases) || 0,
      totalPurchases: Number(c.total_purchases) || 0,
      loyaltyPoints: Number(c.loyalty_points) || 0,
      storeId: c.store_id,
      businessId: c.business_id,
      createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
    }));

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch customers." }, { status: 500 });
  }
}

// POST: Add new customer in Supabase
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
    const phone = String(body.phone || body.mobileNumber || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const address = String(body.address || "").trim();

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

    const customerData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      phone,
      city: city || "",
      email: email || "",
      address: address || "",
      total_purchases: 0,
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
      customer: {
        id: insertedCust.id,
        name: insertedCust.name,
        phone: insertedCust.phone,
        city: insertedCust.city,
        email: insertedCust.email,
        address: insertedCust.address,
        totalSpend: 0,
        storeId: insertedCust.store_id,
        businessId: insertedCust.business_id,
      },
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
    const phone = String(body.phone || body.mobileNumber || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const address = String(body.address || "").trim();

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

    const updatePayload = {
      name,
      phone,
      city,
      email,
      address,
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
      return NextResponse.json({ success: false, error: "Failed to update customer or access denied." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: updatedCust.id,
        name: updatedCust.name,
        phone: updatedCust.phone,
        city: updatedCust.city,
        email: updatedCust.email,
        address: updatedCust.address,
        totalSpend: Number(updatedCust.total_purchases) || 0,
      },
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
