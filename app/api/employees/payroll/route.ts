import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  if (!token || !storeId) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { session, storeId };
}

// GET /api/employees/payroll?month=YYYY-MM
export async function GET(request: Request) {
  try {
    const ctx = await getStoreContext();
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
    const empRef = collection(db, "employees");
    const empSnap = await getDocs(query(empRef, where("storeId", "==", ctx.storeId)));
    const employees = empSnap.docs
      .map((d) => ({ id: d.id, ...d.data() as any }))
      .filter((e) => e.status !== "Terminated" && e.status !== "Inactive");

    // 2. Fetch Settings
    const setDocRef = doc(db, "store_attendance_settings", ctx.storeId);
    const setSnap = await getDoc(setDocRef);
    const settings = setSnap.exists()
      ? setSnap.data()
      : { monthDivisor: 30, enableAttendanceBonus: false, bonusDays: 1, sundayIsHoliday: true };

    const monthDivisor = settings.monthDivisor === 31 ? 31 : 30;
    const enableAttendanceBonus = Boolean(settings.enableAttendanceBonus);
    const bonusDays = Number(settings.bonusDays) || 1;
    const sundayIsHoliday = settings.sundayIsHoliday !== undefined ? Boolean(settings.sundayIsHoliday) : true;

    // 3. Fetch Holidays for this month
    const startOfMonth = `${month}-01`;
    const endOfMonth = `${month}-31`;
    const holRef = collection(db, "store_holidays");
    const holSnap = await getDocs(query(holRef, where("storeId", "==", ctx.storeId)));
    const holidays = holSnap.docs
      .map((d) => d.data())
      .filter((h: any) => h.date >= startOfMonth && h.date <= endOfMonth);
    const holidayDates = new Set(holidays.map((h: any) => h.date));

    // 4. Fetch Attendance records for this month
    const attRef = collection(db, "employee_attendance");
    const attSnap = await getDocs(
      query(
        attRef,
        where("storeId", "==", ctx.storeId),
        where("date", ">=", startOfMonth),
        where("date", "<=", endOfMonth)
      )
    );
    const attendanceRecords = attSnap.docs.map((d) => d.data());

    // 5. Fetch Approved Leaves for this month
    const leavesRef = collection(db, "employee_leaves");
    const leavesSnap = await getDocs(query(leavesRef, where("storeId", "==", ctx.storeId)));
    const leaves = leavesSnap.docs.map((d) => d.data());

    // 6. Fetch Pending Advances per employee
    const advRef = collection(db, "employee_advances");
    const advSnap = await getDocs(query(advRef, where("storeId", "==", ctx.storeId)));
    const advances = advSnap.docs
      .map((d) => ({ id: d.id, ...d.data() as any }))
      .filter((a) => (a.remainingAmount || 0) > 0 && a.status !== "Repaid");

    const pendingAdvMap = new Map<string, number>();
    advances.forEach((a) => {
      const current = pendingAdvMap.get(a.employeeId) || 0;
      pendingAdvMap.set(a.employeeId, current + (Number(a.remainingAmount) || 0));
    });

    // 7. Check if a finalized payroll already exists for this month
    const payrollDocRef = doc(db, "employee_payroll", `${ctx.storeId}_${month}`);
    const payrollSnap = await getDoc(payrollDocRef);
    const savedPayroll = payrollSnap.exists() ? payrollSnap.data() : null;

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
    const payrollList = employees.map((emp) => {
      // If already saved in finalized payroll, merge with saved customizations
      const savedRec = savedPayroll?.records?.find((r: any) => r.employeeId === emp.id);

      const empAtt = attendanceRecords.filter((a: any) => a.employeeId === emp.id);
      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;

      empAtt.forEach((a: any) => {
        if (a.status === "Present") presentDays += 1;
        else if (a.status === "Half Day") halfDays += 1;
        else if (a.status === "Absent") absentDays += 1;
      });

      // Employee's accepted leaves allowance
      const acceptedLeaves = Number(emp.acceptedLeaves) || 0;

      // Count approved leaves taken this month
      const empLeaves = leaves.filter((l: any) => {
        if (l.employeeId !== emp.id) return false;
        return l.fromDate <= endOfMonth && l.toDate >= startOfMonth;
      });
      const approvedLeavesTaken = empLeaves.reduce((acc, curr) => acc + (curr.daysCount || 0), 0);

      // Base salary & per-day salary
      const baseSalary = Number(emp.salaryAmount) || 0;
      const perDaySalary =
        emp.salaryType === "daily" ? baseSalary : Math.round((baseSalary / monthDivisor) * 100) / 100;

      // Paid holidays & Sundays
      let paidHolidaysCount = holidays.length;
      if (sundayIsHoliday) {
        paidHolidaysCount += Array.from(sundays).filter((s) => !holidayDates.has(s)).length;
      }

      // Total payable days
      // Present days + (Half days * 0.5) + Accepted leaves applied (up to approved leaves taken)
      const payableLeaves = Math.min(acceptedLeaves, approvedLeavesTaken);
      const effectiveWorkingPresent = presentDays + halfDays * 0.5;

      // Unexcused absences = absent days - payable leaves
      const unexcusedAbsences = Math.max(0, absentDays - payableLeaves);

      // Full Attendance Bonus Eligibility:
      // Eligible if: bonus is enabled AND unexcusedAbsences == 0 (all absences are covered by accepted leaves)
      const isBonusEligible = enableAttendanceBonus && unexcusedAbsences === 0 && effectiveWorkingPresent > 0;
      const applyBonus = savedRec?.applyBonus !== undefined ? savedRec.applyBonus : isBonusEligible;
      const bonusAmount = applyBonus ? Math.round(bonusDays * perDaySalary) : 0;

      // Total gross payable
      // For monthly: baseSalary - (unexcusedAbsences * perDaySalary) + bonusAmount
      // For daily: (effectiveWorkingPresent + payableLeaves) * perDaySalary + bonusAmount
      let grossEarnings = 0;
      if (emp.salaryType === "daily") {
        grossEarnings = Math.max(0, Math.round((effectiveWorkingPresent + payableLeaves) * perDaySalary + bonusAmount));
      } else {
        const deductionForAbsence = Math.round(unexcusedAbsences * perDaySalary);
        grossEarnings = Math.max(0, Math.round(baseSalary - deductionForAbsence + bonusAmount));
      }

      // Pending Advance
      const pendingAdvance = pendingAdvMap.get(emp.id) || 0;
      const advanceDeduction =
        savedRec?.advanceDeduction !== undefined
          ? savedRec.advanceDeduction
          : Math.min(pendingAdvance, grossEarnings);

      const netSalary = Math.max(0, grossEarnings - advanceDeduction);

      return {
        employeeId: emp.id,
        employeeNumericId: emp.employeeId || "",
        employeeName: emp.name,
        avatarUrl: emp.avatarUrl || "",
        mobile: emp.mobile || "",
        salaryType: emp.salaryType || "monthly",
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
      { success: false, error: "Failed to calculate payroll." },
      { status: 500 }
    );
  }
}

// POST /api/employees/payroll
// Saves finalized payroll records and processes advance deductions via FIFO
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
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

    const batch = writeBatch(db);

    // Save payroll doc
    const payrollDocRef = doc(db, "employee_payroll", `${ctx.storeId}_${month}`);
    batch.set(
      payrollDocRef,
      {
        storeId: ctx.storeId,
        month,
        records,
        updatedAt: Date.now(),
        updatedBy: ctx.session.email || ctx.session.staffId || "user",
      },
      { merge: true }
    );

    // If advance deductions were made, automatically settle advances via FIFO
    const advRef = collection(db, "employee_advances");
    const advSnap = await getDocs(query(advRef, where("storeId", "==", ctx.storeId)));
    const allAdvances = advSnap.docs.map((d) => ({ id: d.id, ...d.data() as any }));

    for (const rec of records) {
      const deduction = Number(rec.advanceDeduction) || 0;
      if (deduction > 0) {
        // Find pending advances for this employee sorted by createdAt asc (FIFO)
        const empPending = allAdvances
          .filter((a) => a.employeeId === rec.employeeId && a.remainingAmount > 0 && a.status !== "Repaid")
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        let left = deduction;
        for (const adv of empPending) {
          if (left <= 0) break;
          const curr = adv.remainingAmount || 0;
          const targetDoc = doc(db, "employee_advances", adv.id);
          if (left >= curr) {
            left -= curr;
            adv.remainingAmount = 0;
            batch.update(targetDoc, { remainingAmount: 0, status: "Repaid", updatedAt: Date.now() });
          } else {
            const newRem = curr - left;
            adv.remainingAmount = newRem;
            left = 0;
            batch.update(targetDoc, { remainingAmount: newRem, status: "Partially Repaid", updatedAt: Date.now() });
          }
        }

        // Record a repayment entry
        const repDocRef = doc(collection(db, "employee_repayments"));
        batch.set(repDocRef, {
          storeId: ctx.storeId,
          employeeId: rec.employeeId,
          employeeNumericId: rec.employeeNumericId || "",
          employeeName: rec.employeeName || "",
          amount: deduction,
          date: new Date().toISOString().split("T")[0],
          notes: `Payroll Advance Deduction for ${month}`,
          createdAt: Date.now(),
          createdBy: ctx.session.email || ctx.session.staffId || "user",
        });
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Payroll for ${month} saved successfully!`,
    });
  } catch (err: any) {
    console.error("POST payroll error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save payroll." },
      { status: 500 }
    );
  }
}
