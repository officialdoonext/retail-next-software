import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";

// Helper to authenticate request
async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Helper to determine maxStores limit for a user
function resolveMaxStores(userData: any, currentCount = 0): number {
  if (userData?.maxStores && !isNaN(Number(userData.maxStores)) && Number(userData.maxStores) > 0) {
    return Number(userData.maxStores);
  }
  const plan = String(userData?.plan || "").toLowerCase();
  if (plan.includes("unlimited")) return 999;
  if (plan.includes("enterprise")) return 20;
  if (plan.includes("business")) return 6;
  if (plan.includes("growth")) return 3;
  if (plan.includes("starter")) return 1;
  return Math.max(currentCount, 2);
}

// GET: Fetch all stores belonging to the authenticated user (or assigned to staff)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const activeStoreId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value || null;

    let stores: any[] = [];
    let maxStores = 2;

    if (session.role === "Staff") {
      // Staff user: only return stores where this staff member is actively enrolled
      const cleanMobile = String(session.mobile || "").replace(/\D/g, "");
      const staffRef = collection(db, "staff");
      const staffQ = query(staffRef, where("mobile", "==", cleanMobile));
      const staffSnap = await getDocs(staffQ);

      const storeIds = Array.from(
        new Set(
          staffSnap.docs
            .filter((d) => !d.data().status || d.data().status === "Active")
            .map((d) => d.data().storeId)
            .filter(Boolean)
        )
      );

      if (storeIds.length > 0) {
        const storeDocs = await Promise.all(
          storeIds.map((sid) => getDoc(doc(db, "stores", sid)))
        );

        stores = storeDocs
          .filter((d) => d.exists())
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
            isActiveSelection: docSnap.id === activeStoreId,
          }));
      }
      maxStores = Math.max(stores.length, 2);
    } else {
      // Admin user: return all stores owned by the admin email
      const storesRef = collection(db, "stores");
      const q = query(storesRef, where("ownerEmail", "==", session.email));
      const querySnapshot = await getDocs(q);

      stores = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        isActiveSelection: docSnap.id === activeStoreId,
      }));

      // Fetch user profile to read subscription maxStores limit
      try {
        const userDocRef = doc(
          db,
          "users",
          session.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_")
        );
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          maxStores = resolveMaxStores(userSnap.data(), stores.length);
        } else {
          maxStores = Math.max(stores.length, 2);
        }
      } catch (userErr) {
        console.error("Error reading user maxStores:", userErr);
        maxStores = Math.max(stores.length, 2);
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
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve stores." },
      { status: 500 }
    );
  }
}

// POST: Register a new store for the user (Admin only)
// Strictly enforces store limit validation.
// Once created, store is set to Active status with unexpired validity.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "Staff") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only administrators can register stores." },
        { status: 403 }
      );
    }

    // 1. Check existing stores count for this admin
    const storesRef = collection(db, "stores");
    const countQuery = query(storesRef, where("ownerEmail", "==", session.email));
    const currentStoresSnap = await getDocs(countQuery);
    const currentStoresCount = currentStoresSnap.docs.length;

    // 2. Fetch user profile to check maxStores limit & subscription expiry
    const userDocRef = doc(
      db,
      "users",
      session.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_")
    );
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? userSnap.data() : null;
    const maxStores = resolveMaxStores(userData, currentStoresCount);

    // 3. Strict Store Limit Enforcement: block if store limit is reached
    if (currentStoresCount >= maxStores) {
      return NextResponse.json(
        {
          success: false,
          error: `Store limit reached (${currentStoresCount} of ${maxStores} allowed). Please contact your administrator to increase your store limit.`,
          limitReached: true,
          maxStores,
          currentStoresCount,
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
      return NextResponse.json(
        { success: false, error: "Store name is required." },
        { status: 400 }
      );
    }

    const generatedCode = `RET ${Math.floor(1000 + Math.random() * 9000)}`;
    const displayLocation = city ? (fullAddress ? `${city}, ${fullAddress}` : city) : fullAddress || "Main Branch";

    // Set expiry: use user's account expiry if valid, or default to 1 year ahead
    let effectiveStoreExpiry: any = userData?.expiryDate || null;
    if (!effectiveStoreExpiry) {
      effectiveStoreExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    const storeData = {
      name,
      mobileNumber: mobileNumber || "Not Provided",
      phone: mobileNumber || "Not Provided",
      city: city || "",
      fullAddress: fullAddress || "",
      location: displayLocation,
      gstNumber: gstNumber || "",
      license: gstNumber || `RET-TS-${Math.floor(1000 + Math.random() * 9000)}`,
      code: generatedCode,
      ownerEmail: session.email,
      // Strictly enforced: newly created stores are immediately Active
      status: "Active" as const,
      expires: effectiveStoreExpiry,
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
