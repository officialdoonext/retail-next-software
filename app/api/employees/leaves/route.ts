import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/leaves
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
    const date = searchParams.get("date"); // YYYY-MM-DD

    let query = ctx.supabase
      .from("employee_leaves")
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

    let leaves = (data || []).map((row: any) => ({
      id: row.id,
      storeId: row.store_id,
      employeeId: row.employee_id,
      employeeNumericId: row.employee_numeric_id,
      employeeName: row.employee_name,
      fromDate: row.from_date,
      toDate: row.to_date,
      daysCount: row.days_count,
      reason: row.reason,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    }));

    if (date) {
      leaves = leaves.filter((l: any) => l.fromDate <= date && l.toDate >= date);
    }

    return NextResponse.json({ success: true, leaves });
  } catch (err: any) {
    console.error("GET /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch leaves." },
      { status: 500 }
    );
  }
}

// POST /api/employees/leaves
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
    const { employeeId, employeeNumericId, employeeName, fromDate, toDate, reason } = body;

    if (!employeeId || !employeeName || !fromDate || !toDate) {
      return NextResponse.json(
        { success: false, error: "Employee, From Date, and To Date are required." },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { success: false, error: "From Date cannot be later than To Date." },
        { status: 400 }
      );
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaveData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      employee_id: employeeId,
      employee_numeric_id: employeeNumericId || "",
      employee_name: employeeName,
      from_date: fromDate,
      to_date: toDate,
      days_count: daysCount,
      reason: String(reason || "").trim(),
      status: "Approved",
      created_by: ctx.session.email || "system",
    };

    const { data: inserted, error } = await ctx.supabase
      .from("employee_leaves")
      .insert(leaveData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      leave: {
        id: inserted.id,
        ...leaveData,
        createdAt: new Date(inserted.created_at).getTime(),
      },
      message: "Leave added successfully.",
    });
  } catch (err: any) {
    console.error("POST /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to add leave." },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/leaves?id=...
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
      return NextResponse.json({ success: false, error: "Leave ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("employee_leaves")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Leave record deleted successfully." });
  } catch (err: any) {
    console.error("DELETE /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete leave." },
      { status: 500 }
    );
  }
}
