import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET – fetch all staff for the active business & store
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    let query = ctx.supabase
      .from("staff")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: staffList, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const staff = (staffList || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      mobile: d.mobile,
      access: Array.isArray(d.access) ? d.access : [],
      status: d.status || "Active",
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      storeId: d.store_id,
      businessId: d.business_id,
    }));

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error("GET /api/staff error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch staff." }, { status: 500 });
  }
}

// POST – add a new staff member
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim().replace(/\D/g, "");
    const mpin = String(body.mpin || "").trim();
    const access: string[] = Array.isArray(body.access) ? body.access : [];

    if (!name) return NextResponse.json({ success: false, error: "Staff name is required." }, { status: 400 });
    if (!mobile || mobile.length < 10) return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    if (!mpin || mpin.length < 4) return NextResponse.json({ success: false, error: "MPIN must be at least 4 digits." }, { status: 400 });

    // Check duplicate mobile in this store
    let dupQuery = ctx.supabase
      .from("staff")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("mobile", mobile);

    if (ctx.storeId) {
      dupQuery = dupQuery.eq("store_id", ctx.storeId);
    }

    const { data: dupList } = await dupQuery;
    if (dupList && dupList.length > 0) {
      return NextResponse.json({ success: false, error: `Staff member with mobile ${mobile} already exists.` }, { status: 409 });
    }

    const staffData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      mobile,
      mpin,
      access,
      status: "Active",
      created_at: new Date().toISOString(),
    };

    const { data: insertedStaff, error } = await ctx.supabase
      .from("staff")
      .insert([staffData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: insertedStaff.id,
        name: insertedStaff.name,
        mobile: insertedStaff.mobile,
        access: insertedStaff.access,
        status: insertedStaff.status,
        storeId: insertedStaff.store_id,
        businessId: insertedStaff.business_id,
      },
    });
  } catch (err) {
    console.error("POST /api/staff error:", err);
    return NextResponse.json({ success: false, error: "Failed to add staff member." }, { status: 500 });
  }
}

// PUT – update staff access / details / status / MPIN
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ success: false, error: "Staff ID is required." }, { status: 400 });

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.status !== undefined) updateData.status = body.status;
    if (Array.isArray(body.access)) updateData.access = body.access;
    if (body.mpin !== undefined && String(body.mpin).trim().length >= 4) {
      updateData.mpin = String(body.mpin).trim();
    }

    const { data: updatedStaff, error } = await ctx.supabase
      .from("staff")
      .update(updateData)
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedStaff) {
      return NextResponse.json({ success: false, error: "Failed to update staff member." }, { status: 403 });
    }

    return NextResponse.json({ success: true, staff: updatedStaff });
  } catch (err) {
    console.error("PUT /api/staff error:", err);
    return NextResponse.json({ success: false, error: "Failed to update staff member." }, { status: 500 });
  }
}

// DELETE – remove staff member
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Staff ID is required." }, { status: 400 });

    const { error } = await ctx.supabase
      .from("staff")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Staff member deleted." });
  } catch (err) {
    console.error("DELETE /api/staff error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete staff member." }, { status: 500 });
  }
}
