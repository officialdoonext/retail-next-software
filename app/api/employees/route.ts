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

// GET – fetch all employees for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const empRef = collection(db, "employees");
    const q = query(empRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const employees = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, employees });
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees." },
      { status: 500 }
    );
  }
}

// POST – add a new employee
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
    const mobile = String(body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const salaryType = body.salaryType === "daily" ? "daily" : "monthly";
    const salaryAmount = Number(body.salaryAmount) || 0;
    const emergencyContactNumber = String(body.emergencyContactNumber || "").trim().replace(/\D/g, "");
    const emergencyRelation = String(body.emergencyRelation || "").trim();
    const emergencyName = String(body.emergencyName || "").trim();

    if (!name)
      return NextResponse.json({ success: false, error: "Employee name is required." }, { status: 400 });
    if (!mobile || mobile.length < 10)
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    if (!city)
      return NextResponse.json({ success: false, error: "City is required." }, { status: 400 });
    if (!address)
      return NextResponse.json({ success: false, error: "Full address is required." }, { status: 400 });
    if (salaryAmount <= 0)
      return NextResponse.json({ success: false, error: "Please enter a valid salary / wage amount." }, { status: 400 });
    if (!emergencyContactNumber || emergencyContactNumber.length < 10)
      return NextResponse.json({ success: false, error: "Emergency contact number must be 10 digits." }, { status: 400 });
    if (!emergencyRelation)
      return NextResponse.json({ success: false, error: "Emergency contact relation is required." }, { status: 400 });
    if (!emergencyName)
      return NextResponse.json({ success: false, error: "Emergency contact name is required." }, { status: 400 });

    // Duplicate mobile check in same store
    const empRef = collection(db, "employees");
    const dupQ = query(empRef, where("storeId", "==", ctx.storeId), where("mobile", "==", mobile));
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty)
      return NextResponse.json(
        { success: false, error: `An employee with mobile ${mobile} already exists.` },
        { status: 409 }
      );

    const payload = {
      storeId: ctx.storeId,
      name,
      mobile,
      city,
      address,
      email,
      salaryType,
      salaryAmount,
      emergencyContactNumber,
      emergencyRelation,
      emergencyName,
      status: "Active",
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(empRef, payload);
    return NextResponse.json({ success: true, employee: { id: docRef.id, ...payload } });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to add employee." }, { status: 500 });
  }
}

// PUT – update an existing employee
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
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const empDocRef = doc(db, "employees", id);
    const empSnap = await getDoc(empDocRef);
    if (!empSnap.exists() || empSnap.data().storeId !== ctx.storeId)
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });

    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const salaryType = body.salaryType === "daily" ? "daily" : "monthly";
    const salaryAmount = Number(body.salaryAmount) || 0;
    const emergencyContactNumber = String(body.emergencyContactNumber || "").trim().replace(/\D/g, "");
    const emergencyRelation = String(body.emergencyRelation || "").trim();
    const emergencyName = String(body.emergencyName || "").trim();

    if (!name)
      return NextResponse.json({ success: false, error: "Employee name is required." }, { status: 400 });
    if (!mobile || mobile.length < 10)
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    if (!city)
      return NextResponse.json({ success: false, error: "City is required." }, { status: 400 });
    if (!address)
      return NextResponse.json({ success: false, error: "Full address is required." }, { status: 400 });
    if (salaryAmount <= 0)
      return NextResponse.json({ success: false, error: "Please enter a valid salary / wage amount." }, { status: 400 });
    if (!emergencyContactNumber || emergencyContactNumber.length < 10)
      return NextResponse.json({ success: false, error: "Emergency contact number must be 10 digits." }, { status: 400 });
    if (!emergencyRelation)
      return NextResponse.json({ success: false, error: "Emergency contact relation is required." }, { status: 400 });
    if (!emergencyName)
      return NextResponse.json({ success: false, error: "Emergency contact name is required." }, { status: 400 });

    // Duplicate mobile in same store (excluding self)
    const empRef = collection(db, "employees");
    const dupQ = query(empRef, where("storeId", "==", ctx.storeId), where("mobile", "==", mobile));
    const dupSnap = await getDocs(dupQ);
    if (dupSnap.docs.some((d) => d.id !== id))
      return NextResponse.json(
        { success: false, error: `Another employee already has mobile ${mobile}.` },
        { status: 409 }
      );

    const updatePayload = {
      name, mobile, city, address, email,
      salaryType, salaryAmount,
      emergencyContactNumber, emergencyRelation, emergencyName,
      updatedAt: Date.now(),
    };

    await updateDoc(empDocRef, updatePayload);
    return NextResponse.json({ success: true, employee: { id, ...empSnap.data(), ...updatePayload } });
  } catch (err) {
    console.error("PUT /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to update employee." }, { status: 500 });
  }
}

// DELETE – remove an employee
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
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const empDocRef = doc(db, "employees", id);
    const empSnap = await getDoc(empDocRef);
    if (!empSnap.exists() || empSnap.data().storeId !== ctx.storeId)
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });

    await deleteDoc(empDocRef);
    return NextResponse.json({ success: true, message: "Employee deleted." });
  } catch (err) {
    console.error("DELETE /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete employee." }, { status: 500 });
  }
}
