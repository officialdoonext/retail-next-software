import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const activeStoreId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value || null;
    let activeStore = null;

    if (activeStoreId) {
      const storeSnap = await getDoc(doc(db, "stores", activeStoreId));
      if (storeSnap.exists()) {
        const sData = storeSnap.data();
        activeStore = {
          id: storeSnap.id,
          name: sData.name,
          code: sData.code || "",
          location: sData.location || "",
          status: sData.status || "Active",
          expires: sData.expires || null,
        };
      }
    }

    let userDocData: any = null;
    if (payload.email) {
      try {
        const userSnap = await getDoc(
          doc(db, "users", payload.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_"))
        );
        if (userSnap.exists()) {
          userDocData = userSnap.data();
        }
      } catch (err) {
        console.error("Error fetching user record:", err);
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: payload.email,
        role: payload.role,
        mobile: payload.mobile || null,
        staffName: payload.staffName || null,
        staffId: payload.staffId || null,
        access: payload.access || [],
        status: userDocData?.status || (payload.role === "Admin" ? "Inactive" : "Active"),
        plan: userDocData?.plan || null,
        expiryDate: userDocData?.expiryDate ?? null,
      },
      activeStore,
    });
  } catch (error) {
    console.error("Error in auth/me route:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
