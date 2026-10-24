import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch categories strictly for the active business & store with pagination (24 per page)
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const search = searchParams.get("search")?.trim() || "";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = ctx.supabase
      .from("categories")
      .select("*", { count: "exact" })
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: categories, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      success: true,
      categories: (categories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        storeId: c.store_id,
        businessId: c.business_id,
        createdAt: c.created_at,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch categories." }, { status: 500 });
  }
}

// POST: Add new category for the active business & store
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active business." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Category name is required." }, { status: 400 });
    }

    const categoryData = {
      name,
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newCat, error } = await ctx.supabase
      .from("categories")
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      category: {
        id: newCat.id,
        name: newCat.name,
        storeId: newCat.store_id,
        businessId: newCat.business_id,
      },
    });
  } catch (error: any) {
    console.error("Error creating category:", error);
    return NextResponse.json({ success: false, error: "Failed to create category." }, { status: 500 });
  }
}

// PUT: Update category name
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();

    if (!id || !name) {
      return NextResponse.json({ success: false, error: "Category ID and name are required." }, { status: 400 });
    }

    const { data: updatedCat, error } = await ctx.supabase
      .from("categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .select()
      .single();

    if (error || !updatedCat) {
      return NextResponse.json({ success: false, error: "Failed to update category or access denied." }, { status: 403 });
    }

    return NextResponse.json({ success: true, category: { id: updatedCat.id, name: updatedCat.name } });
  } catch (error: any) {
    console.error("Error updating category:", error);
    return NextResponse.json({ success: false, error: "Failed to update category." }, { status: 500 });
  }
}

// DELETE: Delete a category belonging to active business
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");

    if (!categoryId) {
      return NextResponse.json({ success: false, error: "Category ID is required." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Category deleted." });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ success: false, error: "Failed to delete category." }, { status: 500 });
  }
}
