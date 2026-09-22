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
  updateDoc,
  deleteDoc,
  increment,
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

// GET: Fetch all settled sales/orders for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("storeId", "==", ctx.storeId),
      where("status", "==", "SETTLED")
    );
    const snapshot = await getDocs(q);

    const orders = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort newest first
    orders.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error("Error fetching settled orders:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch sales records." }, { status: 500 });
  }
}

// POST: Settle a bill (Deduct stock, update customer stats, remove saved draft if any, record sale)
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Cannot settle an empty bill." }, { status: 400 });
    }

    // Payment validation
    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase();
    const subtotal = Number(body.subtotal) || 0;
    const discount = Number(body.discount) || 0;
    const cgst = Number(body.cgst) || 0;
    const sgst = Number(body.sgst) || 0;
    const grandTotal = Number(body.grandTotal) || 0;

    let splitDetails = null;
    if (paymentMethod === "SPLIT") {
      const upi = Number(body.splitDetails?.upi) || 0;
      const cash = Number(body.splitDetails?.cash) || 0;
      const card = Number(body.splitDetails?.card) || 0;
      const totalSplit = Math.round((upi + cash + card) * 100) / 100;
      const roundedGrandTotal = Math.round(grandTotal * 100) / 100;

      if (Math.abs(totalSplit - roundedGrandTotal) > 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Split amounts (₹${totalSplit.toFixed(2)}) must equal grand total (₹${roundedGrandTotal.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }
      splitDetails = { upi, cash, card };
    }

    // Generate readable Bill / Invoice ID
    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const billNumber = `INV-${yyyymmdd}-${randomSuffix}`;

    // 1. DEDUCT STOCK FOR EACH ITEM IN FIRESTORE
    // We group items by productId to avoid race conditions when multiple variants of the same product are in the cart
    const itemsByProduct = new Map<string, any[]>();
    for (const item of items) {
      if (!item.productId) continue;
      const existing = itemsByProduct.get(item.productId) || [];
      existing.push(item);
      itemsByProduct.set(item.productId, existing);
    }

    for (const [productId, productItems] of itemsByProduct.entries()) {
      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const prodData = productSnap.data();

          if (prodData.hasVariations && Array.isArray(prodData.variants)) {
            // Update variants stock
            const updatedVariants = [...prodData.variants];
            for (const item of productItems) {
              const vIdx = updatedVariants.findIndex((v: any) => v.id === item.variantId);
              if (vIdx !== -1) {
                const currentStock = Number(updatedVariants[vIdx].stock) || 0;
                const newStock = Math.max(0, currentStock - (Number(item.quantity) || 1));
                updatedVariants[vIdx] = {
                  ...updatedVariants[vIdx],
                  stock: newStock,
                };
              }
            }

            const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
            await updateDoc(productRef, {
              variants: updatedVariants,
              totalStock,
              updatedAt: Date.now(),
            });
          } else {
            // Simple product stock deduction
            const totalQtyDeducted = productItems.reduce(
              (sum: number, it: any) => sum + (Number(it.quantity) || 1),
              0
            );
            const currentStock = Number(prodData.stock) || 0;
            const newStock = Math.max(0, currentStock - totalQtyDeducted);

            await updateDoc(productRef, {
              stock: newStock,
              totalStock: newStock,
              updatedAt: Date.now(),
            });
          }
        }
      } catch (err) {
        console.error(`Error deducting stock for product ${productId}:`, err);
      }
    }

    // 2. UPDATE CUSTOMER STATS IF CUSTOMER IS ATTACHED
    const customer = body.customer || null;
    if (customer && customer.id) {
      try {
        const custRef = doc(db, "customers", customer.id);
        await updateDoc(custRef, {
          totalOrders: increment(1),
          totalSpend: increment(grandTotal),
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error("Error updating customer stats:", err);
      }
    }

    // 3. IF THIS BILL WAS PREVIOUSLY SAVED (HOLD), DELETE FROM saved_bills
    if (body.savedBillId) {
      try {
        const savedBillRef = doc(db, "saved_bills", body.savedBillId);
        await deleteDoc(savedBillRef);
      } catch (err) {
        console.error("Error deleting saved bill draft:", err);
      }
    }

    // 4. CREATE SETTLED ORDER IN orders COLLECTION
    const orderData: any = {
      billNumber,
      storeId: ctx.storeId,
      status: "SETTLED",
      customer: customer
        ? {
            id: customer.id || "",
            name: customer.name || "Walk-in Customer",
            phone: customer.phone || "",
            city: customer.city || "",
          }
        : {
            id: "",
            name: "Walk-in Customer",
            phone: "",
            city: "",
          },
      items: items.map((it: any) => ({
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
      subtotal,
      discount,
      discountType: body.discountType || "FIXED",
      cgst,
      sgst,
      cgstPercent: body.cgstPercent ?? 0,
      sgstPercent: body.sgstPercent ?? 0,
      isPriceInclusiveGst: Boolean(body.isPriceInclusiveGst),
      grandTotal,
      paymentMethod,
      splitDetails,
      notes: String(body.notes || "").trim(),
      settledBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    return NextResponse.json({
      success: true,
      message: "Bill settled successfully!",
      order: {
        id: docRef.id,
        ...orderData,
      },
    });
  } catch (error: any) {
    console.error("Error settling bill:", error);
    return NextResponse.json({ success: false, error: "Failed to settle bill." }, { status: 500 });
  }
}
