import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch warehouses for current business with search & 24-item pagination
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const search = searchParams.get("search")?.trim() || "";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = ctx.supabase
      .from("warehouses")
      .select("*", { count: "exact" })
      .eq("business_id", ctx.businessId);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,city.ilike.%${search}%,mobile_number.ilike.%${search}%,address.ilike.%${search}%`
      );
    }

    const { data: warehouses, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching warehouses from Supabase:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      success: true,
      warehouses: (warehouses || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        mobileNumber: w.mobile_number || w.phone || "",
        phone: w.phone || w.mobile_number || "",
        city: w.city || "",
        address: w.address || w.full_address || "",
        status: w.status || "Active",
        storeId: w.store_id || null,
        businessId: w.business_id,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error in warehouses GET:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch warehouses." }, { status: 500 });
  }
}

// POST: Add new warehouse
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const mobileNumber = String(body.mobileNumber || body.mobile_number || "").trim();
    const city = String(body.city || "").trim();
    const address = String(body.address || body.fullAddress || "").trim();
    const status = body.status === "Inactive" ? "Inactive" : "Active";

    if (!name) {
      return NextResponse.json({ success: false, error: "Warehouse name is required." }, { status: 400 });
    }

    const warehouseData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      mobile_number: mobileNumber,
      phone: mobileNumber,
      city,
      address,
      full_address: address,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newWarehouse, error } = await ctx.supabase
      .from("warehouses")
      .insert([warehouseData])
      .select()
      .single();

    if (error) {
      console.error("Error inserting warehouse into Supabase:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      warehouse: {
        id: newWarehouse.id,
        name: newWarehouse.name,
        mobileNumber: newWarehouse.mobile_number || "",
        phone: newWarehouse.phone || "",
        city: newWarehouse.city || "",
        address: newWarehouse.address || "",
        status: newWarehouse.status || "Active",
        businessId: newWarehouse.business_id,
        createdAt: newWarehouse.created_at,
      },
    });
  } catch (error: any) {
    console.error("Error in warehouses POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create warehouse." }, { status: 500 });
  }
}

// PUT: Update an existing warehouse
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const mobileNumber = String(body.mobileNumber || body.mobile_number || "").trim();
    const city = String(body.city || "").trim();
    const address = String(body.address || body.fullAddress || "").trim();
    const status = body.status === "Inactive" ? "Inactive" : "Active";

    if (!id || !name) {
      return NextResponse.json({ success: false, error: "Warehouse ID and name are required." }, { status: 400 });
    }

    const { data: updatedWarehouse, error } = await ctx.supabase
      .from("warehouses")
      .update({
        name,
        mobile_number: mobileNumber,
        phone: mobileNumber,
        city,
        address,
        full_address: address,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      warehouse: {
        id: updatedWarehouse.id,
        name: updatedWarehouse.name,
        mobileNumber: updatedWarehouse.mobile_number || "",
        phone: updatedWarehouse.phone || "",
        city: updatedWarehouse.city || "",
        address: updatedWarehouse.address || "",
        status: updatedWarehouse.status || "Active",
        businessId: updatedWarehouse.business_id,
        createdAt: updatedWarehouse.created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to update warehouse." }, { status: 500 });
  }
}

// DELETE: Delete a warehouse
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Warehouse ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("warehouses")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Warehouse deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to delete warehouse." }, { status: 500 });
  }
}
