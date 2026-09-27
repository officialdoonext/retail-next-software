import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }

    // Fetch latest user document from Firestore
    const userDocRef = doc(db, "users", session.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_"));
    const userSnap = await getDoc(userDocRef);

    let status = "Inactive";
    let plan = null;
    let expiryDate: any = null;

    if (userSnap.exists()) {
      const data = userSnap.data();
      status = data.status || "Inactive";
      plan = data.plan ?? null;
      expiryDate = data.expiryDate ?? null;
    }

    // Verify if active and unexpired
    const isStatusActive = status.toLowerCase() === "active";
    let expiryTime: number | null = null;
    if (expiryDate) {
      const t = new Date(expiryDate).getTime();
      if (!isNaN(t)) expiryTime = t;
    }
    const isAllowed = session.role === "Staff" ? true : isStatusActive && expiryTime !== null && expiryTime > Date.now();

    // Re-issue signed JWT token with updated live status & expiry
    const updatedToken = await createSessionToken({
      ...session,
      status,
      plan,
      expiryDate,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      status,
      plan,
      expiryDate,
      isAllowed,
      redirect: isAllowed ? "/dashboard" : "/onboarding",
    });

    // Set updated secure session cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: updatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Error refreshing session token:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error refreshing session." },
      { status: 500 }
    );
  }
}
