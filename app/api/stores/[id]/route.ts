import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch single store by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { data: store, error } = await ctx.supabase
      .from("stores")
      .select("*")
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .single();

    if (error || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      store,
    });
  } catch (error) {
    console.error("Error fetching store:", error);
    return NextResponse.json({ success: false, error: "Failed to retrieve store." }, { status: 500 });
  }
}

// PUT: Update store details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role === "Staff") {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const mobileNumber = String(body.mobileNumber || body.phone || "").trim();
    const city = String(body.city || "").trim();
    const fullAddress = String(body.fullAddress || body.address || "").trim();
    const gstNumber = String(body.gstNumber || body.license || "").trim().toUpperCase();
    const status = body.status ? (body.status === "Active" ? "Active" : "Inactive") : "Active";

    if (!name) {
      return NextResponse.json({ success: false, error: "Store name is required." }, { status: 400 });
    }

    const displayLocation = city ? (fullAddress ? `${city}, ${fullAddress}` : city) : fullAddress || "Main Branch";

    const updatedFields: any = {
      name,
      mobile_number: mobileNumber,
      phone: mobileNumber,
      city,
      full_address: fullAddress,
      location: displayLocation,
      gst_number: gstNumber,
      status,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedStore, error } = await ctx.supabase
      .from("stores")
      .update(updatedFields)
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedStore) {
      return NextResponse.json({ success: false, error: "Failed to update store." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      store: updatedStore,
    });
  } catch (error) {
    console.error("Error updating store:", error);
    return NextResponse.json({ success: false, error: "Failed to update store." }, { status: 500 });
  }
}

// DELETE: Delete store
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role === "Staff") {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    const { id } = await params;
    const { error } = await ctx.supabase
      .from("stores")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Store deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting store:", error);
    return NextResponse.json({ success: false, error: "Failed to delete store." }, { status: 500 });
  }
}
