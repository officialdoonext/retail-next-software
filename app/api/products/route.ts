import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, limit as firestoreLimit } from "firebase/firestore";


async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

// Helper to return lightweight product document (Guideline #2: Use Firestore only for data you need)
function toLightweightProduct(d: any) {
  return {
    id: d.id,
    name: d.name || "",
    sku: d.sku || "",
    barcode: d.barcode || "",
    categoryId: d.categoryId || "",
    categoryName: d.categoryName || "Uncategorized",
    subCategory: d.subCategory || "",
    imageUrl: d.imageUrl || "",
    hasVariations: Boolean(d.hasVariations),
    price: d.price ?? d.minPrice ?? 0,
    minPrice: d.minPrice ?? d.price ?? 0,
    maxPrice: d.maxPrice ?? d.price ?? 0,
    stock: d.stock ?? d.totalStock ?? 0,
    totalStock: d.totalStock ?? d.stock ?? 0,
    bufferStock: d.bufferStock ?? 0,
    isDiscountAvailable: Boolean(d.isDiscountAvailable),
    discountType: d.discountType || "PERCENTAGE",
    discountValue: d.discountValue ?? 0,
    createdAt: d.createdAt || 0,
    variationTypes: d.variationTypes || [],
    variants: Array.isArray(d.variants)
      ? d.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          attributes: v.attributes || {},
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0,
          bufferStock: Number(v.bufferStock) || 0,
          barcode: v.barcode || "",
          sku: v.sku || "",
          isDiscountAvailable: Boolean(v.isDiscountAvailable),
          discountType: v.discountType || "PERCENTAGE",
          discountValue: Number(v.discountValue) || 0,
        }))
      : undefined,
  };
}

// GET: Fetch products for the active store with direct indexing, lightweight documents, and pagination
export async function GET(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productsRef = collection(db, "products");

    // 0. Single Product Direct Fetch (Lightweight vs Full detail)
    const singleId = searchParams.get("id");
    if (singleId) {
      const snap = await getDoc(doc(db, "products", singleId));
      if (!snap.exists() || snap.data().storeId !== ctx.storeId) {
        return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        product: { id: snap.id, ...snap.data() },
      });
    }

    // 1. Direct Barcode Lookup (Scanner optimization: 1 query read instead of scanning entire collection)
    const barcodeQuery = searchParams.get("barcode")?.trim().toLowerCase();
    if (barcodeQuery) {
      // Step A: Check main product barcode
      const mainSnap = await getDocs(
        query(
          productsRef,
          where("storeId", "==", ctx.storeId),
          where("barcode", "==", barcodeQuery),
          firestoreLimit(1)
        )
      );
      if (!mainSnap.empty) {
        const docItem = mainSnap.docs[0];
        return NextResponse.json({
          success: true,
          product: { id: docItem.id, ...docItem.data() },
          variant: null,
        });
      }

      // Step B: Check variant barcodes array
      const variantSnap = await getDocs(
        query(
          productsRef,
          where("storeId", "==", ctx.storeId),
          where("variantBarcodes", "array-contains", barcodeQuery),
          firestoreLimit(1)
        )
      );
      if (!variantSnap.empty) {
        const docItem = variantSnap.docs[0];
        const p: any = { id: docItem.id, ...docItem.data() };
        const v = p.variants?.find(
          (item: any) => String(item.barcode).trim().toLowerCase() === barcodeQuery
        );
        return NextResponse.json({ success: true, product: p, variant: v || null });
      }

      // Fallback: If legacy data didn't have variantBarcodes, do quick scan
      const legacySnap = await getDocs(
        query(productsRef, where("storeId", "==", ctx.storeId), where("hasVariations", "==", true), firestoreLimit(50))
      );

      for (const d of legacySnap.docs) {
        const p: any = { id: d.id, ...d.data() };
        if (Array.isArray(p.variants)) {
          const v = p.variants.find(
            (item: any) => String(item.barcode).trim().toLowerCase() === barcodeQuery
          );
          if (v) {
            return NextResponse.json({ success: true, product: p, variant: v });
          }
        }
      }

      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    // 2. Querying Products: Target specific category directly in Firestore query if provided
    const categoryId = searchParams.get("categoryId")?.trim();
    let q;
    if (categoryId && categoryId !== "ALL") {
      q = query(
        productsRef,
        where("storeId", "==", ctx.storeId),
        where("categoryId", "==", categoryId)
      );
    } else {
      q = query(productsRef, where("storeId", "==", ctx.storeId));
    }

    const snapshot = await getDocs(q);

    // Project lightweight product objects (Guideline #2)
    const isFull = searchParams.get("full") === "true";
    const allProducts = snapshot.docs.map((d) => {
      const data = d.data();
      return isFull ? { id: d.id, ...data } : toLightweightProduct({ id: d.id, ...data });
    });

    // Sort newest first
    allProducts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // 3. Search filter if query provided
    let filtered = allProducts;
    const search = searchParams.get("search")?.trim().toLowerCase();

    if (search) {
      filtered = filtered.filter((p: any) => {
        const nameMatch = p.name?.toLowerCase().includes(search);
        const barcodeMatch = p.barcode?.toLowerCase().includes(search);
        const skuMatch = p.sku?.toLowerCase().includes(search);
        const variantMatch =
          p.hasVariations &&
          Array.isArray(p.variants) &&
          p.variants.some(
            (v: any) =>
              v.name?.toLowerCase().includes(search) ||
              v.barcode?.toLowerCase().includes(search) ||
              v.sku?.toLowerCase().includes(search)
          );
        return nameMatch || barcodeMatch || skuMatch || variantMatch;
      });
    }

    // 4. Return All (if explicitly requested)
    if (searchParams.get("all") === "true") {
      return NextResponse.json({
        success: true,
        products: filtered,
        pagination: {
          total: filtered.length,
          totalPages: 1,
          page: 1,
          limit: filtered.length,
          hasMore: false,
        },
      });
    }

    // 5. Default Pagination (default 30 products)
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 30;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      products: paginatedProducts,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
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
      isDiscountAvailable: Boolean(body.isDiscountAvailable),
      discountType: body.discountType === "RUPEES" ? "RUPEES" : "PERCENTAGE",
      discountValue: Math.max(0, Number(body.discountValue) || 0),
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
        isDiscountAvailable: v.isDiscountAvailable !== undefined ? Boolean(v.isDiscountAvailable) : Boolean(body.isDiscountAvailable),
        discountType: (v.discountType || body.discountType) === "RUPEES" ? "RUPEES" : "PERCENTAGE",
        discountValue: v.discountValue !== undefined ? Math.max(0, Number(v.discountValue) || 0) : Math.max(0, Number(body.discountValue) || 0),
      }));

      // Calculate total stock and lowest price for quick table view
      productData.totalStock = productData.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      productData.minPrice = Math.min(...productData.variants.map((v: any) => v.price));
      productData.maxPrice = Math.max(...productData.variants.map((v: any) => v.price));
      productData.variantBarcodes = productData.variants
        .map((v: any) => String(v.barcode || "").trim().toLowerCase())
        .filter(Boolean);
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
      productData.variantBarcodes = [];
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
      isDiscountAvailable: Boolean(body.isDiscountAvailable),
      discountType: body.discountType === "RUPEES" ? "RUPEES" : "PERCENTAGE",
      discountValue: Math.max(0, Number(body.discountValue) || 0),
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
        stock: v.stock !== undefined ? Number(v.stock) || 0 : (existingSnap.data().variants?.[index]?.stock || 0),
        bufferStock: Number(v.bufferStock) || 0,
        barcode: String(v.barcode || Math.floor(100000000000 + Math.random() * 900000000000)),
        sku: String(v.sku || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`),
        isDiscountAvailable: v.isDiscountAvailable !== undefined ? Boolean(v.isDiscountAvailable) : Boolean(body.isDiscountAvailable),
        discountType: (v.discountType || body.discountType) === "RUPEES" ? "RUPEES" : "PERCENTAGE",
        discountValue: v.discountValue !== undefined ? Math.max(0, Number(v.discountValue) || 0) : Math.max(0, Number(body.discountValue) || 0),
      }));
      updateData.totalStock = updateData.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      updateData.minPrice = Math.min(...updateData.variants.map((v: any) => v.price));
      updateData.maxPrice = Math.max(...updateData.variants.map((v: any) => v.price));
      updateData.variantBarcodes = updateData.variants
        .map((v: any) => String(v.barcode || "").trim().toLowerCase())
        .filter(Boolean);
    } else {
      updateData.price = Number(body.price) || 0;
      updateData.stock = body.stock !== undefined ? Number(body.stock) || 0 : (existingSnap.data().stock ?? 0);
      updateData.bufferStock = Number(body.bufferStock) || 0;
      updateData.barcode = String(body.barcode || "");
      updateData.sku = String(body.sku || "");
      updateData.totalStock = updateData.stock;
      updateData.minPrice = updateData.price;
      updateData.maxPrice = updateData.price;
      updateData.variantBarcodes = [];
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
