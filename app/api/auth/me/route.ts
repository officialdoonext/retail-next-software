import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifySessionToken,
  createSessionToken,
  isBusinessAllowed,
  AUTH_COOKIE_NAME,
  ACTIVE_BUSINESS_COOKIE,
  ACTIVE_STORE_COOKIE,
} from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    let currentBusiness: any = null;
    let businessesList: any[] = [];
    const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value || payload.businessId;

    if (supabaseUrl && !supabaseUrl.includes("your-project-id")) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Query user's businesses
        const { data: businesses } = await supabaseAdmin
          .from("businesses")
          .select("*")
          .or(`email.eq.${payload.email.toLowerCase()}${payload.userId ? `,owner_id.eq.${payload.userId}` : ""}`)
          .order("created_at", { ascending: false });

        businessesList = businesses || [];

        if (activeBusinessId) {
          currentBusiness = businessesList.find((b) => b.id === activeBusinessId);
        }
        if (!currentBusiness && businessesList.length > 0) {
          currentBusiness = businessesList[0];
        }
      } catch (dbErr) {
        console.error("Error reading business from Supabase:", dbErr);
      }
    }

    // Determine live status, expiry date & enabled modules strictly from Supabase
    const liveStatus = currentBusiness?.status || payload.status || "Inactive";
    const liveExpiry = currentBusiness ? currentBusiness.expiry_date : payload.expiryDate ?? null;
    const livePlan = currentBusiness?.plan ?? payload.plan ?? null;
    const liveModules = currentBusiness
      ? (Array.isArray(currentBusiness.enabled_modules) ? currentBusiness.enabled_modules : null)
      : (Array.isArray(payload.enabledModules) ? payload.enabledModules : null);

    const isAllowed =
      payload.role === "Staff" ? true : isBusinessAllowed(liveStatus, liveExpiry);

    // Refresh JWT session token with live status and business ID
    const updatedToken = await createSessionToken({
      ...payload,
      businessId: currentBusiness?.id || payload.businessId,
      businessName: currentBusiness?.name || payload.businessName,
      status: liveStatus,
      plan: livePlan,
      expiryDate: liveExpiry,
      enabledModules: Array.isArray(liveModules) ? liveModules : undefined,
    });

    const response = NextResponse.json({
      authenticated: true,
      isAllowed,
      user: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        mobile: payload.mobile || null,
        staffName: payload.staffName || null,
        staffId: payload.staffId || null,
        access: payload.access || [],
        businessId: currentBusiness?.id || payload.businessId || null,
        businessName: currentBusiness?.name || payload.businessName || null,
        status: liveStatus,
        plan: livePlan,
        expiryDate: liveExpiry,
        enabledModules: liveModules,
      },
      businesses: businessesList,
      currentBusiness,
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

    if (currentBusiness?.id) {
      response.cookies.set({
        name: ACTIVE_BUSINESS_COOKIE,
        value: currentBusiness.id,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    // Keep client_modules cookie synchronized for zero-flash middleware enforcement
    response.cookies.set({
      name: "client_modules",
      value: encodeURIComponent(JSON.stringify(liveModules || [])),
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Error in auth/me route:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
