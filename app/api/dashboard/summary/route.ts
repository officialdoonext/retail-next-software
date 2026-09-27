import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET /api/dashboard/summary: Fast summary aggregation reading daily_sales documents (Guideline #8)
export async function GET(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const todayStr = new Date().toISOString().slice(0, 10);
    const requestedDate = searchParams.get("date") || todayStr;

    // Single document read for today's summary
    const todayDocRef = doc(db, "daily_sales", `${ctx.storeId}_${requestedDate}`);
    const todaySnap = await getDoc(todayDocRef);

    let todaySummary = null;
    if (todaySnap.exists()) {
      todaySummary = todaySnap.data();
    }

    // Optional: read last 7 days summaries
    const summariesRef = collection(db, "daily_sales");
    const q = query(summariesRef, where("storeId", "==", ctx.storeId));
    const allSummariesSnap = await getDocs(q);

    const summaries = allSummariesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      success: true,
      todaySummary,
      summaries,
    });
  } catch (error: any) {
    console.error("Error reading dashboard summary:", error);
    return NextResponse.json({ success: false, error: "Failed to read summary data." }, { status: 500 });
  }
}
