import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET /api/employees/payroll?month=YYYY-MM
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
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const month = searchParams.get("month") || currentMonthStr;

    // 1. Fetch Employees
    let empQuery = ctx.supabase
      .from("employees")
      .select("*")
      .eq("business_id", ctx.businessId)
      .neq("status", "Terminated")
      .neq("status", "Inactive");

    if (ctx.storeId) {
      empQuery = empQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: empData, error: empErr } = await empQuery;
    if (empErr) throw empErr;
    const employees = empData || [];

    // 2. Fetch Settings
    const { data: bSettings } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId || null)
      .maybeSingle();

    const settings = bSettings?.settings?.attendance_settings || {
      monthDivisor: 30,
      enableAttendanceBonus: false,
      bonusDays: 1,
      sundayIsHoliday: true,
    };

    const monthDivisor = settings.monthDivisor === 31 ? 31 : 30;
    const enableAttendanceBonus = Boolean(settings.enableAttendanceBonus);
    const bonusDays = Number(settings.bonusDays) || 1;
    const sundayIsHoliday = settings.sundayIsHoliday !== undefined ? Boolean(settings.sundayIsHoliday) : true;

    // 3. Fetch Holidays for this month
    const startOfMonth = `${month}-01`;
    const endOfMonth = `${month}-31`;

    let holQuery = ctx.supabase
      .from("store_holidays")
      .select("*")
      .eq("business_id", ctx.businessId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (ctx.storeId) {
      holQuery = holQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: holidaysData } = await holQuery;
    const holidays = holidaysData || [];
    const holidayDates = new Set(holidays.map((h: any) => h.date));

    // 4. Fetch Attendance records for this month
    let attQuery = ctx.supabase
      .from("employee_attendance")
      .select("*")
      .eq("business_id", ctx.businessId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (ctx.storeId) {
      attQuery = attQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: attData } = await attQuery;
    const attendanceRecords = attData || [];

    // 5. Fetch Approved Leaves for this month
    let leavesQuery = ctx.supabase
      .from("employee_leaves")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      leavesQuery = leavesQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: leavesData } = await leavesQuery;
    const leaves = leavesData || [];

    // 6. Fetch Pending Advances per employee
    let advQuery = ctx.supabase
      .from("employee_advances")
      .select("*")
      .eq("business_id", ctx.businessId)
      .gt("remaining_amount", 0)
      .neq("status", "Repaid");

    if (ctx.storeId) {
      advQuery = advQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: advData } = await advQuery;
    const advances = advData || [];

    const pendingAdvMap = new Map<string, number>();
    advances.forEach((a: any) => {
      const current = pendingAdvMap.get(a.employee_id) || 0;
      pendingAdvMap.set(a.employee_id, current + (Number(a.remaining_amount) || 0));
    });

    // 7. Check if a finalized payroll already exists for this month
    let payrollQuery = ctx.supabase
      .from("employee_payroll")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("month", month);

    if (ctx.storeId) {
      payrollQuery = payrollQuery.eq("store_id", ctx.storeId);
    }

    const { data: savedPayrollRow } = await payrollQuery.maybeSingle();
    const savedPayroll = savedPayrollRow ? savedPayrollRow.records : null;

    // Calculate calendar days in month
    const [yearNum, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // Calculate Sundays in this month
    const sundays = new Set<string>();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(yearNum, monthNum - 1, day);
      if (d.getDay() === 0) {
        sundays.add(`${month}-${String(day).padStart(2, "0")}`);
      }
    }

    // Compute payroll details per employee
    const payrollList = employees.map((emp: any) => {
      const savedRec = Array.isArray(savedPayroll)
        ? savedPayroll.find((r: any) => r.employeeId === emp.id)
        : null;

      const empAtt = attendanceRecords.filter((a: any) => a.employee_id === emp.id);
      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;

      empAtt.forEach((a: any) => {
        if (a.status === "Present") presentDays += 1;
        else if (a.status === "Half Day") halfDays += 1;
        else if (a.status === "Absent") absentDays += 1;
      });

      const acceptedLeaves = Number(emp.accepted_leaves) || 0;

      const empLeaves = leaves.filter((l: any) => {
        if (l.employee_id !== emp.id) return false;
        return l.from_date <= endOfMonth && l.to_date >= startOfMonth;
      });
      const approvedLeavesTaken = empLeaves.reduce((acc: number, curr: any) => acc + (curr.days_count || 0), 0);

      const baseSalary = Number(emp.salary_amount) || 0;
      const perDaySalary =
        emp.salary_type === "daily" ? baseSalary : Math.round((baseSalary / monthDivisor) * 100) / 100;

      const payableLeaves = Math.min(acceptedLeaves, approvedLeavesTaken);
      const effectiveWorkingPresent = presentDays + halfDays * 0.5;
      const unexcusedAbsences = Math.max(0, absentDays - payableLeaves);

      const isBonusEligible = enableAttendanceBonus && unexcusedAbsences === 0 && effectiveWorkingPresent > 0;
      const applyBonus = savedRec?.applyBonus !== undefined ? savedRec.applyBonus : isBonusEligible;
      const bonusAmount = applyBonus ? Math.round(bonusDays * perDaySalary) : 0;

      let grossEarnings = 0;
      if (emp.salary_type === "daily") {
        grossEarnings = Math.max(0, Math.round((effectiveWorkingPresent + payableLeaves) * perDaySalary + bonusAmount));
      } else {
        const deductionForAbsence = Math.round(unexcusedAbsences * perDaySalary);
        grossEarnings = Math.max(0, Math.round(baseSalary - deductionForAbsence + bonusAmount));
      }

      const pendingAdvance = pendingAdvMap.get(emp.id) || 0;
      const advanceDeduction =
        savedRec?.advanceDeduction !== undefined
          ? savedRec.advanceDeduction
          : Math.min(pendingAdvance, grossEarnings);

      const netSalary = Math.max(0, grossEarnings - advanceDeduction);

      return {
        employeeId: emp.id,
        employeeNumericId: emp.employee_id || "",
        employeeName: emp.name,
        avatarUrl: emp.avatar_url || "",
        mobile: emp.mobile || "",
        salaryType: emp.salary_type || "monthly",
        baseSalary,
        perDaySalary,
        presentDays,
        halfDays,
        absentDays,
        acceptedLeaves,
        approvedLeavesTaken,
        payableLeaves,
        unexcusedAbsences,
        isBonusEligible,
        applyBonus,
        bonusDays,
        bonusAmount,
        grossEarnings,
        pendingAdvance,
        advanceDeduction,
        netSalary,
        status: savedRec?.status || "Draft",
      };
    });

    return NextResponse.json({
      success: true,
      month,
      daysInMonth,
      monthDivisor,
      enableAttendanceBonus,
      bonusDays,
      sundayIsHoliday,
      holidaysCount: holidays.length,
      records: payrollList,
      savedPayroll: Boolean(savedPayroll),
    });
  } catch (err: any) {
    console.error("GET payroll error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to calculate payroll." },
      { status: 500 }
    );
  }
}

// POST /api/employees/payroll
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
    const { month, records } = body;

    if (!month || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, error: "Month and payroll records are required." },
        { status: 400 }
      );
    }

    // Save payroll doc
    const { error: pErr } = await ctx.supabase
      .from("employee_payroll")
      .upsert(
        {
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          month,
          records,
          updated_by: ctx.session.email || "system",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,month" }
      );

    if (pErr) throw pErr;

    // Process advance deductions via FIFO
    for (const rec of records) {
      const deduction = Number(rec.advanceDeduction) || 0;
      if (deduction > 0) {
        const { data: advances } = await ctx.supabase
          .from("employee_advances")
          .select("*")
          .eq("business_id", ctx.businessId)
          .eq("employee_id", rec.employeeId)
          .gt("remaining_amount", 0)
          .neq("status", "Repaid")
          .order("created_at", { ascending: true });

        let left = deduction;
        for (const adv of (advances || [])) {
          if (left <= 0) break;
          const curr = Number(adv.remaining_amount) || 0;
          if (left >= curr) {
            left -= curr;
            await ctx.supabase
              .from("employee_advances")
              .update({ remaining_amount: 0, status: "Repaid", updated_at: new Date().toISOString() })
              .eq("id", adv.id);
          } else {
            const newRem = curr - left;
            left = 0;
            await ctx.supabase
              .from("employee_advances")
              .update({ remaining_amount: newRem, status: "Partially Repaid", updated_at: new Date().toISOString() })
              .eq("id", adv.id);
          }
        }

        // Record a repayment entry
        await ctx.supabase
          .from("employee_repayments")
          .insert({
            business_id: ctx.businessId,
            store_id: ctx.storeId || null,
            employee_id: rec.employeeId,
            employee_numeric_id: rec.employeeNumericId || "",
            employee_name: rec.employeeName || "",
            amount: deduction,
            date: new Date().toISOString().split("T")[0],
            notes: `Payroll Advance Deduction for ${month}`,
            created_by: ctx.session.email || "system",
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payroll for ${month} saved successfully!`,
    });
  } catch (err: any) {
    console.error("POST payroll error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save payroll." },
      { status: 500 }
    );
  }
}
