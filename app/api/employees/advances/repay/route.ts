import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/advances/repay
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

    let query = ctx.supabase
      .from("employee_repayments")
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

    const repayments = (data || []).map((row: any) => ({
      id: row.id,
      storeId: row.store_id,
      employeeId: row.employee_id,
      employeeNumericId: row.employee_numeric_id,
      employeeName: row.employee_name,
      amount: Number(row.amount) || 0,
      date: row.date,
      notes: row.notes,
      settlementSummary: row.settlement_summary,
      createdAt: new Date(row.created_at).getTime(),
    }));

    return NextResponse.json({ success: true, repayments });
  } catch (err: any) {
    console.error("GET repayments error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch repayments." },
      { status: 500 }
    );
  }
}

// POST /api/employees/advances/repay
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

    const repayAmount = Number(amount);
    if (!employeeId || !repayAmount || repayAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid Employee and Repayment Amount are required." },
        { status: 400 }
      );
    }

    // Fetch all pending/partially repaid advances for this employee, sorted by created_at ASC (FIFO)
    const { data: advances, error: advErr } = await ctx.supabase
      .from("employee_advances")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("employee_id", employeeId)
      .gt("remaining_amount", 0)
      .neq("status", "Repaid")
      .order("created_at", { ascending: true });

    if (advErr) throw advErr;

    const pendingAdvances = advances || [];
    if (pendingAdvances.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${employeeName || "This employee"} has no pending advances to repay.`,
        },
        { status: 400 }
      );
    }

    const totalOutstanding = pendingAdvances.reduce((sum: number, a: any) => sum + (Number(a.remaining_amount) || 0), 0);
    if (repayAmount > totalOutstanding) {
      return NextResponse.json(
        {
          success: false,
          error: `Repayment amount (₹${repayAmount.toLocaleString()}) cannot exceed total pending advances (₹${totalOutstanding.toLocaleString()}).`,
        },
        { status: 400 }
      );
    }

    // Apply FIFO distribution
    let remainingToRepay = repayAmount;
    const settlementSummary: { advanceId: string; settled: number; newRemaining: number; status: string }[] = [];

    for (const adv of pendingAdvances) {
      if (remainingToRepay <= 0) break;

      const currentRemaining = Number(adv.remaining_amount) || 0;

      if (remainingToRepay >= currentRemaining) {
        remainingToRepay -= currentRemaining;
        await ctx.supabase
          .from("employee_advances")
          .update({
            remaining_amount: 0,
            status: "Repaid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", adv.id);

        settlementSummary.push({
          advanceId: adv.id,
          settled: currentRemaining,
          newRemaining: 0,
          status: "Repaid",
        });
      } else {
        const newRemaining = currentRemaining - remainingToRepay;
        await ctx.supabase
          .from("employee_advances")
          .update({
            remaining_amount: newRemaining,
            status: "Partially Repaid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", adv.id);

        settlementSummary.push({
          advanceId: adv.id,
          settled: remainingToRepay,
          newRemaining,
          status: "Partially Repaid",
        });
        remainingToRepay = 0;
      }
    }

    // Record repayment entry
    const repData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      employee_id: employeeId,
      employee_numeric_id: employeeNumericId || "",
      employee_name: employeeName || "",
      amount: repayAmount,
      date: date || new Date().toISOString().split("T")[0],
      notes: String(notes || "").trim(),
      settlement_summary: settlementSummary,
      created_by: ctx.session.email || "system",
    };

    const { data: newRep, error: repErr } = await ctx.supabase
      .from("employee_repayments")
      .insert(repData)
      .select()
      .single();

    if (repErr) throw repErr;

    return NextResponse.json({
      success: true,
      message: `Repayment of ₹${repayAmount.toLocaleString()} successfully settled using FIFO.`,
      repayment: { id: newRep.id, ...repData },
      settlementSummary,
    });
  } catch (err: any) {
    console.error("POST /api/employees/advances/repay error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process repayment." },
      { status: 500 }
    );
  }
}
