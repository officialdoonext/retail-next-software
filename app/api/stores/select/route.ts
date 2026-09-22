import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Store ID is required." }, { status: 400 });
    }

    const storeDoc = await getDoc(doc(db, "stores", storeId));
    if (!storeDoc.exists()) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    const store = storeDoc.data();

    // Verify ownership
    if (store.ownerEmail !== session.email) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    // Strict validation: Must be Active
    if (store.status !== "Active") {
      return NextResponse.json(
        {
          success: false,
          error: "Store is currently Inactive. Awaiting manual administrator activation.",
        },
        { status: 403 }
      );
    }

    // Strict validation: Expiration date must be present and in the future
    if (!store.expires) {
      return NextResponse.json(
        {
          success: false,
          error: "Store has no valid activation expiry date. Awaiting administrator activation.",
        },
        { status: 403 }
      );
    }

    let expiryTime: number | null = null;
    if (typeof store.expires === "string" || typeof store.expires === "number") {
      const parsed = new Date(store.expires).getTime();
      if (!isNaN(parsed)) expiryTime = parsed;
    } else if (typeof store.expires === "object" && store.expires !== null) {
      if (typeof store.expires.toDate === "function") {
        expiryTime = store.expires.toDate().getTime();
      } else if ("seconds" in store.expires) {
        expiryTime = store.expires.seconds * 1000;
      }
    }

    if (!expiryTime || expiryTime <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: "Store subscription has expired. Please contact support to renew.",
        },
        { status: 403 }
      );
    }

    // Store is verified, active, and unexpired!
    const response = NextResponse.json({
      success: true,
      store: {
        id: storeDoc.id,
        name: store.name,
        code: store.code,
      },
    });

    response.cookies.set({
      name: ACTIVE_STORE_COOKIE,
      value: storeDoc.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Error selecting store:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while selecting store." },
      { status: 500 }
    );
  }
}
