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

// GET /api/employees/advances
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
    const pendingOnly = searchParams.get("pendingOnly") === "true";

    const advRef = collection(db, "employee_advances");
    let q = query(advRef, where("storeId", "==", ctx.storeId));

    if (employeeId) {
      q = query(advRef, where("storeId", "==", ctx.storeId), where("employeeId", "==", employeeId));
    }

    const snap = await getDocs(q);
    let advances = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (pendingOnly) {
      advances = advances.filter(
        (a: any) => a.remainingAmount > 0 && a.status !== "Repaid"
      );
    }

    // Sort by createdAt descending
    advances.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, advances });
  } catch (err: any) {
    console.error("GET /api/employees/advances error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch advances." },
      { status: 500 }
    );
  }
}

// POST /api/employees/advances
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
      storeId: ctx.storeId,
      employeeId,
      employeeNumericId: employeeNumericId || "",
      employeeName,
      amount: numAmount,
      remainingAmount: numAmount,
      date: advDate,
      notes: String(notes || "").trim(),
      status: "Pending", // "Pending" | "Partially Repaid" | "Repaid"
      createdAt: Date.now(),
      createdBy: ctx.session.email || ctx.session.staffId || "user",
    };

    const docRef = await addDoc(collection(db, "employee_advances"), advanceData);

    return NextResponse.json({
      success: true,
      advance: { id: docRef.id, ...advanceData },
      message: `Advance of ₹${numAmount.toLocaleString()} added for ${employeeName}.`,
    });
  } catch (err: any) {
    console.error("POST /api/employees/advances error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record advance." },
      { status: 500 }
    );
  }
}
