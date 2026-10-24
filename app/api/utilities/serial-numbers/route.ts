import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

function extractNumericValue(str: string): number | null {
  const matches = str.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const lastGroup = matches[matches.length - 1];
  const num = parseInt(lastGroup, 10);
  return isNaN(num) ? null : num;
}

// GET: Fetch serial numbers for active store and calculate next start number
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    let query = ctx.supabase
      .from("serial_numbers")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.eq("store_id", ctx.storeId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching serial numbers:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let maxNumber = 0;
    const serialNumbers = (data || []).map((row: any) => {
      const num =
        typeof row.numeric_value === "number"
          ? row.numeric_value
          : extractNumericValue(row.serial_number || "") || 0;

      if (num > maxNumber) {
        maxNumber = num;
      }

      return {
        id: row.id,
        serialNumber: String(row.serial_number || ""),
        numericValue: num,
        status: row.status || "Available",
        createdBy: row.created_by || "",
        createdAt: new Date(row.created_at).getTime(),
      };
    });

    const nextStartNumber = maxNumber > 0 ? maxNumber + 1 : 1;

    // Sort by numericValue ascending, then createdAt descending
    serialNumbers.sort((a, b) => {
      if (a.numericValue !== b.numericValue && a.numericValue > 0 && b.numericValue > 0) {
        return a.numericValue - b.numericValue;
      }
      return b.createdAt - a.createdAt;
    });

    return NextResponse.json({
      success: true,
      serialNumbers,
      totalCount: serialNumbers.length,
      nextStartNumber,
    });
  } catch (error: any) {
    console.error("Error fetching serial numbers:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch serial numbers." },
      { status: 500 }
    );
  }
}

// POST: Add single serial number OR bulk create serial numbers
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
    const mode = body.mode || "single";

    // Mode 1: Single Serial Number
    if (mode === "single") {
      const serialNumber = String(body.serialNumber || "").trim();

      if (!serialNumber) {
        return NextResponse.json(
          { success: false, error: "Serial number is required." },
          { status: 400 }
        );
      }

      const numericValue = extractNumericValue(serialNumber) || 0;

      const serialData = {
        business_id: ctx.businessId,
        store_id: ctx.storeId || null,
        serial_number: serialNumber,
        numeric_value: numericValue,
        status: "Available",
        created_by: ctx.session.email || "system",
      };

      const { data, error } = await ctx.supabase
        .from("serial_numbers")
        .insert(serialData)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        serial: {
          id: data.id,
          serialNumber: data.serial_number,
          numericValue: data.numeric_value,
          status: data.status,
          createdAt: new Date(data.created_at).getTime(),
        },
      });
    }

    // Mode 2: Bulk Create Serial Numbers
    if (mode === "bulk") {
      const startNumber = parseInt(body.startNumber, 10);
      const endNumber = parseInt(body.endNumber, 10);
      const prefix = String(body.prefix || "").trim();

      if (isNaN(startNumber) || startNumber < 1) {
        return NextResponse.json(
          { success: false, error: "Start number must be a valid number >= 1." },
          { status: 400 }
        );
      }

      if (isNaN(endNumber) || endNumber < startNumber) {
        return NextResponse.json(
          { success: false, error: `End number must be greater than or equal to start number (${startNumber}).` },
          { status: 400 }
        );
      }

      const totalToCreate = endNumber - startNumber + 1;
      if (totalToCreate > 2000) {
        return NextResponse.json(
          { success: false, error: "Maximum 2,000 serial numbers can be generated in a single bulk operation." },
          { status: 400 }
        );
      }

      const itemsToInsert = [];
      for (let num = startNumber; num <= endNumber; num++) {
        const serialNumber = prefix ? `${prefix}${num}` : `${num}`;
        itemsToInsert.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          serial_number: serialNumber,
          numeric_value: num,
          status: "Available",
          created_by: ctx.session.email || "system",
        });
      }

      // Supabase supports bulk insert in batches of 500
      const chunkSize = 500;
      let createdCount = 0;

      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        const { error } = await ctx.supabase.from("serial_numbers").insert(chunk);
        if (error) {
          console.error("Error bulk inserting serials:", error);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        createdCount += chunk.length;
      }

      return NextResponse.json({
        success: true,
        createdCount,
        startNumber,
        endNumber,
        nextStartNumber: endNumber + 1,
        message: `Successfully created ${createdCount} serial numbers (${startNumber} to ${endNumber}).`,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid creation mode." }, { status: 400 });
  } catch (error: any) {
    console.error("Error creating serial number(s):", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create serial number(s)." },
      { status: 500 }
    );
  }
}

// DELETE: Delete single serial number or bulk delete
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const serialId = searchParams.get("id");

    // Single delete
    if (serialId) {
      const { error } = await ctx.supabase
        .from("serial_numbers")
        .delete()
        .eq("id", serialId)
        .eq("business_id", ctx.businessId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Serial number deleted successfully." });
    }

    // Bulk delete via JSON body
    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    if (body && Array.isArray(body.ids) && body.ids.length > 0) {
      const ids: string[] = body.ids;
      const { error } = await ctx.supabase
        .from("serial_numbers")
        .delete()
        .in("id", ids)
        .eq("business_id", ctx.businessId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deletedCount: ids.length,
        message: `Successfully deleted ${ids.length} serial numbers.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Serial number ID or list of IDs is required." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error deleting serial number(s):", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete serial number(s)." },
      { status: 500 }
    );
  }
}
