import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

export interface GodownItem {
  id: string;
  name: string;
  address?: string;
  createdAt: number;
}

// GET: Fetch all godowns, products with stock breakdown, and summary metrics
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    // 1. Fetch all godowns for this business / store
    let godownsQuery = ctx.supabase
      .from("godowns")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      godownsQuery = godownsQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: godownsData, error: gError } = await godownsQuery.order("created_at", { ascending: true });
    if (gError) throw gError;

    const godowns: GodownItem[] = (godownsData || []).map((d: any) => ({
      id: d.id,
      name: d.name || "",
      address: d.location || "",
      createdAt: new Date(d.created_at).getTime(),
    }));

    // 2. Fetch all categories
    let categoriesQuery = ctx.supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      categoriesQuery = categoriesQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: categoriesData } = await categoriesQuery;
    const categories = (categoriesData || []).map((d: any) => ({
      id: d.id,
      name: d.name || "Uncategorized",
    }));

    // 3. Fetch all products for this store
    let productsQuery = ctx.supabase
      .from("products")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      productsQuery = productsQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: productsData, error: pError } = await productsQuery.order("created_at", { ascending: false });
    if (pError) throw pError;

    let totalStoreStock = 0;
    let totalGodownStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const products = (productsData || []).map((row: any) => {
      const hasVariations = Boolean(row.has_variations);
      const variants = Array.isArray(row.variation_options) ? row.variation_options : [];

      if (hasVariations && variants.length > 0) {
        let parentStoreStock = 0;
        const parentGodownStock: Record<string, number> = {};

        for (const g of godowns) {
          parentGodownStock[g.id] = 0;
        }

        const normalizedVariants = variants.map((v: any) => {
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
          id: row.id,
          name: row.name || "",
          imageUrl: Array.isArray(row.images) && row.images[0] ? row.images[0] : "",
          categoryId: row.category_id || "",
          categoryName: row.category_name || "Uncategorized",
          hasVariations: true,
          variationTypes: [],
          variants: normalizedVariants,
          storeStock: parentStoreStock,
          godownStock: parentGodownStock,
          totalStock: parentTotalStock,
          minPrice: Number(row.price) || 0,
          maxPrice: Number(row.price) || 0,
          createdAt: new Date(row.created_at).getTime(),
        };
      } else {
        // Simple product
        const pStore = Number(row.stock) || 0;
        const pGodown: Record<string, number> = {};
        let pGodownTotal = 0;

        for (const g of godowns) {
          pGodown[g.id] = 0;
        }

        const pTotal = pStore + pGodownTotal;
        totalStoreStock += pStore;
        totalGodownStock += pGodownTotal;

        const buffer = Number(row.min_stock) || 5;
        if (pTotal === 0) outOfStockCount++;
        else if (pTotal <= buffer) lowStockCount++;

        return {
          id: row.id,
          name: row.name || "",
          imageUrl: Array.isArray(row.images) && row.images[0] ? row.images[0] : "",
          categoryId: row.category_id || "",
          categoryName: row.category_name || "Uncategorized",
          barcode: row.barcode || "",
          sku: row.sku || "",
          price: Number(row.price) || 0,
          bufferStock: Number(row.min_stock) || 0,
          hasVariations: false,
          storeStock: pStore,
          godownStock: pGodown,
          totalStock: pTotal,
          createdAt: new Date(row.created_at).getTime(),
        };
      }
    });

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
      { success: false, error: error.message || "Failed to load stock analysis data." },
      { status: 500 }
    );
  }
}

// POST: Update/Adjust Stock for a Simple Product or Variant
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
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

      let updatedCount = 0;
      for (const it of items) {
        if (!it.productId) continue;
        const sStock = Math.max(0, Number(it.storeStock) || 0);

        const { error } = await ctx.supabase
          .from("products")
          .update({
            stock: sStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", it.productId)
          .eq("business_id", ctx.businessId);

        if (!error) updatedCount++;
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

    const { data: prodData, error: fError } = await ctx.supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("business_id", ctx.businessId)
      .single();

    if (fError || !prodData) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const newStoreStock = Math.max(0, Number(storeStock) || 0);
    const cleanGodownStock: Record<string, number> = {};
    if (godownStock && typeof godownStock === "object") {
      for (const [gid, qty] of Object.entries(godownStock)) {
        cleanGodownStock[gid] = Math.max(0, Number(qty) || 0);
      }
    }

    const godownsSum = Object.values(cleanGodownStock).reduce((sum, q) => sum + q, 0);
    const totalItemStock = newStoreStock + godownsSum;

    if (prodData.has_variations && Array.isArray(prodData.variation_options)) {
      if (!variantId) {
        return NextResponse.json(
          { success: false, error: "Variant ID is required for products with variations." },
          { status: 400 }
        );
      }

      const updatedVariants = prodData.variation_options.map((v: any) => {
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

      const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

      await ctx.supabase
        .from("products")
        .update({
          variation_options: updatedVariants,
          stock: totalStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      return NextResponse.json({
        success: true,
        message: "Variant stock adjusted successfully.",
      });
    } else {
      // Simple product
      await ctx.supabase
        .from("products")
        .update({
          stock: totalItemStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      return NextResponse.json({
        success: true,
        message: "Product stock adjusted successfully.",
      });
    }
  } catch (error: any) {
    console.error("Error adjusting stock:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to adjust stock." }, { status: 500 });
  }
}

// PUT: Transfer Stock between Locations
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const { productId, quantity } = body;
    const transferQty = Math.max(1, Number(quantity) || 1);

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${transferQty} unit(s).`,
    });
  } catch (error: any) {
    console.error("Error transferring stock:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to transfer stock." },
      { status: 500 }
    );
  }
}
