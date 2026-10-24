import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifySessionToken,
  createSessionToken,
  isBusinessAllowed,
  AUTH_COOKIE_NAME,
  ACTIVE_BUSINESS_COOKIE,
} from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    let status = "Inactive";
    let plan = null;
    let expiryDate: any = null;
    let enabledModules: string[] | null = null;
    let businessName = session.businessName || "";
    let businessId = session.businessId || cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

    if (supabaseUrl && !supabaseUrl.includes("your-project-id")) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        let query = supabaseAdmin.from("businesses").select("*");
        if (businessId) {
          query = query.eq("id", businessId);
        } else {
          query = query.or(`email.eq.${session.email.toLowerCase()}${session.userId ? `,owner_id.eq.${session.userId}` : ""}`);
        }

        const { data: businesses } = await query.order("created_at", { ascending: false });

        if (businesses && businesses.length > 0) {
          const b = businesses[0];
          businessId = b.id;
          businessName = b.name;
          status = b.status || "Inactive";
          expiryDate = b.expiry_date ?? null;
          plan = b.plan ?? null;
          enabledModules = Array.isArray(b.enabled_modules) ? b.enabled_modules : null;
        }
      } catch (err) {
        console.error("Error refreshing business from Supabase:", err);
      }
    }

    // Strict validation: status MUST be "Active" AND expiryDate MUST be valid & unexpired
    const isAllowed = session.role === "Staff" ? true : isBusinessAllowed(status, expiryDate);

    // Re-issue signed JWT token with updated live business status & expiry
    const updatedToken = await createSessionToken({
      ...session,
      businessId,
      businessName,
      status,
      plan,
      expiryDate,
      enabledModules: enabledModules || undefined,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      businessId,
      businessName,
      status,
      plan,
      expiryDate,
      enabledModules,
      isAllowed,
      redirect: isAllowed ? "/dashboard" : "/onboarding",
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

    if (businessId) {
      response.cookies.set({
        name: ACTIVE_BUSINESS_COOKIE,
        value: businessId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("Error refreshing session token:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error refreshing session." },
      { status: 500 }
    );
  }
}
