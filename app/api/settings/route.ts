import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET /api/settings - Retrieve settings for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const storeDoc = await getDoc(doc(db, "stores", ctx.storeId));
    if (!storeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: "Store not found." },
        { status: 404 }
      );
    }

    const data = storeDoc.data();

    // Verify ownership
    if (data.ownerEmail !== ctx.session.email) {
      return NextResponse.json(
        { success: false, error: "Access denied to this store's settings." },
        { status: 403 }
      );
    }

    const settings = {
      id: storeDoc.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.businessEmail || data.ownerEmail || "",
      location: data.location || "",
      address: data.address || data.location || "",
      city: data.city || "",
      state: data.state || "",
      pincode: data.pincode || "",
      businessType: data.businessType || "Retail Store",
      code: data.code || "",
      license: data.license || "",
      logoUrl: data.logoUrl || "",

      // GST Settings
      enableGst: Boolean(data.enableGst),
      gstNumber: data.gstNumber || "",
      isPriceInclusiveGst: Boolean(data.isPriceInclusiveGst),
      cgstPercent: typeof data.cgstPercent === "number" ? data.cgstPercent : 9,
      sgstPercent: typeof data.sgstPercent === "number" ? data.sgstPercent : 9,

      // Round Off Setting
      enableRoundOff: Boolean(data.enableRoundOff),
    };

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch store settings." },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update settings for the active store
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const storeRef = doc(db, "stores", ctx.storeId);
    const storeDoc = await getDoc(storeRef);
    if (!storeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: "Store not found." },
        { status: 404 }
      );
    }

    const existingData = storeDoc.data();
    if (existingData.ownerEmail !== ctx.session.email) {
      return NextResponse.json(
        { success: false, error: "Access denied to update this store." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Business / Store name is required." },
        { status: 400 }
      );
    }

    const enableGst = Boolean(body.enableGst);
    const gstNumber = String(body.gstNumber || "").trim().toUpperCase();

    if (enableGst && !gstNumber) {
      return NextResponse.json(
        { success: false, error: "GST Number is required when GST is enabled." },
        { status: 400 }
      );
    }

    const isPriceInclusiveGst = enableGst ? Boolean(body.isPriceInclusiveGst) : false;
    const cgstPercent = enableGst ? Math.max(0, Number(body.cgstPercent) || 0) : 0;
    const sgstPercent = enableGst ? Math.max(0, Number(body.sgstPercent) || 0) : 0;

    const updatePayload = {
      name,
      phone: String(body.phone || "").trim(),
      businessEmail: existingData.businessEmail || existingData.ownerEmail || "",
      address: String(body.address || "").trim(),
      location: String(body.address || body.location || "").trim(),
      city: String(body.city || "").trim(),
      state: String(body.state || "").trim(),
      pincode: String(body.pincode || "").trim(),
      businessType: String(body.businessType || "Retail Store").trim(),
      license: String(body.license || existingData.license || "").trim(),
      logoUrl: String(body.logoUrl || "").trim(),

      // GST Configuration
      enableGst,
      gstNumber: enableGst ? gstNumber : "",
      isPriceInclusiveGst,
      cgstPercent,
      sgstPercent,

      // Round Off Configuration
      enableRoundOff: Boolean(body.enableRoundOff),

      updatedAt: Date.now(),
    };

    await updateDoc(storeRef, updatePayload);

    return NextResponse.json({
      success: true,
      message: "Store settings updated successfully.",
      settings: {
        id: ctx.storeId,
        ...updatePayload,
      },
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update store settings." },
      { status: 500 }
    );
  }
}
