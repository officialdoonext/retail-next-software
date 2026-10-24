import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch all godowns for the active business & store
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    let query = ctx.supabase
      .from("godowns")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: rawGodowns, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const godowns = (rawGodowns || []).map((d: any) => ({
      id: d.id,
      name: d.name || "",
      address: d.location || "",
      location: d.location || "",
      storeId: d.store_id,
      businessId: d.business_id,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    }));

    return NextResponse.json({ success: true, godowns });
  } catch (error: any) {
    console.error("Error fetching godowns:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch godowns." }, { status: 500 });
  }
}

// POST: Create a new godown in Supabase
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Godown name is required." }, { status: 400 });
    }

    const godownData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      location: address,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await ctx.supabase
      .from("godowns")
      .insert([godownData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      godown: {
        id: inserted.id,
        name: inserted.name,
        address: inserted.location,
        storeId: inserted.store_id,
        businessId: inserted.business_id,
      },
    });
  } catch (error: any) {
    console.error("Error creating godown:", error);
    return NextResponse.json({ success: false, error: "Failed to create godown." }, { status: 500 });
  }
}

// PUT: Update an existing godown
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!id || !name) {
      return NextResponse.json({ success: false, error: "Godown ID and name are required." }, { status: 400 });
    }

    const { data: updated, error } = await ctx.supabase
      .from("godowns")
      .update({ name, location: address })
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ success: false, error: "Failed to update godown or access denied." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      godown: {
        id: updated.id,
        name: updated.name,
        address: updated.location,
      },
    });
  } catch (error: any) {
    console.error("Error updating godown:", error);
    return NextResponse.json({ success: false, error: "Failed to update godown." }, { status: 500 });
  }
}

// DELETE: Delete a godown
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const godownId = searchParams.get("id");

    if (!godownId) {
      return NextResponse.json({ success: false, error: "Godown ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("godowns")
      .delete()
      .eq("id", godownId)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Godown deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting godown:", error);
    return NextResponse.json({ success: false, error: "Failed to delete godown." }, { status: 500 });
  }
}
