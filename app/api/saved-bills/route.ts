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
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
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

// GET: Fetch all saved/held draft bills for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const savedBillsRef = collection(db, "saved_bills");
    const q = query(savedBillsRef, where("storeId", "==", ctx.storeId));
    const snapshot = await getDocs(q);

    const savedBills = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort newest first
    savedBills.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, savedBills });
  } catch (error: any) {
    console.error("Error fetching saved bills:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch saved bills." }, { status: 500 });
  }
}

// POST: Save cart as a draft bill (Hold bill without deducting stock)
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Cannot save an empty bill." }, { status: 400 });
    }

    const draftNumber = `HOLD-${Date.now().toString().slice(-6)}`;

    const savedBillData: any = {
      draftNumber,
      storeId: ctx.storeId,
      customer: body.customer || null,
      items: items.map((it: any, index: number) => ({
        cartId: it.cartId || (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) || `item_${Date.now()}_${index}`,
        productId: it.productId,
        productName: it.productName,
        variantId: it.variantId || null,
        variantName: it.variantName || null,
        barcode: it.barcode || "",
        sku: it.sku || "",
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        total: (Number(it.price) || 0) * (Number(it.quantity) || 1),
      })),
      totalItemsCount: items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0),
      subtotal: Number(body.subtotal) || 0,
      discount: Number(body.discount) || 0,
      discountType: body.discountType || "FIXED",
      cgst: Number(body.cgst) || 0,
      sgst: Number(body.sgst) || 0,
      grandTotal: Number(body.grandTotal) || 0,
      paymentMethod: body.paymentMethod || "CASH",
      notes: String(body.notes || "").trim(),
      savedBy: ctx.session.email,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // If an existing savedBillId was passed, update it instead of creating duplicate
    if (body.id) {
      const existingRef = doc(db, "saved_bills", body.id);
      const snap = await getDoc(existingRef);
      if (snap.exists() && snap.data().storeId === ctx.storeId) {
        await updateDoc(existingRef, {
          ...savedBillData,
          draftNumber: snap.data().draftNumber || draftNumber,
          updatedAt: Date.now(),
        });
        return NextResponse.json({
          success: true,
          message: "Saved bill updated successfully.",
          savedBill: { id: body.id, ...savedBillData },
        });
      }
    }

    const docRef = await addDoc(collection(db, "saved_bills"), savedBillData);

    return NextResponse.json({
      success: true,
      message: "Bill placed on hold in saved bills.",
      savedBill: {
        id: docRef.id,
        ...savedBillData,
      },
    });
  } catch (error: any) {
    console.error("Error saving bill:", error);
    return NextResponse.json({ success: false, error: "Failed to save bill." }, { status: 500 });
  }
}

// DELETE: Discard a saved bill by id
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("id");

    if (!billId) {
      return NextResponse.json({ success: false, error: "Missing bill ID." }, { status: 400 });
    }

    const billRef = doc(db, "saved_bills", billId);
    const snap = await getDoc(billRef);

    if (!snap.exists() || snap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Saved bill not found or unauthorized." }, { status: 404 });
    }

    await deleteDoc(billRef);

    return NextResponse.json({ success: true, message: "Saved bill removed." });
  } catch (error: any) {
    console.error("Error deleting saved bill:", error);
    return NextResponse.json({ success: false, error: "Failed to delete saved bill." }, { status: 500 });
  }
}
