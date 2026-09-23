import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
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

// GET /api/employees/leaves
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
    const employeeId = searchParams.get("employeeId");
    const date = searchParams.get("date"); // YYYY-MM-DD to check if on leave

    const leavesRef = collection(db, "employee_leaves");
    let q = query(leavesRef, where("storeId", "==", ctx.storeId));

    if (employeeId) {
      q = query(leavesRef, where("storeId", "==", ctx.storeId), where("employeeId", "==", employeeId));
    }

    const snap = await getDocs(q);
    let leaves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // If a specific date is queried, filter records where date falls between fromDate and toDate
    if (date) {
      leaves = leaves.filter((l: any) => {
        return l.fromDate <= date && l.toDate >= date;
      });
    }

    // Sort by createdAt descending or fromDate descending
    leaves.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, leaves });
  } catch (err: any) {
    console.error("GET /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch leaves." },
      { status: 500 }
    );
  }
}

// POST /api/employees/leaves
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

    // Calculate days count inclusive
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaveData = {
      storeId: ctx.storeId,
      employeeId,
      employeeNumericId: employeeNumericId || "",
      employeeName,
      fromDate,
      toDate,
      daysCount,
      reason: String(reason || "").trim(),
      status: "Approved",
      createdAt: Date.now(),
      createdBy: ctx.session.email || ctx.session.staffId || "user",
    };

    const docRef = await addDoc(collection(db, "employee_leaves"), leaveData);

    return NextResponse.json({
      success: true,
      leave: { id: docRef.id, ...leaveData },
      message: "Leave added successfully.",
    });
  } catch (err: any) {
    console.error("POST /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add leave." },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/leaves?id=...
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
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

    const leaveRef = doc(db, "employee_leaves", id);
    const snap = await getDoc(leaveRef);
    if (!snap.exists() || snap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Leave record not found." }, { status: 404 });
    }

    await deleteDoc(leaveRef);
    return NextResponse.json({ success: true, message: "Leave record deleted successfully." });
  } catch (err: any) {
    console.error("DELETE /api/employees/leaves error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete leave." },
      { status: 500 }
    );
  }
}
