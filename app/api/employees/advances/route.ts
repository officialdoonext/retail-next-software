import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/advances
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const pendingOnly = searchParams.get("pendingOnly") === "true";

    let query = ctx.supabase
      .from("employee_advances")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    let advances = (data || []).map((row: any) => ({
      id: row.id,
      storeId: row.store_id,
      employeeId: row.employee_id,
      employeeNumericId: row.employee_numeric_id,
      employeeName: row.employee_name,
      amount: Number(row.amount) || 0,
      remainingAmount: Number(row.remaining_amount) || 0,
      date: row.date,
      notes: row.notes,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    }));

    if (pendingOnly) {
      advances = advances.filter(
        (a: any) => a.remainingAmount > 0 && a.status !== "Repaid"
      );
    }

    return NextResponse.json({ success: true, advances });
  } catch (err: any) {
    console.error("GET /api/employees/advances error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch advances." },
      { status: 500 }
    );
  }
}

// POST /api/employees/advances
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
    const { employeeId, employeeNumericId, employeeName, amount, date, notes } = body;

    const numAmount = Number(amount);
    if (!employeeId || !employeeName || !numAmount || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid Employee and Advance Amount are required." },
        { status: 400 }
      );
    }

    const advDate = date || new Date().toISOString().split("T")[0];

    const advanceData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      employee_id: employeeId,
      employee_numeric_id: employeeNumericId || "",
      employee_name: employeeName,
      amount: numAmount,
      remaining_amount: numAmount,
      date: advDate,
      notes: String(notes || "").trim(),
      status: "Pending",
      created_by: ctx.session.email || "system",
    };

    const { data: inserted, error } = await ctx.supabase
      .from("employee_advances")
      .insert(advanceData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      advance: {
        id: inserted.id,
        ...advanceData,
        createdAt: new Date(inserted.created_at).getTime(),
      },
      message: `Advance of ₹${numAmount.toLocaleString()} added for ${employeeName}.`,
    });
  } catch (err: any) {
    console.error("POST /api/employees/advances error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to record advance." },
      { status: 500 }
    );
  }
}
