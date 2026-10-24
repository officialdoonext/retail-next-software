import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

function extractNumericValue(str: string): number | null {
  const matches = str.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const lastGroup = matches[matches.length - 1];
  const num = parseInt(lastGroup, 10);
  return isNaN(num) ? null : num;
}

// GET: Fetch racks for active business & store
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const godownFilter = searchParams.get("godownId");

    let query = ctx.supabase
      .from("racks")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    if (godownFilter && godownFilter !== "all") {
      query = query.eq("godown_id", godownFilter);
    }

    const { data: rawRacks, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let maxNumber = 0;
    const racks = (rawRacks || []).map((d: any) => {
      const num = extractNumericValue(d.name || "") || 0;
      if (num > maxNumber) maxNumber = num;
      return {
        id: d.id,
        rackNumber: String(d.name || ""),
        numericValue: num,
        godownId: d.godown_id || "",
        godownName: "Godown",
        storeId: d.store_id,
        businessId: d.business_id,
        createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      };
    });

    return NextResponse.json({
      success: true,
      racks,
      totalCount: racks.length,
      nextStartNumber: maxNumber > 0 ? maxNumber + 1 : 1,
    });
  } catch (error: any) {
    console.error("Error fetching racks:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch racks." }, { status: 500 });
  }
}

// POST: Add single rack OR bulk create racks in Supabase
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized or no active store selected." }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode || "single";

    if (mode === "single") {
      const rackNumber = String(body.rackNumber || "").trim();
      const godownId = String(body.godownId || "").trim();

      if (!rackNumber) {
        return NextResponse.json({ success: false, error: "Rack number is required." }, { status: 400 });
      }

      const rackData = {
        name: rackNumber,
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        godown_id: godownId || null,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await ctx.supabase
        .from("racks")
        .insert([rackData])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        rack: {
          id: inserted.id,
          rackNumber: inserted.name,
          numericValue: extractNumericValue(inserted.name) || 0,
          godownId: inserted.godown_id,
          storeId: inserted.store_id,
          businessId: inserted.business_id,
        },
      });
    }

    if (mode === "bulk") {
      const startNumber = parseInt(body.startNumber, 10);
      const endNumber = parseInt(body.endNumber, 10);
      const prefix = String(body.prefix || "").trim();
      const godownId = String(body.godownId || "").trim();

      if (isNaN(startNumber) || startNumber < 1) {
        return NextResponse.json({ success: false, error: "Start number must be >= 1." }, { status: 400 });
      }
      if (isNaN(endNumber) || endNumber < startNumber) {
        return NextResponse.json({ success: false, error: "End number must be >= start number." }, { status: 400 });
      }

      const rows: any[] = [];
      for (let num = startNumber; num <= endNumber; num++) {
        const rackNumber = prefix ? `${prefix}${num}` : `${num}`;
        rows.push({
          name: rackNumber,
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          godown_id: godownId || null,
          created_at: new Date().toISOString(),
        });
      }

      const chunkSize = 200;
      let createdCount = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: insertErr } = await ctx.supabase
          .from("racks")
          .insert(chunk);

        if (!insertErr) createdCount += chunk.length;
      }

      return NextResponse.json({
        success: true,
        createdCount,
        nextStartNumber: endNumber + 1,
        message: `Successfully created ${createdCount} racks.`,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid creation mode." }, { status: 400 });
  } catch (error: any) {
    console.error("Error creating rack(s):", error);
    return NextResponse.json({ success: false, error: "Failed to create rack(s)." }, { status: 500 });
  }
}

// DELETE: Delete single rack or bulk delete
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rackId = searchParams.get("id");

    if (rackId) {
      const { error } = await ctx.supabase
        .from("racks")
        .delete()
        .eq("id", rackId)
        .eq("business_id", ctx.businessId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "Rack deleted successfully." });
    }

    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    if (body && Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await ctx.supabase
        .from("racks")
        .delete()
        .in("id", body.ids)
        .eq("business_id", ctx.businessId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Racks deleted." });
    }

    return NextResponse.json({ success: false, error: "Rack ID is required." }, { status: 400 });
  } catch (error: any) {
    console.error("Error deleting rack(s):", error);
    return NextResponse.json({ success: false, error: "Failed to delete rack(s)." }, { status: 500 });
  }
}
