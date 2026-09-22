import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { createSessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "").trim();
    const rawMobile = String(body.mobile || "").trim();
    const cleanMobile = rawMobile.replace(/\D/g, "");

    if (!cleanMobile || cleanMobile.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    const staffRef = collection(db, "staff");
    const staffQuery = query(staffRef, where("mobile", "==", cleanMobile));
    const snapshot = await getDocs(staffQuery);

    if (snapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          error: "No staff member found registered with this mobile number across any store.",
        },
        { status: 404 }
      );
    }

    // Filter active staff records
    const activeStaffDocs = snapshot.docs.filter((d) => {
      const data = d.data();
      return !data.status || data.status === "Active";
    });

    if (activeStaffDocs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Your staff account is currently inactive. Please contact your store administrator.",
        },
        { status: 403 }
      );
    }

    // ACTION 1: Check if mobile number exists
    if (action === "check-mobile") {
      const firstActive = activeStaffDocs[0].data();
      return NextResponse.json({
        success: true,
        exists: true,
        staffName: firstActive.name || "Staff Member",
        storeCount: activeStaffDocs.length,
      });
    }

    // ACTION 2: Verify MPIN
    if (action === "verify-mpin") {
      const enteredMpin = String(body.mpin || "").trim();
      if (!enteredMpin) {
        return NextResponse.json(
          { success: false, error: "Please enter your Security MPIN." },
          { status: 400 }
        );
      }

      // Check if any active staff record for this mobile matches the MPIN
      const matchedDoc = activeStaffDocs.find((d) => {
        const data = d.data();
        return String(data.mpin || "").trim() === enteredMpin;
      });

      if (!matchedDoc) {
        return NextResponse.json(
          { success: false, error: "Incorrect Security MPIN. Please try again." },
          { status: 401 }
        );
      }

      const staffData = matchedDoc.data();
      const staffName = staffData.name || "Staff Member";

      // Issue authenticated JWT session token for Staff
      const sessionToken = await createSessionToken({
        email: `${cleanMobile}@staff.retailnext`,
        role: "Staff",
        mobile: cleanMobile,
        staffName: staffName,
        createdAt: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        message: "Staff authentication successful.",
        staffName,
        redirect: "/onboarding",
      });

      // Set auth_session cookie
      response.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      // Clear any prior active_store_id cookie to force store selection on onboarding
      response.cookies.set({
        name: ACTIVE_STORE_COOKIE,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Staff login error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during staff login." },
      { status: 500 }
    );
  }
}
