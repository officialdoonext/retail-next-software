import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  if (!token || !storeId) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { session, storeId };
}

export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const designRef = doc(db, "idCardDesigns", ctx.storeId);
    const snap = await getDoc(designRef);
    if (!snap.exists()) {
      return NextResponse.json({ success: true, design: null });
    }
    return NextResponse.json({ success: true, design: snap.data() });
  } catch (error: any) {
    console.error("Error fetching ID card design:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch design." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    if (!body.primaryColor || !body.secondaryColor) {
      return NextResponse.json({ success: false, error: "Missing required design fields." }, { status: 400 });
    }
    const design = {
      primaryColor: body.primaryColor || "#5e2b9d",
      secondaryColor: body.secondaryColor || "#7c3aed",
      accentColor: body.accentColor || "#a78bfa",
      textDarkColor: body.textDarkColor || "#1a1a2e",
      textLightColor: body.textLightColor || "#6b7280",
      showName: body.showName !== false,
      showEmpId: body.showEmpId !== false,
      showMobile: body.showMobile !== false,
      showQr: body.showQr !== false,
      bgPattern: ["dots", "lines", "none"].includes(body.bgPattern) ? body.bgPattern : "dots",
      storeId: ctx.storeId,
      updatedAt: Date.now(),
    };
    const designRef = doc(db, "idCardDesigns", ctx.storeId);
    await setDoc(designRef, design, { merge: true });
    return NextResponse.json({ success: true, design });
  } catch (error: any) {
    console.error("Error saving ID card design:", error);
    return NextResponse.json({ success: false, error: "Failed to save design." }, { status: 500 });
  }
}

