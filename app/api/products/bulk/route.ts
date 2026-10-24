import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80";

function generate12DigitBarcode(): string {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
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

    let createdCategoriesCount = 0;
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
        createdCategoriesCount++;
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
      const candidates = [
        p.variationType,
        p["Variation Type"],
        p.variation,
        p["Variation"],
        p.variationName,
        p["Variation Name"],
        p["Variation 1 (Color)"] ? "Color" : null,
        p["Variation 1"] ? "Color" : null,
        p["Variation 2 (Size)"] ? "Size" : null,
        p["Variation 2"] ? "Size" : null,
      ];
      candidates.forEach((c) => {
        if (!c) return;
        const vType = String(c).trim();
        if (vType && !variationSet.has(vType.toLowerCase())) {
          newVariationsToCreate.add(vType);
        }
      });
    });

    let createdVariationsCount = 0;
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
        createdVariationsCount++;
      }
    }

    // 3. Group products by Product Name & Category
    interface NormalizedItem {
      name: string;
      catName: string;
      subCategory: string;
      price: number;
      stock: number;
      bufferStock: number;
      description: string;
      barcode: string;
      imageUrl: string;
      variationType: string;
      variationValue: string;
      attributes: Record<string, string>;
      isDiscountAvailable?: boolean;
      discountType?: "PERCENTAGE" | "RUPEES";
      discountValue?: number;
    }

    const groupedProducts = new Map<string, NormalizedItem[]>();

    rawProducts.forEach((p) => {
      const name = String(p.name || p["Product Name"] || "").trim();
      if (!name) return;

      const catName = String(p.category || p.Category || "Uncategorized").trim();
      const subCategory = String(
        p.subCategory ||
        p["Sub Category"] ||
        p["Subcategory"] ||
        p["Sub-Category"] ||
        ""
      ).trim();

      const price = Math.max(0, Number(p.price || p.Price) || 0);
      const stock = Math.max(0, Number(p.stock || p.Stock) || 0);
      const bufferStock = Math.max(0, Number(p.bufferStock || p["Buffer Stock"]) || 0);
      const description = String(p.description || p.Description || "").trim();
      const barcode = String(p.barcode || p.Barcode || "").trim();
      const imageUrl = String(p.imageUrl || p["Image URL"] || "").trim();

      const var1Color = String(p["Variation 1 (Color)"] || p["Variation 1"] || p["Color"] || "").trim();
      const var2Size = String(p["Variation 2 (Size)"] || p["Variation 2"] || p["Size"] || "").trim();

      let variationType = String(p.variationType || p["Variation Type"] || p.variation || p["Variation"] || "").trim();
      let variationValue = String(p.variationValue || p["Variation Value"] || p.value || p["Value"] || "").trim();

      const attributes: Record<string, string> = {};

      if (var1Color || var2Size) {
        if (var1Color) attributes["Color"] = var1Color;
        if (var2Size) attributes["Size"] = var2Size;

        if (var1Color && var2Size) {
          variationType = "Color / Size";
          variationValue = `${var1Color} / ${var2Size}`;
        } else if (var1Color) {
          variationType = "Color";
          variationValue = var1Color;
        } else if (var2Size) {
          variationType = "Size";
          variationValue = var2Size;
        }
      } else if (variationType && variationValue) {
        attributes[variationType] = variationValue;
      }

      const rawDiscAvail = String(p.isDiscountAvailable ?? p["Discount Available"] ?? p.discountAvailable ?? "").trim().toLowerCase();
      const isDiscountAvailable = rawDiscAvail === "yes" || rawDiscAvail === "true" || rawDiscAvail === "1";
      const rawDiscType = String(p.discountType ?? p["Discount Type"] ?? "").trim().toLowerCase();
      const discountType = rawDiscType.includes("rupee") || rawDiscType.includes("₹") ? "RUPEES" : "PERCENTAGE";
      const discountValue = Math.max(0, Number(p.discountValue ?? p["Discount Value"]) || 0);

      const key = `${name.toLowerCase()}:::${catName.toLowerCase()}`;
      if (!groupedProducts.has(key)) {
        groupedProducts.set(key, []);
      }
      groupedProducts.get(key)!.push({
        name,
        catName,
        subCategory,
        price,
        stock,
        bufferStock,
        description,
        barcode,
        imageUrl,
        variationType,
        variationValue,
        attributes,
        isDiscountAvailable,
        discountType,
        discountValue,
      });
    });

    // 4. Build product records for Supabase insert
    const productRows: any[] = [];
    let productIndex = 0;

    for (const [, items] of groupedProducts.entries()) {
      productIndex++;
      const first = items[0];
      const categoryId = categoryMap.get(first.catName.toLowerCase()) || null;
      const baseSku = `SKU-${Date.now().toString().slice(-5)}-${productIndex}`;
      const imageUrl = first.imageUrl || DEFAULT_PRODUCT_IMAGE;

      const hasVariations = items.length > 1 || items.some((it) => it.variationValue !== "");

      if (hasVariations) {
        const attrKeys = new Set<string>();
        items.forEach((it) => {
          Object.keys(it.attributes).forEach((k) => attrKeys.add(k));
          if (it.variationType && !it.variationType.includes("/")) {
            attrKeys.add(it.variationType);
          }
        });
        const variationTypes = attrKeys.size > 0 ? Array.from(attrKeys) : ["Option"];

        const variants = items.map((it, vIdx) => {
          const vBarcode = it.barcode || generate12DigitBarcode();
          const vSku = `${baseSku}-${vIdx + 1}`;
          const variantName = it.variationValue || `Option ${vIdx + 1}`;

          return {
            id: `var-${Date.now()}-${productIndex}-${vIdx + 1}`,
            name: variantName,
            attributes:
              Object.keys(it.attributes).length > 0
                ? it.attributes
                : { [variationTypes[0]]: variantName },
            price: it.price,
            stock: it.stock,
            bufferStock: it.bufferStock,
            barcode: vBarcode,
            sku: vSku,
            isDiscountAvailable: it.isDiscountAvailable,
            discountType: it.discountType,
            discountValue: it.discountValue,
          };
        });

        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
        const prices = variants.map((v) => v.price);
        const minPrice = Math.min(...prices);

        productRows.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          name: first.name,
          category_id: categoryId,
          category_name: first.catName,
          price: minPrice,
          stock: totalStock,
          min_stock: variants[0]?.bufferStock || 0,
          barcode: variants[0]?.barcode || generate12DigitBarcode(),
          sku: baseSku,
          images: [imageUrl],
          has_variations: true,
          variation_options: {
            subCategory: first.subCategory || "",
            description: first.description,
            imageUrl,
            hasVariations: true,
            variationTypes,
            variants,
            totalStock,
            minPrice,
            isDiscountAvailable: first.isDiscountAvailable,
            discountType: first.discountType,
            discountValue: first.discountValue,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        const barcode = first.barcode || generate12DigitBarcode();
        productRows.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          name: first.name,
          category_id: categoryId,
          category_name: first.catName,
          price: first.price,
          stock: first.stock,
          min_stock: first.bufferStock,
          barcode,
          sku: baseSku,
          images: [imageUrl],
          has_variations: false,
          variation_options: {
            subCategory: first.subCategory || "",
            description: first.description,
            imageUrl,
            hasVariations: false,
            totalStock: first.stock,
            minPrice: first.price,
            isDiscountAvailable: first.isDiscountAvailable,
            discountType: first.discountType,
            discountValue: first.discountValue,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 5. Insert rows in Supabase in chunks of 100
    const chunkSize = 100;
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
