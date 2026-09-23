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

// GET /api/employees/advances/repay
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

    const repRef = collection(db, "employee_repayments");
    let q = query(repRef, where("storeId", "==", ctx.storeId));

    if (employeeId) {
      q = query(repRef, where("storeId", "==", ctx.storeId), where("employeeId", "==", employeeId));
    }

    const snap = await getDocs(q);
    const repayments = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, repayments });
  } catch (err: any) {
    console.error("GET repayments error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch repayments." },
      { status: 500 }
    );
  }
}

// POST /api/employees/advances/repay
// Distributes repayment amount using FIFO (oldest pending advance settled first)
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

    const repayAmount = Number(amount);
    if (!employeeId || !repayAmount || repayAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid Employee and Repayment Amount are required." },
        { status: 400 }
      );
    }

    // Fetch all pending/partially repaid advances for this employee, sorted by createdAt ASC (FIFO)
    const advRef = collection(db, "employee_advances");
    const q = query(
      advRef,
      where("storeId", "==", ctx.storeId),
      where("employeeId", "==", employeeId)
    );
    const snap = await getDocs(q);

    // Filter pending advances with remaining balance and sort by date/createdAt ASC
    const pendingAdvances = snap.docs
      .map((d) => ({ id: d.id, ...d.data() as any }))
      .filter((a) => (a.remainingAmount || 0) > 0 && a.status !== "Repaid")
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (pendingAdvances.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${employeeName || "This employee"} has no pending advances to repay.`,
        },
        { status: 400 }
      );
    }

    const totalOutstanding = pendingAdvances.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);
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
    const batch = writeBatch(db);
    const settlementSummary: { advanceId: string; settled: number; newRemaining: number; status: string }[] = [];

    for (const adv of pendingAdvances) {
      if (remainingToRepay <= 0) break;

      const currentRemaining = adv.remainingAmount || 0;
      const advanceDocRef = doc(db, "employee_advances", adv.id);

      if (remainingToRepay >= currentRemaining) {
        // This advance is completely repaid
        remainingToRepay -= currentRemaining;
        batch.update(advanceDocRef, {
          remainingAmount: 0,
          status: "Repaid",
          updatedAt: Date.now(),
        });
        settlementSummary.push({
          advanceId: adv.id,
          settled: currentRemaining,
          newRemaining: 0,
          status: "Repaid",
        });
      } else {
        // This advance is partially repaid
        const newRemaining = currentRemaining - remainingToRepay;
        batch.update(advanceDocRef, {
          remainingAmount: newRemaining,
          status: "Partially Repaid",
          updatedAt: Date.now(),
        });
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
      storeId: ctx.storeId,
      employeeId,
      employeeNumericId: employeeNumericId || "",
      employeeName: employeeName || "",
      amount: repayAmount,
      date: date || new Date().toISOString().split("T")[0],
      notes: String(notes || "").trim(),
      settlementSummary,
      createdAt: Date.now(),
      createdBy: ctx.session.email || ctx.session.staffId || "user",
    };

    const repDocRef = doc(collection(db, "employee_repayments"));
    batch.set(repDocRef, repData);

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Repayment of ₹${repayAmount.toLocaleString()} successfully settled using FIFO.`,
      repayment: { id: repDocRef.id, ...repData },
      settlementSummary,
    });
  } catch (err: any) {
    console.error("POST /api/employees/advances/repay error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process repayment." },
      { status: 500 }
    );
  }
}
