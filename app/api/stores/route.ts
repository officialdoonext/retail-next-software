import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE, ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function resolveMaxStores(businessData: any, currentCount = 0): number {
  if (businessData?.max_stores && !isNaN(Number(businessData.max_stores)) && Number(businessData.max_stores) > 0) {
    return Number(businessData.max_stores);
  }
  const plan = String(businessData?.plan || "").toLowerCase();
  if (plan.includes("unlimited")) return 999;
  if (plan.includes("enterprise")) return 20;
  if (plan.includes("business")) return 6;
  if (plan.includes("growth")) return 3;
  if (plan.includes("starter")) return 1;
  return Math.max(currentCount, 2);
}

// GET: Fetch all stores belonging to the active business (or assigned to staff)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const activeStoreId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value || session.storeId || null;
    let businessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value || session.businessId;

    let supabase: any;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ success: false, error: "Database not configured." }, { status: 500 });
    }

    // If businessId is not in session/cookie, resolve from businesses table
    if (!businessId) {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .or(`email.eq.${session.email.toLowerCase()}${session.userId ? `,owner_id.eq.${session.userId}` : ""}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (businesses && businesses.length > 0) {
        businessId = businesses[0].id;
      }
    }

    let stores: any[] = [];
    let maxStores = 2;

    if (session.role === "Staff") {
      const cleanMobile = String(session.mobile || "").replace(/\D/g, "");
      const { data: staffRecords } = await supabase
        .from("staff")
        .select("store_id")
        .eq("mobile", cleanMobile)
        .eq("status", "Active");

      const storeIds = (staffRecords || []).map((s: any) => s.store_id).filter(Boolean);

      if (storeIds.length > 0) {
        const { data: staffStores } = await supabase
          .from("stores")
          .select("*")
          .in("id", storeIds);

        stores = (staffStores || []).map((s: any) => ({
          ...s,
          isActiveSelection: s.id === activeStoreId,
        }));
      }
      maxStores = Math.max(stores.length, 2);
    } else {
      // Admin: query stores belonging to active business
      if (businessId) {
        const { data: busStores } = await supabase
          .from("stores")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });

        stores = (busStores || []).map((s: any) => ({
          ...s,
          isActiveSelection: s.id === activeStoreId,
        }));

        // Fetch business details for max_stores limit
        const { data: busData } = await supabase
          .from("businesses")
          .select("max_stores, plan")
          .eq("id", businessId)
          .single();

        maxStores = resolveMaxStores(busData, stores.length);
      }
    }

    return NextResponse.json({
      success: true,
      stores,
      activeStoreId,
      maxStores,
      storesCount: stores.length,
      isLimitReached: stores.length >= maxStores,
    });
  } catch (error: any) {
    console.error("Error fetching stores:", error);
    return NextResponse.json({ success: false, error: "Failed to retrieve stores." }, { status: 500 });
  }
}

// POST: Register a new store for the active business
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "Staff") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only administrators can register stores." },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    let businessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value || session.businessId;

    const supabase = getSupabaseAdmin();

    if (!businessId) {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .or(`email.eq.${session.email.toLowerCase()}${session.userId ? `,owner_id.eq.${session.userId}` : ""}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (businesses && businesses.length > 0) {
        businessId = businesses[0].id;
      }
    }

    if (!businessId) {
      return NextResponse.json({ success: false, error: "Active business not found." }, { status: 400 });
    }

    // Check store limit for this business
    const { data: currentStores } = await supabase
      .from("stores")
      .select("id")
      .eq("business_id", businessId);

    const currentCount = currentStores ? currentStores.length : 0;

    const { data: busData } = await supabase
      .from("businesses")
      .select("max_stores, plan, expiry_date, status")
      .eq("id", businessId)
      .single();

    const maxStores = resolveMaxStores(busData, currentCount);

    if (currentCount >= maxStores) {
      return NextResponse.json(
        {
          success: false,
          error: `Store limit reached (${currentCount} of ${maxStores} allowed). Please contact support to increase your store limit.`,
          limitReached: true,
          maxStores,
          currentStoresCount: currentCount,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const mobileNumber = String(body.mobileNumber || body.phone || "").trim();
    const city = String(body.city || "").trim();
    const fullAddress = String(body.fullAddress || body.address || body.location || "").trim();
    const gstNumber = String(body.gstNumber || body.license || "").trim().toUpperCase();

    if (!name) {
      return NextResponse.json({ success: false, error: "Store name is required." }, { status: 400 });
    }

    const generatedCode = `RET ${Math.floor(1000 + Math.random() * 9000)}`;
    const displayLocation = city ? (fullAddress ? `${city}, ${fullAddress}` : city) : fullAddress || "Main Branch";

    const storeData = {
      business_id: businessId,
      name,
      mobile_number: mobileNumber || "Not Provided",
      phone: mobileNumber || "Not Provided",
      city: city || "",
      full_address: fullAddress || "",
      location: displayLocation,
      gst_number: gstNumber || "",
      license: gstNumber || `RET-TS-${Math.floor(1000 + Math.random() * 9000)}`,
      code: generatedCode,
      status: busData?.status === "Active" ? "Active" : "Inactive",
      expires: busData?.expiry_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newStore, error: insertErr } = await supabase
      .from("stores")
      .insert([storeData])
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      store: newStore,
    });
  } catch (error: any) {
    console.error("Error creating store:", error);
    return NextResponse.json({ success: false, error: "Failed to create store." }, { status: 500 });
  }
}
