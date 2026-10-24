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

    const { businessId } = await request.json();
    if (!businessId) {
      return NextResponse.json({ success: false, error: "Business ID is required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
      return NextResponse.json({ success: false, error: "Supabase credentials not configured." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Fetch business and verify ownership
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (error || !business) {
      return NextResponse.json({ success: false, error: "Business not found." }, { status: 404 });
    }

    // Verify ownership
    if (business.email?.toLowerCase() !== session.email.toLowerCase() && business.owner_id !== session.userId) {
      return NextResponse.json({ success: false, error: "Access denied to this business." }, { status: 403 });
    }

    // 2. Strict status and unexpired date check
    const isAllowed = isBusinessAllowed(business.status, business.expiry_date);

    // 3. Find default active store for this business
    let activeStoreId: string | null = null;
    try {
      const { data: stores } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("business_id", businessId)
        .limit(1);
      if (stores && stores.length > 0) {
        activeStoreId = stores[0].id;
      }
    } catch {}

    // 4. Update signed JWT session token
    const updatedToken = await createSessionToken({
      ...session,
      businessId: business.id,
      businessName: business.name,
      status: business.status || "Inactive",
      expiryDate: business.expiry_date ?? null,
      plan: business.plan ?? null,
      enabledModules: Array.isArray(business.enabled_modules) ? business.enabled_modules : undefined,
      storeId: activeStoreId || undefined,
      createdAt: Date.now(),
    });

    const destination = isAllowed ? "/dashboard" : "/onboarding";

    const response = NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        status: business.status,
        expiryDate: business.expiry_date,
      },
      isAllowed,
      redirect: destination,
    });

    // Set auth session cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: updatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    // Set active business cookie
    response.cookies.set({
      name: ACTIVE_BUSINESS_COOKIE,
      value: business.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    if (activeStoreId) {
      response.cookies.set({
        name: ACTIVE_STORE_COOKIE,
        value: activeStoreId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Error selecting business:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error." }, { status: 500 });
  }
}
