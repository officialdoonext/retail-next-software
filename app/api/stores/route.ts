import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

// Helper to authenticate request
async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// GET: Fetch all stores belonging to the authenticated user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const activeStoreId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value || null;

    const storesRef = collection(db, "stores");
    const q = query(storesRef, where("ownerEmail", "==", session.email));
    const querySnapshot = await getDocs(q);

    const stores = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      isActiveSelection: docSnap.id === activeStoreId,
    }));

    return NextResponse.json({ success: true, stores, activeStoreId });
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve stores." },
      { status: 500 }
    );
  }
}

// POST: Register a new store for the user
// Strictly enforces status="Inactive" and expires=null
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const location = String(body.location || "").trim();
    const phone = String(body.phone || "").trim();
    const license = String(body.license || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Store name is required." },
        { status: 400 }
      );
    }

    const generatedCode = `RET ${Math.floor(1000 + Math.random() * 9000)}`;

    const storeData = {
      name,
      location: location || "Main Branch",
      phone: phone || "Not Provided",
      license: license || `RET-TS-${Math.floor(1000 + Math.random() * 9000)}`,
      code: generatedCode,
      ownerEmail: session.email,
      // Strictly enforced: inactive with no expiry date on creation
      status: "Inactive" as const,
      expires: null,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, "stores"), storeData);

    return NextResponse.json({
      success: true,
      store: {
        id: docRef.id,
        ...storeData,
      },
    });
  } catch (error) {
    console.error("Error creating store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create store." },
      { status: 500 }
    );
  }
}
