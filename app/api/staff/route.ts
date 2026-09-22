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
  updateDoc,
  deleteDoc,
  doc,
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

// GET – fetch all staff for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const staffRef = collection(db, "staff");
    const q = query(staffRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const staff = snap.docs
      .map((d) => {
        const data = d.data();
        // Never expose the raw MPIN in list view
        return {
          id: d.id,
          name: data.name,
          mobile: data.mobile,
          role: data.role || "Staff",
          status: data.status || "Active",
          createdAt: data.createdAt,
          storeId: data.storeId,
        };
      })
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error("GET /api/staff error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch staff." },
      { status: 500 }
    );
  }
}

// POST – add a new staff member
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const body = await request.json();
    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "")
      .trim()
      .replace(/\D/g, "");
    const mpin = String(body.mpin || "").trim();
    const role = String(body.role || "Staff").trim();

    if (!name)
      return NextResponse.json(
        { success: false, error: "Staff name is required." },
        { status: 400 }
      );
    if (!mobile || mobile.length < 10)
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    if (!mpin || mpin.length < 4)
      return NextResponse.json(
        { success: false, error: "MPIN must be at least 4 digits." },
        { status: 400 }
      );
    if (!/^\d+$/.test(mpin))
      return NextResponse.json(
        { success: false, error: "MPIN must contain digits only." },
        { status: 400 }
      );

    // Check duplicate mobile in store
    const staffRef = collection(db, "staff");
    const dupQ = query(
      staffRef,
      where("storeId", "==", ctx.storeId),
      where("mobile", "==", mobile)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty)
      return NextResponse.json(
        { success: false, error: `A staff member with mobile ${mobile} already exists.` },
        { status: 409 }
      );

    const payload = {
      storeId: ctx.storeId,
      name,
      mobile,
      mpin, // stored as plain text (MPIN is a simple numeric PIN, not a password)
      role,
      status: "Active",
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(staffRef, payload);
    return NextResponse.json({
      success: true,
      staff: { id: docRef.id, ...payload },
    });
  } catch (err) {
    console.error("POST /api/staff error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add staff member." },
      { status: 500 }
    );
  }
}

// PUT – update an existing staff member
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id)
      return NextResponse.json(
        { success: false, error: "Staff ID is required." },
        { status: 400 }
      );

    const staffDocRef = doc(db, "staff", id);
    const staffSnap = await getDoc(staffDocRef);
    if (!staffSnap.exists() || staffSnap.data().storeId !== ctx.storeId)
      return NextResponse.json(
        { success: false, error: "Staff member not found." },
        { status: 404 }
      );

    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "")
      .trim()
      .replace(/\D/g, "");
    const mpin = String(body.mpin || "").trim();
    const role = String(body.role || "Staff").trim();

    if (!name)
      return NextResponse.json(
        { success: false, error: "Staff name is required." },
        { status: 400 }
      );
    if (!mobile || mobile.length < 10)
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    if (!mpin || mpin.length < 4)
      return NextResponse.json(
        { success: false, error: "MPIN must be at least 4 digits." },
        { status: 400 }
      );
    if (!/^\d+$/.test(mpin))
      return NextResponse.json(
        { success: false, error: "MPIN must contain digits only." },
        { status: 400 }
      );

    // Check duplicate mobile in same store (excluding self)
    const staffRef = collection(db, "staff");
    const dupQ = query(
      staffRef,
      where("storeId", "==", ctx.storeId),
      where("mobile", "==", mobile)
    );
    const dupSnap = await getDocs(dupQ);
    const hasDup = dupSnap.docs.some((d) => d.id !== id);
    if (hasDup)
      return NextResponse.json(
        { success: false, error: `Another staff member already has mobile ${mobile}.` },
        { status: 409 }
      );

    const updatePayload = { name, mobile, mpin, role, updatedAt: Date.now() };
    await updateDoc(staffDocRef, updatePayload);

    return NextResponse.json({
      success: true,
      staff: { id, ...staffSnap.data(), ...updatePayload },
    });
  } catch (err) {
    console.error("PUT /api/staff error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update staff member." },
      { status: 500 }
    );
  }
}

// DELETE – remove a staff member
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { success: false, error: "Staff ID is required." },
        { status: 400 }
      );

    const staffDocRef = doc(db, "staff", id);
    const staffSnap = await getDoc(staffDocRef);
    if (!staffSnap.exists() || staffSnap.data().storeId !== ctx.storeId)
      return NextResponse.json(
        { success: false, error: "Staff member not found." },
        { status: 404 }
      );

    await deleteDoc(staffDocRef);
    return NextResponse.json({ success: true, message: "Staff member deleted." });
  } catch (err) {
    console.error("DELETE /api/staff error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete staff member." },
      { status: 500 }
    );
  }
}

// GET single staff by ID – for view details (append ?id=xxx)
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
