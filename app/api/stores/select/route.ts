import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifySessionToken,
  createSessionToken,
  AUTH_COOKIE_NAME,
  ACTIVE_STORE_COOKIE,
} from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

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

    let staffDocData: any = null;
    let staffDocId: string | null = null;
    let allowedAccess: string[] = [];

    if (session.role === "Staff") {
      // Staff validation: verify staff is registered and active for this specific store
      const cleanMobile = String(session.mobile || "").replace(/\D/g, "");
      const staffRef = collection(db, "staff");
      const staffQ = query(
        staffRef,
        where("storeId", "==", storeId),
        where("mobile", "==", cleanMobile)
      );
      const staffSnap = await getDocs(staffQ);

      if (staffSnap.empty) {
        return NextResponse.json(
          { success: false, error: "Access denied. You are not registered as staff for this store." },
          { status: 403 }
        );
      }

      const activeRecord = staffSnap.docs.find(
        (d) => !d.data().status || d.data().status === "Active"
      );
      if (!activeRecord) {
        return NextResponse.json(
          { success: false, error: "Your staff account for this store is currently inactive." },
          { status: 403 }
        );
      }

      staffDocData = activeRecord.data();
      staffDocId = activeRecord.id;
      allowedAccess = Array.isArray(staffDocData.access) ? staffDocData.access : [];

      if (allowedAccess.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No permissions have been granted to your staff account for this store. Please contact your store manager.",
          },
          { status: 403 }
        );
      }
    } else {
      // Admin validation: verify store ownership
      if (store.ownerEmail !== session.email) {
        return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
      }
    }

    // Strict validation: Must be Active
    if (store.status !== "Active") {
      return NextResponse.json(
        {
          success: false,
          error: "Store is currently Inactive. Awaiting administrator activation.",
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

    // Determine the smart default landing route
    let defaultRoute = "/dashboard";
    if (session.role === "Staff") {
      defaultRoute = allowedAccess.includes("/dashboard")
        ? "/dashboard"
        : allowedAccess[0] || "/pos";
    }

    // Store is verified, active, and unexpired!
    const response = NextResponse.json({
      success: true,
      store: {
        id: storeDoc.id,
        name: store.name,
        code: store.code,
      },
      defaultRoute,
      role: session.role,
      access: allowedAccess,
    });

    // If staff, issue an updated JWT embedded with storeId, staffId, and access array
    if (session.role === "Staff") {
      const updatedStaffToken = await createSessionToken({
        ...session,
        storeId: storeDoc.id,
        staffId: staffDocId || undefined,
        staffName: staffDocData?.name || session.staffName,
        access: allowedAccess,
        createdAt: Date.now(),
      });

      response.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: updatedStaffToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      // Client-readable cookie for zero-delay instant sidebar rendering
      response.cookies.set({
        name: "staff_role",
        value: "Staff",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      response.cookies.set({
        name: "staff_access",
        value: encodeURIComponent(JSON.stringify(allowedAccess)),
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    } else {
      // Admin selection
      response.cookies.set({
        name: "staff_role",
        value: "Admin",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      response.cookies.set({
        name: "staff_access",
        value: "",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }

    // Set active_store_id cookie
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
