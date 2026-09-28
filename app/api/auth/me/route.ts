import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, createSessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
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

    const liveModules = Array.isArray(userDocData?.enabledModules) ? userDocData.enabledModules : null;

    // Refresh JWT session token with live status, expiry and enabled modules
    const updatedToken = await createSessionToken({
      ...payload,
      status: userDocData?.status || payload.status,
      plan: userDocData?.plan ?? payload.plan,
      expiryDate: userDocData?.expiryDate ?? payload.expiryDate,
      enabledModules: liveModules || undefined,
    });

    const response = NextResponse.json({
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
        enabledModules: liveModules,
      },
      activeStore,
    });

    // Keep auth_session JWT synchronized
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: updatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    // Set client_modules cookie for instantaneous zero-flash client & middleware access
    if (liveModules) {
      response.cookies.set({
        name: "client_modules",
        value: encodeURIComponent(JSON.stringify(liveModules)),
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    } else {
      response.cookies.delete("client_modules");
    }

    return response;
  } catch (error) {
    console.error("Error in auth/me route:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
