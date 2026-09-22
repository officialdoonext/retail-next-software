import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// GET: Fetch all products for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const productsRef = collection(db, "products");
    const q = query(productsRef, where("storeId", "==", ctx.storeId));
    const snapshot = await getDocs(q);

    const products = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort newest first
    products.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch products." }, { status: 500 });
  }
}

// POST: Create a new product for the active store
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    const hasVariations = Boolean(body.hasVariations);

    const productData: any = {
      name,
      description: String(body.description || "").trim(),
      categoryId: body.categoryId || "",
      categoryName: body.categoryName || "Uncategorized",
      imageUrl: body.imageUrl || "",
      hasVariations,
      storeId: ctx.storeId,
      createdBy: ctx.session.email,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (hasVariations) {
      // Variations product
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      if (rawVariants.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one variant combination is required." },
          { status: 400 }
        );
      }

      productData.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      productData.variants = rawVariants.map((v: any, index: number) => ({
        id: v.id || `var_${Date.now()}_${index}`,
        name: String(v.name || `Variant ${index + 1}`),
        attributes: v.attributes || {},
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        bufferStock: Number(v.bufferStock) || 0,
        barcode: String(v.barcode || Math.floor(100000000000 + Math.random() * 900000000000)),
        sku: String(v.sku || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`),
      }));

      // Calculate total stock and lowest price for quick table view
      productData.totalStock = productData.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      productData.minPrice = Math.min(...productData.variants.map((v: any) => v.price));
      productData.maxPrice = Math.max(...productData.variants.map((v: any) => v.price));
    } else {
      // Simple product
      productData.price = Number(body.price) || 0;
      productData.stock = Number(body.stock) || 0;
      productData.bufferStock = Number(body.bufferStock) || 0;
      productData.barcode = String(body.barcode || Math.floor(100000000000 + Math.random() * 900000000000));
      productData.sku = String(body.sku || `SKU-${Date.now().toString().slice(-6)}`);
      productData.totalStock = productData.stock;
      productData.minPrice = productData.price;
      productData.maxPrice = productData.price;
    }

    const docRef = await addDoc(collection(db, "products"), productData);

    return NextResponse.json({
      success: true,
      product: {
        id: docRef.id,
        ...productData,
      },
    });
  } catch (error: any) {
    console.error("Error creating product:", error);
    return NextResponse.json({ success: false, error: "Failed to save product." }, { status: 500 });
  }
}

// PUT: Update an existing product
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const productId = body.id;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const productDocRef = doc(db, "products", productId);
    const existingSnap = await getDoc(productDocRef);

    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    if (existingSnap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Access denied to product." }, { status: 403 });
    }

    const hasVariations = Boolean(body.hasVariations);

    const updateData: any = {
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim(),
      categoryId: body.categoryId || "",
      categoryName: body.categoryName || "Uncategorized",
      imageUrl: body.imageUrl || "",
      hasVariations,
      updatedAt: Date.now(),
    };

    if (hasVariations) {
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      updateData.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      updateData.variants = rawVariants.map((v: any, index: number) => ({
        id: v.id || `var_${Date.now()}_${index}`,
        name: String(v.name || `Variant ${index + 1}`),
        attributes: v.attributes || {},
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        bufferStock: Number(v.bufferStock) || 0,
        barcode: String(v.barcode || Math.floor(100000000000 + Math.random() * 900000000000)),
        sku: String(v.sku || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`),
      }));
      updateData.totalStock = updateData.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      updateData.minPrice = Math.min(...updateData.variants.map((v: any) => v.price));
      updateData.maxPrice = Math.max(...updateData.variants.map((v: any) => v.price));
    } else {
      updateData.price = Number(body.price) || 0;
      updateData.stock = Number(body.stock) || 0;
      updateData.bufferStock = Number(body.bufferStock) || 0;
      updateData.barcode = String(body.barcode || "");
      updateData.sku = String(body.sku || "");
      updateData.totalStock = updateData.stock;
      updateData.minPrice = updateData.price;
      updateData.maxPrice = updateData.price;
    }

    await updateDoc(productDocRef, updateData);

    return NextResponse.json({
      success: true,
      product: {
        id: productId,
        ...existingSnap.data(),
        ...updateData,
      },
    });
  } catch (error: any) {
    console.error("Error updating product:", error);
    return NextResponse.json({ success: false, error: "Failed to update product." }, { status: 500 });
  }
}

// DELETE: Delete a product
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const productDocRef = doc(db, "products", productId);
    const existingSnap = await getDoc(productDocRef);

    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    if (existingSnap.data().storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Access denied to product." }, { status: 403 });
    }

    await deleteDoc(productDocRef);

    return NextResponse.json({ success: true, message: "Product deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ success: false, error: "Failed to delete product." }, { status: 500 });
  }
}
