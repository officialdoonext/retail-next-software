import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET: Fetch all godowns for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const godownsRef = collection(db, "godowns");
    const q = query(godownsRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const godowns = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "",
        address: data.address || "",
        createdBy: data.createdBy || "",
        createdAt: data.createdAt || 0,
        updatedAt: data.updatedAt || 0,
      };
    });

    // Sort by createdAt descending
    godowns.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ success: true, godowns });
  } catch (error) {
    console.error("Error fetching godowns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch godowns." },
      { status: 500 }
    );
  }
}

// POST: Create a new godown
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Godown name is required." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const godownData = {
      name,
      address,
      storeId: ctx.storeId,
      createdBy: ctx.session.email,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, "godowns"), godownData);

    return NextResponse.json({
      success: true,
      godown: {
        id: docRef.id,
        ...godownData,
      },
    });
  } catch (error) {
    console.error("Error creating godown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create godown." },
      { status: 500 }
    );
  }
}

// PUT: Update an existing godown
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: "Godown ID and name are required." },
        { status: 400 }
      );
    }

    const godownDocRef = doc(db, "godowns", id);
    const snap = await getDoc(godownDocRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Godown not found." }, { status: 404 });
    }

    if (snap.data().storeId !== ctx.storeId) {
      return NextResponse.json(
        { success: false, error: "Access denied to godown." },
        { status: 403 }
      );
    }

    const updatePayload = {
      name,
      address,
      updatedAt: Date.now(),
    };

    await updateDoc(godownDocRef, updatePayload);

    return NextResponse.json({
      success: true,
      godown: {
        id,
        ...snap.data(),
        ...updatePayload,
      },
    });
  } catch (error) {
    console.error("Error updating godown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update godown." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a godown
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const godownId = searchParams.get("id");

    if (!godownId) {
      return NextResponse.json(
        { success: false, error: "Godown ID is required." },
        { status: 400 }
      );
    }

    const godownDocRef = doc(db, "godowns", godownId);
    const snap = await getDoc(godownDocRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Godown not found." }, { status: 404 });
    }

    if (snap.data().storeId !== ctx.storeId) {
      return NextResponse.json(
        { success: false, error: "Access denied to godown." },
        { status: 403 }
      );
    }

    await deleteDoc(godownDocRef);

    return NextResponse.json({ success: true, message: "Godown deleted successfully." });
  } catch (error) {
    console.error("Error deleting godown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete godown." },
      { status: 500 }
    );
  }
}
