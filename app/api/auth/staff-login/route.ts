import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createSessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE, ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";

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

    const supabase = getSupabaseAdmin();

    const { data: staffRecords, error } = await supabase
      .from("staff")
      .select("*")
      .eq("mobile", cleanMobile)
      .eq("status", "Active");

    if (error || !staffRecords || staffRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No active staff member found registered with this mobile number.",
        },
        { status: 404 }
      );
    }

    // ACTION 1: Check mobile
    if (action === "check-mobile") {
      const firstActive = staffRecords[0];
      return NextResponse.json({
        success: true,
        exists: true,
        staffName: firstActive.name || "Staff Member",
        storeCount: staffRecords.length,
      });
    }

    // ACTION 2: Verify MPIN
    if (action === "verify-mpin") {
      const enteredMpin = String(body.mpin || "").trim();
      if (!enteredMpin) {
        return NextResponse.json({ success: false, error: "Please enter your Security MPIN." }, { status: 400 });
      }

      const matchedStaff = staffRecords.find(
        (s: any) => String(s.mpin || "").trim() === enteredMpin
      );

      if (!matchedStaff) {
        return NextResponse.json(
          { success: false, error: "Incorrect Security MPIN. Please try again." },
          { status: 401 }
        );
      }

      const staffName = matchedStaff.name || "Staff Member";

      // Issue authenticated JWT session token for Staff
      const sessionToken = await createSessionToken({
        email: `${cleanMobile}@staff.retailnext`,
        role: "Staff",
        mobile: cleanMobile,
        staffName: staffName,
        staffId: matchedStaff.id,
        businessId: matchedStaff.business_id,
        storeId: matchedStaff.store_id || undefined,
        access: Array.isArray(matchedStaff.access) ? matchedStaff.access : [],
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

      if (matchedStaff.business_id) {
        response.cookies.set({
          name: ACTIVE_BUSINESS_COOKIE,
          value: matchedStaff.business_id,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });
      }

      // Clear active_store_id to allow branch selection
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
