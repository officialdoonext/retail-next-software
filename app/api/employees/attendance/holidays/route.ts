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

// GET /api/employees/attendance/holidays
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const holRef = collection(db, "store_holidays");
    const q = query(holRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const holidays = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));

    return NextResponse.json({ success: true, holidays });
  } catch (err: any) {
    console.error("GET holidays error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch holidays." },
      { status: 500 }
    );
  }
}

// POST /api/employees/attendance/holidays
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
    const name = String(body.name || "").trim();
    const date = String(body.date || "").trim();

    if (!name || !date) {
      return NextResponse.json(
        { success: false, error: "Holiday Name and Date are required." },
        { status: 400 }
      );
    }

    const holData = {
      storeId: ctx.storeId,
      name,
      date,
      createdAt: Date.now(),
      createdBy: ctx.session.email || ctx.session.staffId || "user",
    };

    const docRef = await addDoc(collection(db, "store_holidays"), holData);

    return NextResponse.json({
      success: true,
      holiday: { id: docRef.id, ...holData },
      message: "Holiday added successfully.",
    });
  } catch (err: any) {
    console.error("POST holidays error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add holiday." },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/attendance/holidays?id=...
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
      return NextResponse.json({ success: false, error: "Holiday ID required." }, { status: 400 });
    }

    const holRef = doc(db, "store_holidays", id);
    const snap = await getDoc(holRef);
    if (!snap.exists() || snap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Holiday not found." }, { status: 404 });
    }

    await deleteDoc(holRef);
    return NextResponse.json({ success: true, message: "Holiday deleted successfully." });
  } catch (err: any) {
    console.error("DELETE holidays error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete holiday." },
      { status: 500 }
    );
  }
}
