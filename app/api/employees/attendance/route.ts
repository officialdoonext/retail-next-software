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

// GET /api/employees/attendance?date=YYYY-MM-DD
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
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const month = searchParams.get("month"); // e.g. "2026-09"

    const attRef = collection(db, "employee_attendance");
    let attQuery;
    if (month) {
      // Query for an entire month e.g. for payroll
      const startOfMonth = `${month}-01`;
      const endOfMonth = `${month}-31`;
      attQuery = query(
        attRef,
        where("storeId", "==", ctx.storeId),
        where("date", ">=", startOfMonth),
        where("date", "<=", endOfMonth)
      );
    } else {
      attQuery = query(
        attRef,
        where("storeId", "==", ctx.storeId),
        where("date", "==", date)
      );
    }

    const snap = await getDocs(attQuery);
    const attendance = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fetch leaves active on this date (or during this month)
    const leavesRef = collection(db, "employee_leaves");
    const leavesQuery = query(leavesRef, where("storeId", "==", ctx.storeId));
    const leavesSnap = await getDocs(leavesQuery);
    const allLeaves = leavesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

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
      { success: false, error: "Failed to fetch attendance." },
      { status: 500 }
    );
  }
}

// POST /api/employees/attendance
// Body: { date: "YYYY-MM-DD", records: [ { employeeId, employeeNumericId, employeeName, status, isLeave } ] }
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
    const { date, records } = body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Date and attendance records are required." },
        { status: 400 }
      );
    }

    const batch = writeBatch(db);
    const now = Date.now();

    for (const rec of records) {
      if (!rec.employeeId) continue;
      // Deterministic doc ID to avoid duplicates per employee per date
      const docId = `att_${ctx.storeId}_${rec.employeeId}_${date}`;
      const docRef = doc(db, "employee_attendance", docId);

      batch.set(
        docRef,
        {
          storeId: ctx.storeId,
          date,
          employeeId: rec.employeeId,
          employeeNumericId: rec.employeeNumericId || "",
          employeeName: rec.employeeName || "",
          status: rec.status, // "Present" | "Absent" | "Half Day"
          isLeave: Boolean(rec.isLeave),
          updatedAt: now,
          updatedBy: ctx.session.email || ctx.session.staffId || "user",
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully saved attendance for ${records.length} employee(s).`,
    });
  } catch (err: any) {
    console.error("POST /api/employees/attendance error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save attendance." },
      { status: 500 }
    );
  }
}
