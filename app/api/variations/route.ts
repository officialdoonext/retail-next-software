import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch variations strictly for the active business & store
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    let query = ctx.supabase
      .from("variations")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: variations, error } = await query.order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      variations: (variations || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        values: v.values || [],
        storeId: v.store_id,
        businessId: v.business_id,
        createdAt: v.created_at,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching variations:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch variations." }, { status: 500 });
  }
}

// POST: Add new variation for the active business & store
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const values = Array.isArray(body.values) ? body.values : [];

    if (!name) {
      return NextResponse.json({ success: false, error: "Variation name is required." }, { status: 400 });
    }

    const variationData = {
      name,
      values,
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      created_at: new Date().toISOString(),
    };

    const { data: newVar, error } = await ctx.supabase
      .from("variations")
      .insert([variationData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      variation: {
        id: newVar.id,
        name: newVar.name,
        values: newVar.values,
        storeId: newVar.store_id,
        businessId: newVar.business_id,
      },
    });
  } catch (error: any) {
    console.error("Error creating variation:", error);
    return NextResponse.json({ success: false, error: "Failed to create variation." }, { status: 500 });
  }
}

// PUT: Update variation name & values
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const values = Array.isArray(body.values) ? body.values : undefined;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: "Variation ID and name are required." }, { status: 400 });
    }

    const updatePayload: any = { name };
    if (values !== undefined) updatePayload.values = values;

    const { data: updatedVar, error } = await ctx.supabase
      .from("variations")
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedVar) {
      return NextResponse.json({ success: false, error: "Failed to update variation or access denied." }, { status: 403 });
    }

    return NextResponse.json({ success: true, variation: updatedVar });
  } catch (error: any) {
    console.error("Error updating variation:", error);
    return NextResponse.json({ success: false, error: "Failed to update variation." }, { status: 500 });
  }
}

// DELETE: Delete a variation belonging to active business
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const variationId = searchParams.get("id");

    if (!variationId) {
      return NextResponse.json({ success: false, error: "Variation ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("variations")
      .delete()
      .eq("id", variationId)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Variation deleted." });
  } catch (error: any) {
    console.error("Error deleting variation:", error);
    return NextResponse.json({ success: false, error: "Failed to delete variation." }, { status: 500 });
  }
}
