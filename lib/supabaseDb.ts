import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_BUSINESS_COOKIE, ACTIVE_STORE_COOKIE, SessionPayload } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface BusinessContext {
  userId?: string;
  email: string;
  role: "Admin" | "Staff";
  businessId: string;
  businessName?: string;
  storeId?: string;
  session: SessionPayload;
  supabase: ReturnType<typeof getSupabaseAdmin>;
}

// Extract authenticated business and store context for server route handlers
export async function getBusinessContext(): Promise<BusinessContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || !session.email) return null;

  // Resolve businessId from cookie, session, or query
  let businessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value || session.businessId;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value || session.storeId;

  const supabase = getSupabaseAdmin();

  // If businessId is not in cookie/session, lookup from database
  if (!businessId) {
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name")
      .or(`email.eq.${session.email.toLowerCase()}${session.userId ? `,owner_id.eq.${session.userId}` : ""}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (businesses && businesses.length > 0) {
      businessId = businesses[0].id;
    }
  }

  if (!businessId) {
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    businessId,
    businessName: session.businessName,
    storeId,
    session,
    supabase,
  };
}
