import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifySessionToken,
  createSessionToken,
  isBusinessAllowed,
  AUTH_COOKIE_NAME,
  ACTIVE_STORE_COOKIE,
  ACTIVE_BUSINESS_COOKIE,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Store ID is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch store from Supabase
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    // 2. Fetch business
    const { data: business, error: busErr } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", store.business_id)
      .single();

    if (busErr || !business) {
      return NextResponse.json({ success: false, error: "Business record not found." }, { status: 404 });
    }

    let allowedAccess: string[] = [];

    if (session.role === "Staff") {
      const cleanMobile = String(session.mobile || "").replace(/\D/g, "");
      const { data: staffList } = await supabase
        .from("staff")
        .select("*")
        .eq("store_id", storeId)
        .eq("mobile", cleanMobile)
        .eq("status", "Active");

      if (!staffList || staffList.length === 0) {
        return NextResponse.json(
          { success: false, error: "Access denied. You are not active staff for this store." },
          { status: 403 }
        );
      }

      const staff = staffList[0];
      allowedAccess = Array.isArray(staff.access) ? staff.access : [];
    } else {
      // Admin: verify business ownership
      if (business.email?.toLowerCase() !== session.email.toLowerCase() && business.owner_id !== session.userId) {
        return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
      }

      // Check business status and expiry
      if (!isBusinessAllowed(business.status, business.expiry_date)) {
        return NextResponse.json(
          {
            success: false,
            error: "Your business subscription is inactive or expired. Please contact support.",
          },
          { status: 403 }
        );
      }
    }

    // Determine default landing route
    let defaultRoute = "/dashboard";
    if (session.role === "Staff") {
      defaultRoute = allowedAccess.includes("/dashboard")
        ? "/dashboard"
        : allowedAccess[0] || "/pos";
    }

    // Update JWT token with storeId and businessId
    const updatedToken = await createSessionToken({
      ...session,
      businessId: business.id,
      businessName: business.name,
      storeId: store.id,
      status: business.status,
      expiryDate: business.expiry_date,
      plan: business.plan,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
      },
      business: {
        id: business.id,
        name: business.name,
      },
      defaultRoute,
      role: session.role,
      access: allowedAccess,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: updatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set({
      name: ACTIVE_STORE_COOKIE,
      value: store.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set({
      name: ACTIVE_BUSINESS_COOKIE,
      value: business.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Error selecting store:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
