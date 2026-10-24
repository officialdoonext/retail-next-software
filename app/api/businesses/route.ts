import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || supabaseUrl.includes("your-project-id")) {
    throw new Error("Supabase is not configured yet in .env.local");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// GET: List all businesses owned by user
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value || session.businessId;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .or(`email.eq.${session.email.toLowerCase()}${session.userId ? `,owner_id.eq.${session.userId}` : ""}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const list = (businesses || []).map((b) => ({
      ...b,
      isActiveSelection: b.id === activeBusinessId,
    }));

    return NextResponse.json({
      success: true,
      businesses: list,
      activeBusinessId,
    });
  } catch (error: any) {
    console.error("Error fetching businesses:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch businesses." }, { status: 500 });
  }
}

// POST: Add a new business from onboarding page
// STRICT REQUIREMENT: expiry_date MUST BE NULL, status MUST BE "Inactive"
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || body.businessName || "").trim();
    const mobileNumber = String(body.mobileNumber || body.phone || "").trim();
    const city = String(body.city || "").trim();
    const fullAddress = String(body.fullAddress || body.address || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Business name is required." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const newBusinessData = {
      name,
      mobile_number: mobileNumber || session.mobile || "Not Provided",
      email: session.email.toLowerCase(),
      owner_id: session.userId || null,
      status: "Inactive", // Strictly Inactive on creation
      expiry_date: null,  // Strictly null on creation
      plan: null,
      max_stores: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdBus, error: insertErr } = await supabaseAdmin
      .from("businesses")
      .insert([newBusinessData])
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Business created with Inactive status and pending expiry approval.",
      business: createdBus,
    });
  } catch (error: any) {
    console.error("Error creating business:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create business." }, { status: 500 });
  }
}
