import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

export interface GodownItem {
  id: string;
  name: string;
  address?: string;
  createdAt: number;
}

// GET: Fetch all godowns, products with stock breakdown, and summary metrics
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    // 1. Fetch all godowns for this store, sorted by createdAt ASC (1st Godown, 2nd Godown, etc.)
    const godownsSnap = await getDocs(
      query(collection(db, "godowns"), where("storeId", "==", ctx.storeId))
    );
    const godowns: GodownItem[] = godownsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "",
      address: d.data().address || "",
      createdAt: d.data().createdAt || 0,
    }));
    godowns.sort((a, b) => a.createdAt - b.createdAt);

    // 2. Fetch all categories
    const categoriesSnap = await getDocs(
      query(collection(db, "categories"), where("storeId", "==", ctx.storeId))
    );
    const categories = categoriesSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Uncategorized",
    }));

    // 3. Fetch all products for this store
    const productsSnap = await getDocs(
      query(collection(db, "products"), where("storeId", "==", ctx.storeId))
    );

    let totalStoreStock = 0;
    let totalGodownStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const products = productsSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      const hasVariations = Boolean(data.hasVariations);

      if (hasVariations && Array.isArray(data.variants)) {
        // Calculate each variant's stock breakdown
        let parentStoreStock = 0;
        const parentGodownStock: Record<string, number> = {};

        // Initialize godowns map with 0
        for (const g of godowns) {
          parentGodownStock[g.id] = 0;
        }

        const normalizedVariants = data.variants.map((v: any) => {
          const vStore = v.storeStock !== undefined ? Math.max(0, Number(v.storeStock) || 0) : Math.max(0, Number(v.stock) || 0);
          const vGodown: Record<string, number> = {};
          let vGodownTotal = 0;

          for (const g of godowns) {
            const qty = Math.max(0, Number(v.godownStock?.[g.id]) || 0);
            vGodown[g.id] = qty;
            vGodownTotal += qty;
            parentGodownStock[g.id] = (parentGodownStock[g.id] || 0) + qty;
          }

          const vTotal = vStore + vGodownTotal;
          parentStoreStock += vStore;

          const buffer = Number(v.bufferStock) || 5;
          if (vTotal === 0) outOfStockCount++;
          else if (vTotal <= buffer) lowStockCount++;

          return {
            ...v,
            storeStock: vStore,
            godownStock: vGodown,
            totalStock: vTotal,
          };
        });

        const parentGodownTotal = Object.values(parentGodownStock).reduce((s, q) => s + q, 0);
        const parentTotalStock = parentStoreStock + parentGodownTotal;

        totalStoreStock += parentStoreStock;
        totalGodownStock += parentGodownTotal;

        return {
          id: docSnap.id,
          name: data.name || "",
          imageUrl: data.imageUrl || "",
          categoryId: data.categoryId || "",
          categoryName: data.categoryName || "Uncategorized",
          hasVariations: true,
          variationTypes: data.variationTypes || [],
          variants: normalizedVariants,
          storeStock: parentStoreStock,
          godownStock: parentGodownStock,
          totalStock: parentTotalStock,
          minPrice: data.minPrice || 0,
          maxPrice: data.maxPrice || 0,
          createdAt: data.createdAt || 0,
        };
      } else {
        // Simple product
        const pStore = data.storeStock !== undefined ? Math.max(0, Number(data.storeStock) || 0) : Math.max(0, Number(data.stock) || 0);
        const pGodown: Record<string, number> = {};
        let pGodownTotal = 0;

        for (const g of godowns) {
          const qty = Math.max(0, Number(data.godownStock?.[g.id]) || 0);
          pGodown[g.id] = qty;
          pGodownTotal += qty;
        }

        const pTotal = pStore + pGodownTotal;
        totalStoreStock += pStore;
        totalGodownStock += pGodownTotal;

        const buffer = Number(data.bufferStock) || 5;
        if (pTotal === 0) outOfStockCount++;
        else if (pTotal <= buffer) lowStockCount++;

        return {
          id: docSnap.id,
          name: data.name || "",
          imageUrl: data.imageUrl || "",
          categoryId: data.categoryId || "",
          categoryName: data.categoryName || "Uncategorized",
          barcode: data.barcode || "",
          sku: data.sku || "",
          price: Number(data.price) || 0,
          bufferStock: Number(data.bufferStock) || 0,
          hasVariations: false,
          storeStock: pStore,
          godownStock: pGodown,
          totalStock: pTotal,
          createdAt: data.createdAt || 0,
        };
      }
    });

    // Sort products by newest first
    products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      success: true,
      godowns,
      products,
      categories,
      metrics: {
        totalProducts: products.length,
        totalStoreStock,
        totalGodownStock,
        totalCombinedStock: totalStoreStock + totalGodownStock,
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching stock analysis:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load stock analysis data." },
      { status: 500 }
    );
  }
}

// POST: Update/Adjust Stock for a Simple Product or Variant
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();

    // ── BULK UPDATE MODE ──
    if (Array.isArray(body.items)) {
      const items = body.items;
      if (items.length === 0) {
        return NextResponse.json({ success: false, error: "No items provided for bulk update." }, { status: 400 });
      }

      // Group updates by productId to avoid race conditions
      const itemsByProduct = new Map<string, any[]>();
      for (const it of items) {
        if (!it.productId) continue;
        const list = itemsByProduct.get(it.productId) || [];
        list.push(it);
        itemsByProduct.set(it.productId, list);
      }

      let updatedCount = 0;

      for (const [productId, productUpdates] of itemsByProduct.entries()) {
        try {
          const productRef = doc(db, "products", productId);
          const snap = await getDoc(productRef);
          if (!snap.exists()) continue;
          const prodData = snap.data();
          if (prodData.storeId !== ctx.storeId) continue;

          if (prodData.hasVariations && Array.isArray(prodData.variants)) {
            const updatedVariants = [...prodData.variants];

            for (const upd of productUpdates) {
              if (!upd.variantId) continue;
              const vIdx = updatedVariants.findIndex((v: any) => v.id === upd.variantId);
              if (vIdx !== -1) {
                const sStock = Math.max(0, Number(upd.storeStock) || 0);
                const gStock: Record<string, number> = {};
                if (upd.godownStock && typeof upd.godownStock === "object") {
                  for (const [gid, q] of Object.entries(upd.godownStock)) {
                    gStock[gid] = Math.max(0, Number(q) || 0);
                  }
                }
                const totalItem = sStock + Object.values(gStock).reduce((s, q) => s + q, 0);

                updatedVariants[vIdx] = {
                  ...updatedVariants[vIdx],
                  storeStock: sStock,
                  godownStock: gStock,
                  stock: totalItem,
                };
                updatedCount++;
              }
            }

            // Recalculate parent totals
            let pStore = 0;
            const pGodown: Record<string, number> = {};
            for (const v of updatedVariants) {
              pStore += Number(v.storeStock) || 0;
              if (v.godownStock) {
                for (const [gid, q] of Object.entries(v.godownStock)) {
                  pGodown[gid] = (pGodown[gid] || 0) + (Number(q) || 0);
                }
              }
            }
            const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

            await updateDoc(productRef, {
              variants: updatedVariants,
              storeStock: pStore,
              godownStock: pGodown,
              stock: totalStock,
              totalStock,
              updatedAt: Date.now(),
            });
          } else {
            // Simple product
            const upd = productUpdates[0];
            const sStock = Math.max(0, Number(upd.storeStock) || 0);
            const gStock: Record<string, number> = {};
            if (upd.godownStock && typeof upd.godownStock === "object") {
              for (const [gid, q] of Object.entries(upd.godownStock)) {
                gStock[gid] = Math.max(0, Number(q) || 0);
              }
            }
            const totalItem = sStock + Object.values(gStock).reduce((s, q) => s + q, 0);

            await updateDoc(productRef, {
              storeStock: sStock,
              godownStock: gStock,
              stock: totalItem,
              totalStock: totalItem,
              updatedAt: Date.now(),
            });
            updatedCount++;
          }
        } catch (err) {
          console.error(`Error bulk updating product ${productId}:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        count: updatedCount,
        message: `Successfully updated stock for ${updatedCount} item(s).`,
      });
    }

    // ── SINGLE ITEM UPDATE MODE ──
    const { productId, variantId, storeStock, godownStock } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const prodData = snap.data();
    if (prodData.storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Unauthorized access to product." }, { status: 403 });
    }

    // Clean numeric values
    const newStoreStock = Math.max(0, Number(storeStock) || 0);
    const cleanGodownStock: Record<string, number> = {};
    if (godownStock && typeof godownStock === "object") {
      for (const [gid, qty] of Object.entries(godownStock)) {
        cleanGodownStock[gid] = Math.max(0, Number(qty) || 0);
      }
    }

    const godownsSum = Object.values(cleanGodownStock).reduce((sum, q) => sum + q, 0);
    const totalItemStock = newStoreStock + godownsSum;

    if (prodData.hasVariations && Array.isArray(prodData.variants)) {
      if (!variantId) {
        return NextResponse.json(
          { success: false, error: "Variant ID is required for products with variations." },
          { status: 400 }
        );
      }

      const updatedVariants = prodData.variants.map((v: any) => {
        if (v.id === variantId) {
          return {
            ...v,
            storeStock: newStoreStock,
            godownStock: cleanGodownStock,
            stock: totalItemStock,
          };
        }
        return v;
      });

      // Recalculate parent aggregated totals
      let parentStoreStock = 0;
      const parentGodownStock: Record<string, number> = {};

      for (const v of updatedVariants) {
        const vStore = Number(v.storeStock) || 0;
        parentStoreStock += vStore;
        if (v.godownStock) {
          for (const [gid, q] of Object.entries(v.godownStock)) {
            parentGodownStock[gid] = (parentGodownStock[gid] || 0) + (Number(q) || 0);
          }
        }
      }

      const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

      await updateDoc(productRef, {
        variants: updatedVariants,
        storeStock: parentStoreStock,
        godownStock: parentGodownStock,
        totalStock,
        stock: totalStock,
        updatedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: "Variant stock adjusted successfully.",
      });
    } else {
      // Simple product
      await updateDoc(productRef, {
        storeStock: newStoreStock,
        godownStock: cleanGodownStock,
        stock: totalItemStock,
        totalStock: totalItemStock,
        updatedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: "Product stock adjusted successfully.",
      });
    }
  } catch (error: any) {
    console.error("Error adjusting stock:", error);
    return NextResponse.json({ success: false, error: "Failed to adjust stock." }, { status: 500 });
  }
}

// PUT: Transfer Stock between Locations (Store <-> Godown or Godown <-> Godown)
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const { productId, variantId, fromLocation, toLocation, quantity } = body;

    const transferQty = Math.max(1, Number(quantity) || 1);

    if (!productId || !fromLocation || !toLocation) {
      return NextResponse.json(
        { success: false, error: "Product, source, and destination locations are required." },
        { status: 400 }
      );
    }

    if (fromLocation === toLocation) {
      return NextResponse.json(
        { success: false, error: "Source and destination cannot be the same location." },
        { status: 400 }
      );
    }

    const productRef = doc(db, "products", productId);
    const snap = await getDoc(productRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const prodData = snap.data();
    if (prodData.storeId !== ctx.storeId) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
    }

    const executeTransfer = (currentStore: number, currentGodowns: Record<string, number>) => {
      let storeVal = currentStore;
      const godownsMap = { ...currentGodowns };

      // Check source availability
      if (fromLocation === "STORE") {
        if (storeVal < transferQty) {
          throw new Error(`Insufficient store shelf stock (Available: ${storeVal}).`);
        }
        storeVal -= transferQty;
      } else {
        const gQty = Number(godownsMap[fromLocation]) || 0;
        if (gQty < transferQty) {
          throw new Error(`Insufficient godown stock (Available: ${gQty}).`);
        }
        godownsMap[fromLocation] = gQty - transferQty;
      }

      // Add to destination
      if (toLocation === "STORE") {
        storeVal += transferQty;
      } else {
        const curD = Number(godownsMap[toLocation]) || 0;
        godownsMap[toLocation] = curD + transferQty;
      }

      const totalG = Object.values(godownsMap).reduce((s, q) => s + (Number(q) || 0), 0);
      const total = storeVal + totalG;

      return {
        storeStock: storeVal,
        godownStock: godownsMap,
        totalStock: total,
      };
    };

    if (prodData.hasVariations && Array.isArray(prodData.variants)) {
      if (!variantId) {
        return NextResponse.json(
          { success: false, error: "Variant ID is required for variation products." },
          { status: 400 }
        );
      }

      const updatedVariants = prodData.variants.map((v: any) => {
        if (v.id === variantId) {
          const vStore = v.storeStock !== undefined ? Number(v.storeStock) || 0 : Number(v.stock) || 0;
          const vGodown = v.godownStock || {};
          const transferred = executeTransfer(vStore, vGodown);

          return {
            ...v,
            storeStock: transferred.storeStock,
            godownStock: transferred.godownStock,
            stock: transferred.totalStock,
          };
        }
        return v;
      });

      // Recalculate parent
      let parentStore = 0;
      const parentGodown: Record<string, number> = {};
      for (const v of updatedVariants) {
        parentStore += Number(v.storeStock) || 0;
        if (v.godownStock) {
          for (const [gid, q] of Object.entries(v.godownStock)) {
            parentGodown[gid] = (parentGodown[gid] || 0) + (Number(q) || 0);
          }
        }
      }
      const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

      await updateDoc(productRef, {
        variants: updatedVariants,
        storeStock: parentStore,
        godownStock: parentGodown,
        totalStock,
        stock: totalStock,
        updatedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: `Successfully transferred ${transferQty} unit(s).`,
      });
    } else {
      // Simple product
      const pStore = prodData.storeStock !== undefined ? Number(prodData.storeStock) || 0 : Number(prodData.stock) || 0;
      const pGodown = prodData.godownStock || {};
      const transferred = executeTransfer(pStore, pGodown);

      await updateDoc(productRef, {
        storeStock: transferred.storeStock,
        godownStock: transferred.godownStock,
        stock: transferred.totalStock,
        totalStock: transferred.totalStock,
        updatedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: `Successfully transferred ${transferQty} unit(s).`,
      });
    }
  } catch (error: any) {
    console.error("Error transferring stock:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to transfer stock." },
      { status: 500 }
    );
  }
}
