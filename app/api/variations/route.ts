import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET: Fetch variations strictly for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const variationsRef = collection(db, "variations");
    const q = query(variationsRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const variations = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ success: true, variations });
  } catch (error) {
    console.error("Error fetching variations:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch variations." }, { status: 500 });
  }
}

// POST: Add new variation for the active store
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Variation name is required." }, { status: 400 });
    }

    const variationData = {
      name,
      storeId: ctx.storeId,
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, "variations"), variationData);

    return NextResponse.json({
      success: true,
      variation: {
        id: docRef.id,
        ...variationData,
      },
    });
  } catch (error) {
    console.error("Error creating variation:", error);
    return NextResponse.json({ success: false, error: "Failed to create variation." }, { status: 500 });
  }
}

// DELETE: Delete a variation belonging to active store
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const variationId = searchParams.get("id");

    if (!variationId) {
      return NextResponse.json({ success: false, error: "Variation ID is required." }, { status: 400 });
    }

    const varDocRef = doc(db, "variations", variationId);
    const snap = await getDoc(varDocRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Variation not found." }, { status: 404 });
    }

    if (snap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Access denied to variation." }, { status: 403 });
    }

    await deleteDoc(varDocRef);

    return NextResponse.json({ success: true, message: "Variation deleted." });
  } catch (error) {
    console.error("Error deleting variation:", error);
    return NextResponse.json({ success: false, error: "Failed to delete variation." }, { status: 500 });
  }
}
