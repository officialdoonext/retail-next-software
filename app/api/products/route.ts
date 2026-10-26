import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// Generate numeric-only unique barcode (e.g. 13-digit EAN style)
function generateNumericBarcode(): string {
  const prefix = "890";
  const middle = Math.floor(100000000 + Math.random() * 900000000).toString();
  const suffix = Math.floor(10 + Math.random() * 90).toString();
  return `${prefix}${middle}${suffix}`;
}

// Helper to return full product view model
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
    taxRate: Number(d.tax_rate) || Number(extra.taxRate) || Number(extra.gstRate) || 0,
    isTaxInclusive: extra.isTaxInclusive !== undefined ? Boolean(extra.isTaxInclusive) : (extra.taxType === "exclusive" ? false : true),
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
      taxRate: v.taxRate !== undefined ? Number(v.taxRate) : (Number(d.tax_rate) || Number(extra.taxRate) || 0),
      isTaxInclusive: v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : (extra.isTaxInclusive !== undefined ? Boolean(extra.isTaxInclusive) : true),
      stock: Number(v.stock) || 0,
      locationStocks: v.locationStocks || { stores: [], warehouses: [] },
    })),
    createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
  };
}

// GET: Fetch products for active business with search & 24-item server pagination
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

      return NextResponse.json({
        success: true,
        product: toProductViewModel(product),
      });
    }

    // 1. Direct Barcode Lookup (Scanner optimization)
    const barcodeQuery = searchParams.get("barcode")?.trim().replace(/\D/g, "");
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
        return NextResponse.json({
          success: true,
          product: toProductViewModel(item),
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
              (itemVar: any) => String(itemVar.barcode).replace(/\D/g, "") === barcodeQuery
            );
            if (v) {
              return NextResponse.json({
                success: true,
                product: toProductViewModel(item),
                variant: {
                  ...v,
                  taxRate: v.taxRate !== undefined ? Number(v.taxRate) : (Number(item.tax_rate) || Number(extra.taxRate) || 0),
                  isTaxInclusive: v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : (extra.isTaxInclusive !== undefined ? Boolean(extra.isTaxInclusive) : true),
                },
              });
            }
          }
        }
      }

      return NextResponse.json({ success: false, error: "Product not found with this barcode." }, { status: 404 });
    }

    // 2. Querying Products for List
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

    let allProducts = (rawProducts || []).map((d: any) => toProductViewModel(d));

    // Search filter
    const search = searchParams.get("search")?.trim().toLowerCase();
    if (search) {
      allProducts = allProducts.filter((p: any) => {
        const nameMatch = p.name?.toLowerCase().includes(search);
        const barcodeMatch = p.barcode?.includes(search);
        const skuMatch = p.sku?.toLowerCase().includes(search);
        const shortCodeMatch = p.shortCode?.toLowerCase().includes(search);
        const categoryMatch = p.categoryName?.toLowerCase().includes(search);
        const variantMatch =
          p.hasVariations &&
          Array.isArray(p.variants) &&
          p.variants.some(
            (v: any) =>
              v.name?.toLowerCase().includes(search) ||
              v.barcode?.includes(search) ||
              v.sku?.toLowerCase().includes(search) ||
              v.shortCode?.toLowerCase().includes(search)
          );
        return nameMatch || barcodeMatch || skuMatch || shortCodeMatch || categoryMatch || variantMatch;
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

    // Pagination (Strictly 24 items per page default)
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 24;

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
    const description = String(body.description || "").trim();
    const shortCode = String(body.shortCode || "").trim();
    let sku = String(body.sku || "").trim();
    if (!sku) {
      sku = `SKU-${Date.now().toString().slice(-6)}`;
    }

    let price = 0;
    let mrp = 0;
    let stock = 0;
    let barcode = "";
    const variationOptions: any = {
      description,
      shortCode,
      imageUrl: body.imageUrl || "",
    };

    if (hasVariations) {
      // ── VARIATION PRODUCT ──
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      if (rawVariants.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one variant combination is required." },
          { status: 400 }
        );
      }

      variationOptions.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      variationOptions.variants = rawVariants.map((v: any, index: number) => {
        // Enforce numeric only barcode
        let varBarcode = String(v.barcode || "").replace(/\D/g, "");
        if (!varBarcode) {
          varBarcode = generateNumericBarcode();
        }

        const vListPrice = Number(v.listPrice || v.mrp) || 0;
        const vSalesPrice = Number(v.salesPrice || v.price) || 0;
        const vStock = Number(v.stock) || 0;
        const vTaxRate = Number(v.taxRate !== undefined ? v.taxRate : (body.taxRate || 18));
        const vIsTaxInclusive = v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : (body.isTaxInclusive !== undefined ? Boolean(body.isTaxInclusive) : true);

        return {
          id: v.id || `var_${Date.now()}_${index}`,
          name: String(v.name || `Variant ${index + 1}`),
          attributes: v.attributes || {},
          shortCode: String(v.shortCode || "").trim(),
          sku: String(v.sku || `${sku}-${index + 1}`).trim(),
          barcode: varBarcode,
          listPrice: vListPrice,
          salesPrice: vSalesPrice,
          price: vSalesPrice,
          mrp: vListPrice,
          taxRate: vTaxRate,
          isTaxInclusive: vIsTaxInclusive,
          stock: vStock,
          locationStocks: v.locationStocks || { stores: [], warehouses: [] },
        };
      });

      // Calculate aggregate stats
      variationOptions.totalStock = variationOptions.variants.reduce(
        (acc: number, curr: any) => acc + (Number(curr.stock) || 0),
        0
      );
      const salesPrices = variationOptions.variants.map((v: any) => v.salesPrice);
      const listPrices = variationOptions.variants.map((v: any) => v.listPrice);
      variationOptions.minPrice = Math.min(...salesPrices);
      variationOptions.maxPrice = Math.max(...salesPrices);

      price = variationOptions.minPrice;
      mrp = Math.min(...listPrices);
      stock = variationOptions.totalStock;
      barcode = variationOptions.variants[0]?.barcode || generateNumericBarcode();
    } else {
      // ── SIMPLE PRODUCT ──
      mrp = Number(body.listPrice || body.mrp) || 0;
      price = Number(body.salesPrice || body.price) || 0;
      stock = Number(body.stock) || 0;

      // Enforce numeric only barcode
      barcode = String(body.barcode || "").replace(/\D/g, "");
      if (!barcode) {
        barcode = generateNumericBarcode();
      }

      variationOptions.listPrice = mrp;
      variationOptions.salesPrice = price;
      variationOptions.price = price;
      variationOptions.mrp = mrp;
      variationOptions.stock = stock;
      variationOptions.totalStock = stock;
      variationOptions.barcode = barcode;
      variationOptions.sku = sku;
      variationOptions.locationStocks = body.locationStocks || { stores: [], warehouses: [] };
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
      cost_price: Number(body.costPrice) || 0,
      mrp,
      stock,
      min_stock: Number(body.minStock || body.bufferStock) || 0,
      unit: body.unit || "pcs",
      has_variations: hasVariations,
      images: body.imageUrl ? [body.imageUrl] : [],
      variation_options: variationOptions,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedProduct, error } = await ctx.supabase
      .from("products")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error inserting product into Supabase:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product: toProductViewModel(insertedProduct),
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

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    const hasVariations = Boolean(body.hasVariations);
    const description = String(body.description || "").trim();
    const shortCode = String(body.shortCode || "").trim();
    let sku = String(body.sku || "").trim();
    if (!sku) {
      sku = `SKU-${Date.now().toString().slice(-6)}`;
    }

    let price = 0;
    let mrp = 0;
    let stock = 0;
    let barcode = "";
    const variationOptions: any = {
      description,
      shortCode,
      imageUrl: body.imageUrl || "",
    };

    if (hasVariations) {
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      variationOptions.variationTypes = Array.isArray(body.variationTypes) ? body.variationTypes : [];
      variationOptions.variants = rawVariants.map((v: any, index: number) => {
        let varBarcode = String(v.barcode || "").replace(/\D/g, "");
        if (!varBarcode) {
          varBarcode = generateNumericBarcode();
        }
        const vListPrice = Number(v.listPrice || v.mrp) || 0;
        const vSalesPrice = Number(v.salesPrice || v.price) || 0;
        const vStock = Number(v.stock) || 0;
        const vTaxRate = Number(v.taxRate !== undefined ? v.taxRate : (body.taxRate || 18));
        const vIsTaxInclusive = v.isTaxInclusive !== undefined ? Boolean(v.isTaxInclusive) : (body.isTaxInclusive !== undefined ? Boolean(body.isTaxInclusive) : true);

        return {
          id: v.id || `var_${Date.now()}_${index}`,
          name: String(v.name || `Variant ${index + 1}`),
          attributes: v.attributes || {},
          shortCode: String(v.shortCode || "").trim(),
          sku: String(v.sku || `${sku}-${index + 1}`).trim(),
          barcode: varBarcode,
          listPrice: vListPrice,
          salesPrice: vSalesPrice,
          price: vSalesPrice,
          mrp: vListPrice,
          taxRate: vTaxRate,
          isTaxInclusive: vIsTaxInclusive,
          stock: vStock,
          locationStocks: v.locationStocks || { stores: [], warehouses: [] },
        };
      });

      variationOptions.totalStock = variationOptions.variants.reduce(
        (acc: number, curr: any) => acc + (Number(curr.stock) || 0),
        0
      );
      const salesPrices = variationOptions.variants.map((v: any) => v.salesPrice);
      const listPrices = variationOptions.variants.map((v: any) => v.listPrice);
      variationOptions.minPrice = Math.min(...salesPrices);
      variationOptions.maxPrice = Math.max(...salesPrices);

      price = variationOptions.minPrice;
      mrp = Math.min(...listPrices);
      stock = variationOptions.totalStock;
      barcode = variationOptions.variants[0]?.barcode || generateNumericBarcode();
    } else {
      mrp = Number(body.listPrice || body.mrp) || 0;
      price = Number(body.salesPrice || body.price) || 0;
      stock = Number(body.stock) || 0;

      barcode = String(body.barcode || "").replace(/\D/g, "");
      if (!barcode) {
        barcode = generateNumericBarcode();
      }

      variationOptions.listPrice = mrp;
      variationOptions.salesPrice = price;
      variationOptions.price = price;
      variationOptions.mrp = mrp;
      variationOptions.stock = stock;
      variationOptions.totalStock = stock;
      variationOptions.barcode = barcode;
      variationOptions.sku = sku;
      variationOptions.locationStocks = body.locationStocks || { stores: [], warehouses: [] };
    }

    const updatePayload: any = {
      name,
      sku,
      barcode,
      category_id: body.categoryId || null,
      category_name: body.categoryName || "Uncategorized",
      price,
      mrp,
      stock,
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
      product: toProductViewModel(updatedProduct),
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
    return NextResponse.json({ success: false, error: error.message || "Failed to delete product." }, { status: 500 });
  }
}
