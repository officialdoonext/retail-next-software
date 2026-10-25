import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

function toProductViewModel(d: any) {
  const extra = typeof d.variation_options === "object" && d.variation_options ? d.variation_options : {};
  const hasVariations = Boolean(d.has_variations);
  const variants = Array.isArray(extra.variants) ? extra.variants : [];

  const listPrice = Number(extra.listPrice || d.mrp || d.price) || 0;
  const salesPrice = Number(extra.salesPrice || d.price) || 0;

  return {
    id: d.id,
    name: d.name || "",
    description: extra.description || d.description || "",
    shortCode: extra.shortCode || d.short_code || "",
    sku: d.sku || extra.sku || "",
    barcode: String(d.barcode || extra.barcode || "").replace(/\D/g, ""),
    categoryId: d.category_id || extra.categoryId || "",
    categoryName: d.category_name || extra.categoryName || "Uncategorized",
    imageUrl: (Array.isArray(d.images) && d.images[0]) || extra.imageUrl || "",
    images: Array.isArray(d.images) ? d.images : extra.imageUrl ? [extra.imageUrl] : [],
    hasVariations,
    listPrice,
    salesPrice,
    price: salesPrice,
    mrp: listPrice,
    stock: Number(d.stock) || Number(extra.totalStock) || 0,
    minStock: Number(d.min_stock) || Number(extra.bufferStock) || 0,
    locationStocks: extra.locationStocks || { stores: [], warehouses: [] },
    variationTypes: extra.variationTypes || [],
    variants: variants.map((v: any, index: number) => ({
      id: v.id || `var_${index + 1}`,
      name: v.name || `Variant ${index + 1}`,
      attributes: v.attributes || {},
      shortCode: v.shortCode || "",
      sku: v.sku || "",
      barcode: String(v.barcode || "").replace(/\D/g, ""),
      listPrice: Number(v.listPrice || v.mrp || v.price) || 0,
      salesPrice: Number(v.salesPrice || v.price) || 0,
      price: Number(v.salesPrice || v.price) || 0,
      stock: Number(v.stock) || 0,
      locationStocks: v.locationStocks || { stores: [], warehouses: [] },
    })),
    createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
  };
}

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const body = await request.json();
    const { productId, variantId, locationType, locationId, locationName, action, quantity, reason } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    if (!locationType || (locationType !== "store" && locationType !== "warehouse")) {
      return NextResponse.json({ success: false, error: "Invalid location type. Must be 'store' or 'warehouse'." }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ success: false, error: "Location ID is required." }, { status: 400 });
    }

    const numQty = Math.max(0, parseInt(String(quantity), 10) || 0);

    // Fetch existing product
    const { data: product, error: fetchErr } = await ctx.supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("business_id", ctx.businessId)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const hasVariations = Boolean(product.has_variations);
    let variationOptions = typeof product.variation_options === "object" && product.variation_options ? { ...product.variation_options } : {};
    let newProductTotalStock = 0;

    if (hasVariations) {
      const rawVariants = Array.isArray(variationOptions.variants) ? [...variationOptions.variants] : [];
      let foundVariant = false;

      variationOptions.variants = rawVariants.map((v: any) => {
        if (v.id === variantId) {
          foundVariant = true;
          const locStocks = typeof v.locationStocks === "object" && v.locationStocks ? { ...v.locationStocks } : { stores: [], warehouses: [] };
          const targetArrayName = locationType === "store" ? "stores" : "warehouses";
          const idKey = locationType === "store" ? "storeId" : "warehouseId";
          const nameKey = locationType === "store" ? "storeName" : "warehouseName";

          let list = Array.isArray(locStocks[targetArrayName]) ? [...locStocks[targetArrayName]] : [];
          const existingIdx = list.findIndex((loc: any) => loc[idKey] === locationId);

          let currentVal = 0;
          if (existingIdx >= 0) {
            currentVal = Number(list[existingIdx].stock) || 0;
          }

          let updatedVal = currentVal;
          if (action === "add") {
            updatedVal = currentVal + numQty;
          } else if (action === "decrease") {
            updatedVal = Math.max(0, currentVal - numQty);
          } else if (action === "set") {
            updatedVal = numQty;
          }

          if (existingIdx >= 0) {
            list[existingIdx] = {
              ...list[existingIdx],
              [nameKey]: locationName || list[existingIdx][nameKey] || "Location",
              stock: updatedVal,
            };
          } else {
            list.push({
              [idKey]: locationId,
              [nameKey]: locationName || "Location",
              stock: updatedVal,
            });
          }

          locStocks[targetArrayName] = list;

          // Recompute this variant's total stock
          const sumStores = (locStocks.stores || []).reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0);
          const sumWh = (locStocks.warehouses || []).reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0);
          const vTotal = sumStores + sumWh;

          return {
            ...v,
            locationStocks: locStocks,
            stock: vTotal,
          };
        }
        return v;
      });

      if (!foundVariant && variantId) {
        return NextResponse.json({ success: false, error: "Variant not found for this product." }, { status: 404 });
      }

      // Recompute master product total stock
      newProductTotalStock = variationOptions.variants.reduce((acc: number, curr: any) => acc + (Number(curr.stock) || 0), 0);
      variationOptions.totalStock = newProductTotalStock;
    } else {
      // Simple Product
      const locStocks = typeof variationOptions.locationStocks === "object" && variationOptions.locationStocks ? { ...variationOptions.locationStocks } : { stores: [], warehouses: [] };
      const targetArrayName = locationType === "store" ? "stores" : "warehouses";
      const idKey = locationType === "store" ? "storeId" : "warehouseId";
      const nameKey = locationType === "store" ? "storeName" : "warehouseName";

      let list = Array.isArray(locStocks[targetArrayName]) ? [...locStocks[targetArrayName]] : [];
      const existingIdx = list.findIndex((loc: any) => loc[idKey] === locationId);

      let currentVal = 0;
      if (existingIdx >= 0) {
        currentVal = Number(list[existingIdx].stock) || 0;
      }

      let updatedVal = currentVal;
      if (action === "add") {
        updatedVal = currentVal + numQty;
      } else if (action === "decrease") {
        updatedVal = Math.max(0, currentVal - numQty);
      } else if (action === "set") {
        updatedVal = numQty;
      }

      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          [nameKey]: locationName || list[existingIdx][nameKey] || "Location",
          stock: updatedVal,
        };
      } else {
        list.push({
          [idKey]: locationId,
          [nameKey]: locationName || "Location",
          stock: updatedVal,
        });
      }

      locStocks[targetArrayName] = list;

      const sumStores = (locStocks.stores || []).reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0);
      const sumWh = (locStocks.warehouses || []).reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0);
      newProductTotalStock = sumStores + sumWh;

      variationOptions.locationStocks = locStocks;
      variationOptions.stock = newProductTotalStock;
      variationOptions.totalStock = newProductTotalStock;
    }

    // Save updated product to Supabase
    const { data: updatedProduct, error: updateErr } = await ctx.supabase
      .from("products")
      .update({
        stock: newProductTotalStock,
        variation_options: variationOptions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (updateErr) {
      console.error("Error updating stock in Supabase:", updateErr);
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Stock successfully updated (${action === "add" ? `+${numQty}` : action === "decrease" ? `-${numQty}` : `set to ${numQty}`}).`,
      product: toProductViewModel(updatedProduct),
      reason: reason || null,
    });
  } catch (err: any) {
    console.error("Stock adjustment error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
