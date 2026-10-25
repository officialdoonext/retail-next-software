import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// Default product image when no image is provided in the Excel sheet
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80";

function generate13DigitNumericBarcode(): string {
  const prefix = "890";
  const middle = Math.floor(100000000 + Math.random() * 900000000).toString();
  const suffix = Math.floor(10 + Math.random() * 90).toString();
  return `${prefix}${middle}${suffix}`;
}

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
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

    // 1. Fetch existing categories from Supabase for this business
    const { data: existingCats } = await ctx.supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", ctx.businessId);

    const categoryMap = new Map<string, string>();
    (existingCats || []).forEach((c: any) => {
      if (c.name) categoryMap.set(c.name.trim().toLowerCase(), c.id);
    });

    const newCategoriesToCreate = new Set<string>();
    rawProducts.forEach((p) => {
      const catName = String(p.category || p.Category || "").trim();
      if (catName && !categoryMap.has(catName.toLowerCase())) {
        newCategoriesToCreate.add(catName);
      }
    });

    for (const catName of newCategoriesToCreate) {
      const { data: newCat } = await ctx.supabase
        .from("categories")
        .insert([
          {
            business_id: ctx.businessId,
            store_id: ctx.storeId || null,
            name: catName,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (newCat) {
        categoryMap.set(catName.toLowerCase(), newCat.id);
      }
    }

    // 2. Fetch existing variations from Supabase for this business
    const { data: existingVars } = await ctx.supabase
      .from("variations")
      .select("id, name")
      .eq("business_id", ctx.businessId);

    const variationSet = new Set<string>();
    (existingVars || []).forEach((v: any) => {
      if (v.name) variationSet.add(v.name.trim().toLowerCase());
    });

    const newVariationsToCreate = new Set<string>();
    rawProducts.forEach((p) => {
      const v1 = p["Variation 1 Name"] || p.variation1Name || p.variationType || p["Variation Type"];
      const v2 = p["Variation 2 Name"] || p.variation2Name;
      if (v1 && !variationSet.has(String(v1).trim().toLowerCase())) {
        newVariationsToCreate.add(String(v1).trim());
      }
      if (v2 && !variationSet.has(String(v2).trim().toLowerCase())) {
        newVariationsToCreate.add(String(v2).trim());
      }
    });

    for (const varName of newVariationsToCreate) {
      const { data: newV } = await ctx.supabase
        .from("variations")
        .insert([
          {
            business_id: ctx.businessId,
            store_id: ctx.storeId || null,
            name: varName,
            values: [],
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (newV) {
        variationSet.add(varName.toLowerCase());
      }
    }

    // 3. Group products by Product Name & Category
    interface NormalizedItem {
      name: string;
      catName: string;
      productType: "Simple" | "Variation";
      listPrice: number;
      salesPrice: number;
      stock: number;
      shortCode: string;
      sku: string;
      description: string;
      barcode: string;
      imageUrl: string;
      attributes: Record<string, string>;
    }

    const groupedProducts = new Map<string, NormalizedItem[]>();

    rawProducts.forEach((p, idx) => {
      const name = String(p.name || p["Product Name"] || "").trim();
      if (!name) return;

      const catName = String(p.category || p.Category || "Uncategorized").trim();
      const rawProductType = String(p.productType || p["Product Type"] || "").trim().toLowerCase();

      const listPrice = Math.max(
        0,
        Number(p["List Price"] || p.listPrice || p["MRP"] || p.mrp || p["Sales Price"] || p.salesPrice || p.price || p.Price) || 0
      );
      const salesPrice = Math.max(
        0,
        Number(p["Sales Price"] || p.salesPrice || p.price || p.Price || p["List Price"] || p.listPrice) || 0
      );
      const stock = Math.max(0, Number(p.stock || p.Stock) || 0);
      const shortCode = String(p.shortCode || p.Shortcode || p["Short Code"] || "").trim();
      const sku = String(p.sku || p.SKU || `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`).trim();
      const description = String(p.description || p.Description || "").trim();

      // Clean numeric only barcode
      let barcode = String(p.barcode || p.Barcode || "").replace(/\D/g, "");
      if (!barcode) {
        barcode = generate13DigitNumericBarcode();
      }

      // Default Image fallback rule: if no image provided, assign DEFAULT_PRODUCT_IMAGE
      const rawImage = String(p.imageUrl || p["Image URL"] || "").trim();
      const imageUrl = rawImage || DEFAULT_PRODUCT_IMAGE;

      // Extract variation attributes
      const attributes: Record<string, string> = {};
      const v1Name = String(p["Variation 1 Name"] || p.variation1Name || p["Variation 1 (Color)"] || p["Variation Type"] || "").trim();
      const v1Val = String(p["Variation 1 Value"] || p.variation1Value || p["Color"] || p["Variation Value"] || "").trim();
      const v2Name = String(p["Variation 2 Name"] || p.variation2Name || p["Variation 2 (Size)"] || "").trim();
      const v2Val = String(p["Variation 2 Value"] || p.variation2Value || p["Size"] || "").trim();

      if (v1Name && v1Val) attributes[v1Name] = v1Val;
      if (v2Name && v2Val) attributes[v2Name] = v2Val;

      const hasVarAttrs = Object.keys(attributes).length > 0;
      const isVariation = rawProductType === "variation" || hasVarAttrs;
      const productType: "Simple" | "Variation" = isVariation ? "Variation" : "Simple";

      const key = `${name.toLowerCase()}:::${catName.toLowerCase()}`;
      if (!groupedProducts.has(key)) {
        groupedProducts.set(key, []);
      }
      groupedProducts.get(key)!.push({
        name,
        catName,
        productType,
        listPrice,
        salesPrice,
        stock,
        shortCode,
        sku,
        description,
        barcode,
        imageUrl,
        attributes,
      });
    });

    // Fetch stores & warehouses for active business to distribute inventory
    const [storesRes, warehousesRes] = await Promise.all([
      ctx.supabase.from("stores").select("id, name").eq("business_id", ctx.businessId),
      ctx.supabase.from("warehouses").select("id, name").eq("business_id", ctx.businessId),
    ]);
    const businessStores: { id: string; name: string }[] = storesRes.data || [];
    const businessWarehouses: { id: string; name: string }[] = warehousesRes.data || [];

    function allocateStockToLocations(totalStock: number) {
      const storeStocks: { storeId: string; storeName: string; stock: number }[] = [];
      const whStocks: { warehouseId: string; warehouseName: string; stock: number }[] = [];

      if (totalStock <= 0 || (businessStores.length === 0 && businessWarehouses.length === 0)) {
        businessStores.forEach((s) => storeStocks.push({ storeId: s.id, storeName: s.name, stock: 0 }));
        businessWarehouses.forEach((w) => whStocks.push({ warehouseId: w.id, warehouseName: w.name, stock: 0 }));
        return { stores: storeStocks, warehouses: whStocks };
      }

      const allLocs: { type: "store" | "warehouse"; id: string; name: string; weight: number }[] = [];
      businessStores.forEach((s, idx) => {
        const weight = idx === 0 ? 0.4 : 0.2 / Math.max(1, businessStores.length - 1);
        allLocs.push({ type: "store", id: s.id, name: s.name, weight });
      });
      businessWarehouses.forEach((w, idx) => {
        const weight = idx === 0 ? 0.25 : 0.15 / Math.max(1, businessWarehouses.length - 1);
        allLocs.push({ type: "warehouse", id: w.id, name: w.name, weight });
      });

      const totalWeight = allLocs.reduce((sum, l) => sum + l.weight, 0);
      let allocatedSum = 0;

      allLocs.forEach((l, idx) => {
        if (idx === allLocs.length - 1) {
          const finalStock = Math.max(0, totalStock - allocatedSum);
          if (l.type === "store") {
            storeStocks.push({ storeId: l.id, storeName: l.name, stock: finalStock });
          } else {
            whStocks.push({ warehouseId: l.id, warehouseName: l.name, stock: finalStock });
          }
        } else {
          const share = Math.floor((l.weight / totalWeight) * totalStock);
          allocatedSum += share;
          if (l.type === "store") {
            storeStocks.push({ storeId: l.id, storeName: l.name, stock: share });
          } else {
            whStocks.push({ warehouseId: l.id, warehouseName: l.name, stock: share });
          }
        }
      });

      return { stores: storeStocks, warehouses: whStocks };
    }

    // 4. Build product records for Supabase insert
    const productRows: any[] = [];
    let productIndex = 0;

    for (const [, items] of groupedProducts.entries()) {
      productIndex++;
      const first = items[0];
      const categoryId = categoryMap.get(first.catName.toLowerCase()) || null;
      const baseSku = first.sku || `SKU-${Date.now().toString().slice(-5)}-${productIndex}`;
      const imageUrl = first.imageUrl || DEFAULT_PRODUCT_IMAGE;

      const hasVariations = items.length > 1 || first.productType === "Variation";

      if (hasVariations) {
        // Collect variation attribute names
        const attrKeys = new Set<string>();
        items.forEach((it) => {
          Object.keys(it.attributes).forEach((k) => attrKeys.add(k));
        });
        const variationTypes = attrKeys.size > 0 ? Array.from(attrKeys) : ["Option"];

        const variants = items.map((it, vIdx) => {
          const vBarcode = it.barcode || generate13DigitNumericBarcode();
          const vSku = `${baseSku}-${vIdx + 1}`;
          const variantName = Object.values(it.attributes).join(" / ") || `Variant ${vIdx + 1}`;

          return {
            id: `var-${Date.now()}-${productIndex}-${vIdx + 1}`,
            name: variantName,
            attributes:
              Object.keys(it.attributes).length > 0
                ? it.attributes
                : { [variationTypes[0]]: variantName },
            shortCode: it.shortCode,
            sku: vSku,
            barcode: vBarcode,
            listPrice: it.listPrice,
            salesPrice: it.salesPrice,
            price: it.salesPrice,
            mrp: it.listPrice,
            stock: it.stock,
            locationStocks: allocateStockToLocations(it.stock),
          };
        });

        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
        const salesPrices = variants.map((v) => v.salesPrice);
        const listPrices = variants.map((v) => v.listPrice);
        const minSalesPrice = Math.min(...salesPrices);
        const minListPrice = Math.min(...listPrices);

        productRows.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          name: first.name,
          category_id: categoryId,
          category_name: first.catName,
          price: minSalesPrice,
          mrp: minListPrice,
          stock: totalStock,
          barcode: variants[0]?.barcode || generate13DigitNumericBarcode(),
          sku: baseSku,
          images: [imageUrl],
          has_variations: true,
          variation_options: {
            description: first.description,
            shortCode: first.shortCode,
            imageUrl,
            hasVariations: true,
            variationTypes,
            variants,
            totalStock,
            minPrice: minSalesPrice,
            listPrice: minListPrice,
            salesPrice: minSalesPrice,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        const barcode = first.barcode || generate13DigitNumericBarcode();
        productRows.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          name: first.name,
          category_id: categoryId,
          category_name: first.catName,
          price: first.salesPrice,
          mrp: first.listPrice,
          stock: first.stock,
          barcode,
          sku: baseSku,
          images: [imageUrl],
          has_variations: false,
          variation_options: {
            description: first.description,
            shortCode: first.shortCode,
            imageUrl,
            hasVariations: false,
            totalStock: first.stock,
            minPrice: first.salesPrice,
            listPrice: first.listPrice,
            salesPrice: first.salesPrice,
            locationStocks: allocateStockToLocations(first.stock),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 5. Insert rows in Supabase in chunks of 50
    const chunkSize = 50;
    let savedCount = 0;

    for (let i = 0; i < productRows.length; i += chunkSize) {
      const chunk = productRows.slice(i, i + chunkSize);
      const { error: insertErr } = await ctx.supabase
        .from("products")
        .insert(chunk);

      if (insertErr) {
        console.error("Bulk insert chunk error:", insertErr);
      } else {
        savedCount += chunk.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${savedCount} master products into your catalog!`,
      importedCount: savedCount,
      totalRows: rawProducts.length,
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process bulk upload." },
      { status: 500 }
    );
  }
}
