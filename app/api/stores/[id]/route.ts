import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// GET: Fetch single store by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const storeRef = doc(db, "stores", id);
    const storeSnap = await getDoc(storeRef);

    if (!storeSnap.exists()) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    const storeData = storeSnap.data();
    if (session.role !== "Staff" && storeData.ownerEmail !== session.email) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      store: { id: storeSnap.id, ...storeData },
    });
  } catch (error) {
    console.error("Error fetching store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve store." },
      { status: 500 }
    );
  }
}

// PUT: Update store details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "Staff") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only administrators can edit stores." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const storeRef = doc(db, "stores", id);
    const storeSnap = await getDoc(storeRef);

    if (!storeSnap.exists()) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    const existingStore = storeSnap.data();
    if (existingStore.ownerEmail !== session.email) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name || existingStore.name || "").trim();
    const mobileNumber = String(body.mobileNumber || body.phone || existingStore.mobileNumber || existingStore.phone || "").trim();
    const city = String(body.city ?? existingStore.city ?? "").trim();
    const fullAddress = String(body.fullAddress ?? body.address ?? existingStore.fullAddress ?? existingStore.location ?? "").trim();
    const gstNumber = String(body.gstNumber ?? body.license ?? existingStore.gstNumber ?? existingStore.license ?? "").trim().toUpperCase();
    const status = body.status ? (body.status === "Active" ? "Active" : "Inactive") : (existingStore.status || "Inactive");

    if (!name) {
      return NextResponse.json({ success: false, error: "Store name is required." }, { status: 400 });
    }

    const displayLocation = city ? (fullAddress ? `${city}, ${fullAddress}` : city) : fullAddress || "Main Branch";

    const updatedFields = {
      name,
      mobileNumber,
      phone: mobileNumber,
      city,
      fullAddress,
      location: displayLocation,
      gstNumber,
      license: gstNumber || existingStore.license || `RET-TS-${Math.floor(1000 + Math.random() * 9000)}`,
      status,
      updatedAt: Date.now(),
    };

    await updateDoc(storeRef, updatedFields);

    return NextResponse.json({
      success: true,
      store: {
        id,
        ...existingStore,
        ...updatedFields,
      },
    });
  } catch (error) {
    console.error("Error updating store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update store." },
      { status: 500 }
    );
  }
}

// DELETE: Delete store
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "Staff") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only administrators can delete stores." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const storeRef = doc(db, "stores", id);
    const storeSnap = await getDoc(storeRef);

    if (!storeSnap.exists()) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    const storeData = storeSnap.data();
    if (storeData.ownerEmail !== session.email) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    await deleteDoc(storeRef);

    return NextResponse.json({
      success: true,
      message: "Store deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete store." },
      { status: 500 }
    );
  }
}
