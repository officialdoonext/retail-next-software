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

// GET: Fetch categories strictly for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const categoriesRef = collection(db, "categories");
    const q = query(categoriesRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const categories = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch categories." }, { status: 500 });
  }
}

// POST: Add new category for the active store
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Category name is required." }, { status: 400 });
    }

    const categoryData = {
      name,
      storeId: ctx.storeId,
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, "categories"), categoryData);

    return NextResponse.json({
      success: true,
      category: {
        id: docRef.id,
        ...categoryData,
      },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ success: false, error: "Failed to create category." }, { status: 500 });
  }
}

// DELETE: Delete a category belonging to active store
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");

    if (!categoryId) {
      return NextResponse.json({ success: false, error: "Category ID is required." }, { status: 400 });
    }

    const catDocRef = doc(db, "categories", categoryId);
    const snap = await getDoc(catDocRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Category not found." }, { status: 404 });
    }

    if (snap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Access denied to category." }, { status: 403 });
    }

    await deleteDoc(catDocRef);

    return NextResponse.json({ success: true, message: "Category deleted." });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ success: false, error: "Failed to delete category." }, { status: 500 });
  }
}
