import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// Helper to return lightweight product object
function toLightweightProduct(d: any) {
  const extra = typeof d.variation_options === "object" && d.variation_options ? d.variation_options : {};
  return {
    id: d.id,
    name: d.name || "",
    sku: d.sku || extra.sku || "",
    barcode: d.barcode || extra.barcode || "",
    categoryId: d.category_id || extra.categoryId || "",
    categoryName: d.category_name || extra.categoryName || "Uncategorized",
    subCategory: extra.subCategory || "",
    imageUrl: (Array.isArray(d.images) && d.images[0]) || extra.imageUrl || "",
    hasVariations: Boolean(d.has_variations),
    price: Number(d.price) || Number(extra.price) || 0,
    minPrice: Number(extra.minPrice) || Number(d.price) || 0,
    maxPrice: Number(extra.maxPrice) || Number(d.price) || 0,
    stock: Number(d.stock) || Number(extra.totalStock) || 0,
    totalStock: Number(extra.totalStock) || Number(d.stock) || 0,
    bufferStock: Number(d.min_stock) || Number(extra.bufferStock) || 0,
    isDiscountAvailable: Boolean(extra.isDiscountAvailable),
    discountType: extra.discountType || "PERCENTAGE",
    discountValue: Number(extra.discountValue) || 0,
    createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
    variationTypes: extra.variationTypes || [],
    variants: Array.isArray(extra.variants) ? extra.variants : undefined,
  };
}

// GET: Fetch products for the active business & store
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get("id");

    // 0. Single Product Direct Fetch
    if (singleId) {
      const { data: product, error } = await ctx.supabase
        .from("products")
        .select("*")
        .eq("id", singleId)
        .eq("business_id", ctx.businessId)
        .single();

      if (error || !product) {
        return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
      }

      const extra = typeof product.variation_options === "object" && product.variation_options ? product.variation_options : {};
      return NextResponse.json({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.category_id,
          categoryName: product.category_name,
          price: product.price,
          stock: product.stock,
          images: product.images,
          hasVariations: product.has_variations,
          ...extra,
        },
      });
    }

    // 1. Direct Barcode Lookup (Scanner optimization)
    const barcodeQuery = searchParams.get("barcode")?.trim().toLowerCase();
    if (barcodeQuery) {
      let bQuery = ctx.supabase
        .from("products")
        .select("*")
        .eq("business_id", ctx.businessId)
        .eq("barcode", barcodeQuery);

      if (ctx.storeId) {
        bQuery = bQuery.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
      }

      const { data: mainProduct } = await bQuery.limit(1);

      if (mainProduct && mainProduct.length > 0) {
        const item = mainProduct[0];
        const extra = typeof item.variation_options === "object" && item.variation_options ? item.variation_options : {};
        return NextResponse.json({
          success: true,
          product: { id: item.id, ...item, ...extra },
          variant: null,
        });
      }

      // Check variant barcodes inside variation_options
      const { data: variationProducts } = await ctx.supabase
        .from("products")
        .select("*")
        .eq("business_id", ctx.businessId)
        .eq("has_variations", true)
        .limit(100);

      if (variationProducts) {
        for (const item of variationProducts) {
          const extra = typeof item.variation_options === "object" && item.variation_options ? item.variation_options : {};
          if (Array.isArray(extra.variants)) {
            const v = extra.variants.find(
              (itemVar: any) => String(itemVar.barcode).trim().toLowerCase() === barcodeQuery
            );
            if (v) {
              return NextResponse.json({
                success: true,
                product: { id: item.id, ...item, ...extra },
                variant: v,
              });
            }
          }
        }
      }

      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    // 2. Querying Products
    let query = ctx.supabase
      .from("products")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const categoryId = searchParams.get("categoryId")?.trim();
    if (categoryId && categoryId !== "ALL") {
      query = query.eq("category_id", categoryId);
    }

    const { data: rawProducts, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const isFull = searchParams.get("full") === "true";
    let allProducts = (rawProducts || []).map((d: any) => {
      const extra = typeof d.variation_options === "object" && d.variation_options ? d.variation_options : {};
      return isFull ? { id: d.id, ...d, ...extra } : toLightweightProduct(d);
    });

    // Search filter
    const search = searchParams.get("search")?.trim().toLowerCase();
    if (search) {
      allProducts = allProducts.filter((p: any) => {
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

    // Return All if requested
    if (searchParams.get("all") === "true") {
      return NextResponse.json({
        success: true,
        products: allProducts,
        pagination: {
          total: allProducts.length,
          totalPages: 1,
          page: 1,
          limit: allProducts.length,
          hasMore: false,
        },
      });
    }

    // Pagination
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 30;

    const total = allProducts.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = allProducts.slice(startIndex, startIndex + limit);

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
    return NextResponse.json({ success: false, error: "Failed to retrieve products." }, { status: 500 });
  }
}

// POST: Add new product to Supabase
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    const hasVariations = Boolean(body.hasVariations);
    let price = Number(body.price) || 0;
    let stock = Number(body.stock) || 0;
    let minStock = Number(body.bufferStock || body.minStock) || 0;
    let barcode = String(body.barcode || Math.floor(100000000000 + Math.random() * 900000000000));
    let sku = String(body.sku || `SKU-${Date.now().toString().slice(-6)}`);

    const variationOptions: any = {
      description: String(body.description || "").trim(),
      subCategory: body.subCategory || "",
      imageUrl: body.imageUrl || "",
      isDiscountAvailable: Boolean(body.isDiscountAvailable),
      discountType: body.discountType === "RUPEES" ? "RUPEES" : "PERCENTAGE",
      discountValue: Math.max(0, Number(body.discountValue) || 0),
    };

    if (hasVariations) {
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      if (rawVariants.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one variant combination is required." },
          { status: 400 }
        );
      }

      variationOptions.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      variationOptions.variants = rawVariants.map((v: any, index: number) => ({
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

      variationOptions.totalStock = variationOptions.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      variationOptions.minPrice = Math.min(...variationOptions.variants.map((v: any) => v.price));
      variationOptions.maxPrice = Math.max(...variationOptions.variants.map((v: any) => v.price));
      price = variationOptions.minPrice;
      stock = variationOptions.totalStock;
    } else {
      variationOptions.price = price;
      variationOptions.stock = stock;
      variationOptions.bufferStock = minStock;
      variationOptions.barcode = barcode;
      variationOptions.sku = sku;
      variationOptions.totalStock = stock;
      variationOptions.minPrice = price;
      variationOptions.maxPrice = price;
    }

    const insertData: any = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      name,
      sku,
      barcode,
      category_id: body.categoryId || null,
      category_name: body.categoryName || "Uncategorized",
      price,
      stock,
      min_stock: minStock,
      has_variations: hasVariations,
      images: body.imageUrl ? [body.imageUrl] : [],
      variation_options: variationOptions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedProduct, error } = await ctx.supabase
      .from("products")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product: {
        id: insertedProduct.id,
        ...insertedProduct,
        ...variationOptions,
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
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const productId = body.id;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const hasVariations = Boolean(body.hasVariations);
    let price = Number(body.price) || 0;
    let stock = Number(body.stock) || 0;
    let minStock = Number(body.bufferStock || body.minStock) || 0;
    let barcode = String(body.barcode || "");
    let sku = String(body.sku || "");

    const variationOptions: any = {
      description: String(body.description || "").trim(),
      subCategory: body.subCategory || "",
      imageUrl: body.imageUrl || "",
      isDiscountAvailable: Boolean(body.isDiscountAvailable),
      discountType: body.discountType === "RUPEES" ? "RUPEES" : "PERCENTAGE",
      discountValue: Math.max(0, Number(body.discountValue) || 0),
    };

    if (hasVariations) {
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      variationOptions.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      variationOptions.variants = rawVariants.map((v: any, index: number) => ({
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

      variationOptions.totalStock = variationOptions.variants.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
      variationOptions.minPrice = Math.min(...variationOptions.variants.map((v: any) => v.price));
      variationOptions.maxPrice = Math.max(...variationOptions.variants.map((v: any) => v.price));
      price = variationOptions.minPrice;
      stock = variationOptions.totalStock;
    } else {
      variationOptions.price = price;
      variationOptions.stock = stock;
      variationOptions.bufferStock = minStock;
      variationOptions.barcode = barcode;
      variationOptions.sku = sku;
      variationOptions.totalStock = stock;
      variationOptions.minPrice = price;
      variationOptions.maxPrice = price;
    }

    const updatePayload: any = {
      name: String(body.name || "").trim(),
      sku,
      barcode,
      category_id: body.categoryId || null,
      category_name: body.categoryName || "Uncategorized",
      price,
      stock,
      min_stock: minStock,
      has_variations: hasVariations,
      images: body.imageUrl ? [body.imageUrl] : [],
      variation_options: variationOptions,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProduct, error } = await ctx.supabase
      .from("products")
      .update(updatePayload)
      .eq("id", productId)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedProduct) {
      return NextResponse.json({ success: false, error: "Failed to update product or access denied." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        ...updatedProduct,
        ...variationOptions,
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
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Product deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ success: false, error: "Failed to delete product." }, { status: 500 });
  }
}
