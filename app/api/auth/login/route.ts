import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSessionToken, isBusinessAllowed, AUTH_COOKIE_NAME, ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = String(body.email || "").trim();
    const password = String(body.password || "").trim();

    if (!rawEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter both email address and password." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

    if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase credentials are not configured yet. Please update NEXT_PUBLIC_SUPABASE_URL and keys in .env.local.",
        },
        { status: 500 }
      );
    }

    // 1. Authenticate with Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: authError?.message || "Invalid email or password. Please verify your credentials.",
        },
        { status: 401 }
      );
    }

    const user = authData.user;

    // 2. Fetch business records for this user using admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: businesses, error: busError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .or(`email.eq.${email},owner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (busError) {
      console.error("Error querying businesses from Supabase:", busError);
    }

    let activeBusiness: any = null;

    if (businesses && businesses.length > 0) {
      // Pick first active unexpired business, or fallback to the most recent one
      activeBusiness =
        businesses.find((b) => isBusinessAllowed(b.status, b.expiry_date)) || businesses[0];
    } else {
      // If no business exists yet for this user, create an Inactive record with null expiry
      const fallbackName = user.user_metadata?.business_name || `${email.split("@")[0]}'s Business`;
      const { data: createdBus } = await supabaseAdmin
        .from("businesses")
        .insert([
          {
            name: fallbackName,
            mobile_number: user.user_metadata?.mobile || "Not Provided",
            email: email,
            owner_id: user.id,
            status: "Inactive",
            expiry_date: null,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      activeBusiness = createdBus || {
        id: "default",
        name: fallbackName,
        status: "Inactive",
        expiry_date: null,
      };
    }

    // 3. Strict security check: Status MUST be "Active" AND expiry_date MUST NOT be null and unexpired
    const isAllowed = isBusinessAllowed(activeBusiness.status, activeBusiness.expiry_date);

    // 4. Issue cryptographically signed JWT token with embedded business identity & status
    const token = await createSessionToken({
      userId: user.id,
      email: user.email || email,
      role: "Admin",
      businessId: activeBusiness.id,
      businessName: activeBusiness.name,
      status: activeBusiness.status || "Inactive",
      expiryDate: activeBusiness.expiry_date ?? null,
      plan: activeBusiness.plan ?? null,
      enabledModules: Array.isArray(activeBusiness.enabled_modules) ? activeBusiness.enabled_modules : undefined,
      createdAt: Date.now(),
    });

    const destination = isAllowed ? "/dashboard" : "/onboarding";

    const response = NextResponse.json({
      success: true,
      message: "Sign in successful.",
      redirect: destination,
      isAllowed,
      business: activeBusiness,
      user: {
        id: user.id,
        email: user.email,
        role: "Admin",
      },
    });

    // Set auth cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    // Set active business cookie
    if (activeBusiness.id) {
      response.cookies.set({
        name: ACTIVE_BUSINESS_COOKIE,
        value: activeBusiness.id,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Error in login endpoint:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
