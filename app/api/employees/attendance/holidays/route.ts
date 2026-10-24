import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/attendance/holidays
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    let query = ctx.supabase
      .from("store_holidays")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data, error } = await query.order("date", { ascending: true });
    if (error) throw error;

    const holidays = (data || []).map((row: any) => ({
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      date: row.date,
      createdAt: new Date(row.created_at).getTime(),
    }));

    return NextResponse.json({ success: true, holidays });
  } catch (err: any) {
    console.error("GET holidays error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch holidays." },
      { status: 500 }
    );
  }
}

// POST /api/employees/attendance/holidays
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const date = String(body.date || "").trim();

    if (!name || !date) {
      return NextResponse.json(
        { success: false, error: "Holiday Name and Date are required." },
        { status: 400 }
      );
    }

    const holData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      date,
      created_by: ctx.session.email || "system",
    };

    const { data: newHol, error } = await ctx.supabase
      .from("store_holidays")
      .insert(holData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      holiday: {
        id: newHol.id,
        name: newHol.name,
        date: newHol.date,
        createdAt: new Date(newHol.created_at).getTime(),
      },
      message: "Holiday added successfully.",
    });
  } catch (err: any) {
    console.error("POST holidays error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to add holiday." },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/attendance/holidays?id=...
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Holiday ID required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("store_holidays")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Holiday deleted successfully." });
  } catch (err: any) {
    console.error("DELETE holidays error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete holiday." },
      { status: 500 }
    );
  }
}
