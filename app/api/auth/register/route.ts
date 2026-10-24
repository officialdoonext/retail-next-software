import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSessionToken, AUTH_COOKIE_NAME, ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const mobileNumber = String(body.mobileNumber || body.phone || "").trim();
    const rawEmail = String(body.email || "").trim();
    const password = String(body.password || "").trim();
    const confirmPassword = String(body.confirmPassword || "").trim();

    // 1. Validation
    if (!businessName) {
      return NextResponse.json({ success: false, error: "Business name is required." }, { status: 400 });
    }
    if (!mobileNumber || mobileNumber.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ success: false, error: "Please provide a valid 10-digit mobile number." }, { status: 400 });
    }
    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters long." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, error: "Passwords do not match. Please re-enter." }, { status: 400 });
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

    // Use privileged service client for atomic user & business creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Create user in Supabase Auth
    let authUserId: string | null = null;
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm email for frictionless setup
      user_metadata: {
        business_name: businessName,
        mobile: mobileNumber,
      },
    });

    if (signUpError) {
      // If user already exists, check if we can authenticate with credentials
      if (signUpError.message?.toLowerCase().includes("already registered") || signUpError.message?.toLowerCase().includes("already exists")) {
        return NextResponse.json(
          { success: false, error: "An account with this email address already exists. Please sign in instead." },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, error: signUpError.message }, { status: 400 });
    }

    authUserId = signUpData.user?.id || null;

    // 3. Create Business record in Supabase:
    // STRICT REQUIREMENT: expiry_date MUST BE NULL, status MUST BE "Inactive"
    const businessData = {
      name: businessName,
      mobile_number: mobileNumber,
      email: email,
      owner_id: authUserId,
      status: "Inactive", // Strictly Inactive on creation
      expiry_date: null,  // Strictly null on creation
      plan: null,
      max_stores: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedBusiness, error: busError } = await supabaseAdmin
      .from("businesses")
      .insert([businessData])
      .select()
      .single();

    if (busError) {
      console.error("Error creating business record in Supabase:", busError);
      return NextResponse.json(
        {
          success: false,
          error: `Account created, but failed to save business details: ${busError.message}. Please ensure the 'businesses' table exists in Supabase.`,
        },
        { status: 500 }
      );
    }

    const businessId = insertedBusiness.id;

    // 4. Create initial default primary store for this business with status Inactive & expiry null
    try {
      await supabaseAdmin.from("stores").insert([
        {
          business_id: businessId,
          name: `${businessName} Main Branch`,
          code: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: mobileNumber,
          mobile_number: mobileNumber,
          status: "Inactive",
          expires: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (storeErr) {
      console.warn("Could not insert initial store:", storeErr);
    }

    // 5. Issue signed session token for the user
    // Since status is "Inactive" and expiryDate is null, isAllowed is strictly FALSE!
    const token = await createSessionToken({
      userId: authUserId || undefined,
      email,
      role: "Admin",
      businessId: businessId,
      businessName: businessName,
      status: "Inactive",
      expiryDate: null,
      plan: null,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      message: "Account and business created successfully. Awaiting administrator activation.",
      redirect: "/onboarding",
      isAllowed: false,
      business: insertedBusiness,
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

    // Set active_business_id cookie
    response.cookies.set({
      name: ACTIVE_BUSINESS_COOKIE,
      value: businessId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Error in register endpoint:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during account creation." },
      { status: 500 }
    );
  }
}
