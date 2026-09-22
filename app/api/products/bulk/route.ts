import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc, addDoc } from "firebase/firestore";

const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

function generate12DigitBarcode(): string {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

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
    const rawProducts = body.products;

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No products data provided for bulk upload." },
        { status: 400 }
      );
    }

    // 1. Fetch existing categories for the active store to map or auto-create
    const categoriesRef = collection(db, "categories");
    const catQuery = query(categoriesRef, where("storeId", "==", ctx.storeId));
    const catSnap = await getDocs(catQuery);

    const categoryMap = new Map<string, string>(); // Name (lowercase) -> ID
    catSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.name) {
        categoryMap.set(data.name.trim().toLowerCase(), docSnap.id);
      }
    });

    // Find any new category names in the upload list that don't exist yet
    const newCategoriesToCreate = new Set<string>();
    rawProducts.forEach((p) => {
      const catName = String(p.category || p.Category || "").trim();
      if (catName && !categoryMap.has(catName.toLowerCase())) {
        newCategoriesToCreate.add(catName);
      }
    });

    // Auto-create missing categories for this store
    let createdCategoriesCount = 0;
    for (const catName of newCategoriesToCreate) {
      const newCatDoc = await addDoc(collection(db, "categories"), {
        storeId: ctx.storeId,
        name: catName,
        createdAt: Date.now(),
      });
      categoryMap.set(catName.toLowerCase(), newCatDoc.id);
      createdCategoriesCount++;
    }

    // 2. Fetch existing variations for the active store to map or auto-create
    const variationsRef = collection(db, "variations");
    const varQuery = query(variationsRef, where("storeId", "==", ctx.storeId));
    const varSnap = await getDocs(varQuery);

    const variationSet = new Set<string>(); // Name (lowercase)
    varSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.name) {
        variationSet.add(data.name.trim().toLowerCase());
      }
    });

    // Find any new variation type names in the upload list that don't exist yet
    const newVariationsToCreate = new Set<string>();
    rawProducts.forEach((p) => {
      const vType = String(
        p.variationType ||
        p["Variation Type"] ||
        p.variation ||
        p["Variation"] ||
        p.variationName ||
        p["Variation Name"] ||
        ""
      ).trim();
      if (vType && !variationSet.has(vType.toLowerCase())) {
        newVariationsToCreate.add(vType);
      }
    });

    // Auto-create missing variations for this store
    let createdVariationsCount = 0;
    for (const varName of newVariationsToCreate) {
      await addDoc(collection(db, "variations"), {
        name: varName,
        storeId: ctx.storeId,
        createdBy: ctx.session.email,
        createdAt: Date.now(),
      });
      variationSet.add(varName.toLowerCase());
      createdVariationsCount++;
    }

    // 3. Group products by Product Name & Category
    interface NormalizedItem {
      name: string;
      catName: string;
      price: number;
      stock: number;
      bufferStock: number;
      description: string;
      barcode: string;
      imageUrl: string;
      variationType: string;
      variationValue: string;
    }

    const groupedProducts = new Map<string, NormalizedItem[]>();

    rawProducts.forEach((p) => {
      const name = String(p.name || p["Product Name"] || "").trim();
      if (!name) return;

      const catName = String(p.category || p.Category || "Uncategorized").trim();
      const price = Math.max(0, Number(p.price || p.Price) || 0);
      const stock = Math.max(0, Number(p.stock || p.Stock) || 0);
      const bufferStock = Math.max(0, Number(p.bufferStock || p["Buffer Stock"]) || 0);
      const description = String(p.description || p.Description || "").trim();
      const barcode = String(p.barcode || p.Barcode || "").trim();
      const imageUrl = String(p.imageUrl || p["Image URL"] || "").trim();
      const variationType = String(
        p.variationType ||
        p["Variation Type"] ||
        p.variation ||
        p["Variation"] ||
        ""
      ).trim();
      const variationValue = String(
        p.variationValue ||
        p["Variation Value"] ||
        p.value ||
        p["Value"] ||
        ""
      ).trim();

      const key = `${name.toLowerCase()}:::${catName.toLowerCase()}`;
      if (!groupedProducts.has(key)) {
        groupedProducts.set(key, []);
      }
      groupedProducts.get(key)!.push({
        name,
        catName,
        price,
        stock,
        bufferStock,
        description,
        barcode,
        imageUrl,
        variationType,
        variationValue,
      });
    });

    // 4. Build product documents (Simple or Multi-Variant)
    const productDocs: any[] = [];
    let productIndex = 0;

    for (const [, items] of groupedProducts.entries()) {
      productIndex++;
      const first = items[0];
      const categoryId = categoryMap.get(first.catName.toLowerCase()) || "";
      const baseSku = `SKU-${Date.now().toString().slice(-5)}-${productIndex}`;
      const imageUrl = first.imageUrl || DEFAULT_PRODUCT_IMAGE;

      // Check if product has variations
      const hasVariations = items.length > 1 || items.some((it) => it.variationValue !== "");

      if (hasVariations) {
        const varTypeSet = new Set<string>();
        items.forEach((it) => {
          if (it.variationType) varTypeSet.add(it.variationType);
        });
        const variationTypes = varTypeSet.size > 0 ? Array.from(varTypeSet) : ["Option"];

        const variants = items.map((it, vIdx) => {
          const vType = it.variationType || variationTypes[0] || "Option";
          const vVal = it.variationValue || `Option ${vIdx + 1}`;
          const vBarcode = it.barcode || generate12DigitBarcode();
          const vSku = `${baseSku}-${vIdx + 1}`;

          return {
            id: `var-${Date.now()}-${productIndex}-${vIdx + 1}`,
            name: `${vType}: ${vVal}`,
            attributes: { [vType]: vVal },
            price: it.price,
            stock: it.stock,
            bufferStock: it.bufferStock,
            barcode: vBarcode,
            sku: vSku,
          };
        });

        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
        const prices = variants.map((v) => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        productDocs.push({
          storeId: ctx.storeId,
          name: first.name,
          categoryId,
          categoryName: first.catName,
          description: first.description,
          imageUrl,
          hasVariations: true,
          variationTypes,
          variants,
          totalStock,
          minPrice,
          maxPrice,
          price: minPrice,
          stock: totalStock,
          bufferStock: variants[0]?.bufferStock || 0,
          barcode: variants[0]?.barcode || generate12DigitBarcode(),
          sku: baseSku,
          createdAt: Date.now() + productIndex,
        });
      } else {
        const barcode = first.barcode || generate12DigitBarcode();
        productDocs.push({
          storeId: ctx.storeId,
          name: first.name,
          categoryId,
          categoryName: first.catName,
          price: first.price,
          stock: first.stock,
          bufferStock: first.bufferStock,
          barcode,
          sku: baseSku,
          description: first.description,
          imageUrl,
          hasVariations: false,
          totalStock: first.stock,
          minPrice: first.price,
          maxPrice: first.price,
          createdAt: Date.now() + productIndex,
        });
      }
    }

    // 5. Commit product documents in Firestore batches (max 400 per batch)
    const productsRef = collection(db, "products");
    const chunkSize = 400;
    let savedCount = 0;

    for (let i = 0; i < productDocs.length; i += chunkSize) {
      const chunk = productDocs.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((pDoc) => {
        const newDocRef = doc(productsRef);
        batch.set(newDocRef, pDoc);
        savedCount++;
      });

      await batch.commit();
    }

    let message = `Successfully uploaded ${savedCount} products.`;
    if (createdCategoriesCount > 0 && createdVariationsCount > 0) {
      message = `Successfully uploaded ${savedCount} products. Created ${createdCategoriesCount} new categories and ${createdVariationsCount} new variations.`;
    } else if (createdCategoriesCount > 0) {
      message = `Successfully uploaded ${savedCount} products and created ${createdCategoriesCount} new categories.`;
    } else if (createdVariationsCount > 0) {
      message = `Successfully uploaded ${savedCount} products and created ${createdVariationsCount} new variations.`;
    }

    return NextResponse.json({
      success: true,
      count: savedCount,
      createdCategories: createdCategoriesCount,
      createdVariations: createdVariationsCount,
      message,
    });
  } catch (error) {
    console.error("Bulk product upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform bulk products upload." },
      { status: 500 }
    );
  }
}
