import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fast metadata fetch for Product Form (Categories, Variations, Stores, Warehouses)
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const [categoriesRes, variationsRes, storesRes, warehousesRes] = await Promise.all([
      ctx.supabase
        .from("categories")
        .select("id, name")
        .eq("business_id", ctx.businessId)
        .order("name", { ascending: true }),
      ctx.supabase
        .from("variations")
        .select("id, name, values")
        .eq("business_id", ctx.businessId)
        .order("name", { ascending: true }),
      ctx.supabase
        .from("stores")
        .select("id, name, city, location")
        .eq("business_id", ctx.businessId)
        .order("name", { ascending: true }),
      ctx.supabase
        .from("warehouses")
        .select("id, name, city")
        .eq("business_id", ctx.businessId)
        .order("name", { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      categories: categoriesRes.data || [],
      variations: (variationsRes.data || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        values: Array.isArray(v.values) ? v.values : [],
      })),
      stores: storesRes.data || [],
      warehouses: warehousesRes.data || [],
    });
  } catch (error: any) {
    console.error("Error fetching product metadata:", error);
    return NextResponse.json({ success: false, error: "Failed to load product metadata." }, { status: 500 });
  }
}
