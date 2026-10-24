import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/attendance?date=YYYY-MM-DD
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
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const month = searchParams.get("month"); // e.g. "2026-09"

    let attQuery = ctx.supabase
      .from("employee_attendance")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      attQuery = attQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    if (month) {
      const startOfMonth = `${month}-01`;
      const endOfMonth = `${month}-31`;
      attQuery = attQuery.gte("date", startOfMonth).lte("date", endOfMonth);
    } else {
      attQuery = attQuery.eq("date", date);
    }

    const { data: attData, error: attErr } = await attQuery;
    if (attErr) throw attErr;

    const attendance = (attData || []).map((row: any) => ({
      id: row.id,
      storeId: row.store_id,
      employeeId: row.employee_id,
      employeeNumericId: row.employee_numeric_id,
      employeeName: row.employee_name,
      date: row.date,
      status: row.status,
      isLeave: row.is_leave,
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    // Fetch leaves active on this date (or during this month)
    let leavesQuery = ctx.supabase
      .from("employee_leaves")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      leavesQuery = leavesQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: leavesData } = await leavesQuery;
    const allLeaves = (leavesData || []).map((l: any) => ({
      id: l.id,
      employeeId: l.employee_id,
      employeeName: l.employee_name,
      fromDate: l.from_date,
      toDate: l.to_date,
      daysCount: l.days_count,
      reason: l.reason,
      status: l.status,
    }));

    const leavesOnDate = allLeaves.filter((l: any) => {
      if (date) {
        return l.fromDate <= date && l.toDate >= date;
      }
      return false;
    });

    return NextResponse.json({
      success: true,
      date,
      attendance,
      leavesOnDate,
      allLeaves: month ? allLeaves : undefined,
    });
  } catch (err: any) {
    console.error("GET /api/employees/attendance error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch attendance." },
      { status: 500 }
    );
  }
}

// POST /api/employees/attendance
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
    const { date, records } = body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Date and attendance records are required." },
        { status: 400 }
      );
    }

    const itemsToUpsert = records
      .filter((rec: any) => Boolean(rec.employeeId))
      .map((rec: any) => ({
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        date,
        employee_id: rec.employeeId,
        employee_numeric_id: rec.employeeNumericId || "",
        employee_name: rec.employeeName || "",
        status: rec.status,
        is_leave: Boolean(rec.isLeave),
        updated_by: ctx.session.email || "system",
        updated_at: new Date().toISOString(),
      }));

    const { error } = await ctx.supabase
      .from("employee_attendance")
      .upsert(itemsToUpsert, {
        onConflict: "store_id,employee_id,date",
      });

    if (error) {
      console.error("Upsert attendance error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved attendance for ${records.length} employee(s).`,
    });
  } catch (err: any) {
    console.error("POST /api/employees/attendance error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save attendance." },
      { status: 500 }
    );
  }
}
