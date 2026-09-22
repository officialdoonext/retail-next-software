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

    return NextResponse.json({
      authenticated: true,
      user: {
        email: payload.email,
        role: payload.role,
      },
      activeStore,
    });
  } catch (error) {
    console.error("Error in auth/me route:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
