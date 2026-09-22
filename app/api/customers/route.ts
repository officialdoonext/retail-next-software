import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET: Fetch customers for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const customersRef = collection(db, "customers");
    const q = query(customersRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const customers = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customers." },
      { status: 500 }
    );
  }
}

// POST: Add new customer
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || body.mobileNumber || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const address = String(body.address || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: "City is required." },
        { status: 400 }
      );
    }

    // Check for duplicate mobile number in this store
    const customersRef = collection(db, "customers");
    const dupQuery = query(
      customersRef,
      where("storeId", "==", ctx.storeId),
      where("phone", "==", phone)
    );
    const dupSnap = await getDocs(dupQuery);

    if (!dupSnap.empty) {
      return NextResponse.json(
        { success: false, error: `Customer with mobile number ${phone} is already registered.` },
        { status: 409 }
      );
    }

    const customerData = {
      storeId: ctx.storeId,
      name,
      phone,
      city,
      email,
      address,
      totalOrders: 0,
      totalSpend: 0,
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(customersRef, customerData);

    return NextResponse.json({
      success: true,
      customer: {
        id: docRef.id,
        ...customerData,
      },
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save customer." },
      { status: 500 }
    );
  }
}

// PUT: Update customer details
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required." },
        { status: 400 }
      );
    }

    const customerRef = doc(db, "customers", id);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists() || customerSnap.data().storeId !== ctx.storeId) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || body.mobileNumber || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const address = String(body.address || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: "City is required." },
        { status: 400 }
      );
    }

    // Check if phone number is taken by another customer in this store
    const customersRef = collection(db, "customers");
    const dupQuery = query(
      customersRef,
      where("storeId", "==", ctx.storeId),
      where("phone", "==", phone)
    );
    const dupSnap = await getDocs(dupQuery);
    const hasDuplicate = dupSnap.docs.some((d) => d.id !== id);

    if (hasDuplicate) {
      return NextResponse.json(
        { success: false, error: `Another customer is already registered with mobile number ${phone}.` },
        { status: 409 }
      );
    }

    const updatePayload = {
      name,
      phone,
      city,
      email,
      address,
      updatedAt: Date.now(),
    };

    await updateDoc(customerRef, updatePayload);

    return NextResponse.json({
      success: true,
      customer: {
        id,
        ...customerSnap.data(),
        ...updatePayload,
      },
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update customer." },
      { status: 500 }
    );
  }
}

// DELETE: Remove customer
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required." },
        { status: 400 }
      );
    }

    const customerRef = doc(db, "customers", id);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists() || customerSnap.data().storeId !== ctx.storeId) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    await deleteDoc(customerRef);

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete customer." },
      { status: 500 }
    );
  }
}
