import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  if (!token || !storeId) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { session, storeId };
}

// GET /api/employees: Fetch list of active staff/employees for POS billing & attribution
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const staffRef = collection(db, "staff");
    const q = query(staffRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const employees = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Employee",
          mobile: data.mobile || "",
          status: data.status || "Active",
        };
      })
      .filter((emp) => emp.status !== "Inactive")
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, employees });
  } catch (err: any) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees." },
      { status: 500 }
    );
  }
}
