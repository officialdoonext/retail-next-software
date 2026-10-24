import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// GET: Fetch all saved/held draft bills for the active business & store
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    let query = ctx.supabase
      .from("saved_bills")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data: rawBills, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const savedBills = (rawBills || []).map((d: any) => ({
      id: d.id,
      draftNumber: d.bill_name,
      storeId: d.store_id,
      businessId: d.business_id,
      customer: d.customer_info,
      items: Array.isArray(d.items) ? d.items : [],
      totalItemsCount: Array.isArray(d.items) ? d.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 0,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    }));

    return NextResponse.json({ success: true, savedBills });
  } catch (error: any) {
    console.error("Error fetching saved bills:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch saved bills." }, { status: 500 });
  }
}

// POST: Save cart as a draft bill in Supabase
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Cannot save an empty bill." }, { status: 400 });
    }

    const draftNumber = `HOLD-${Date.now().toString().slice(-6)}`;

    const savedBillData = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      bill_name: draftNumber,
      items,
      customer_info: body.customer || {},
      created_at: new Date().toISOString(),
    };

    if (body.id) {
      const { data: updatedBill, error: upErr } = await ctx.supabase
        .from("saved_bills")
        .update({
          items,
          customer_info: body.customer || {},
        })
        .eq("id", body.id)
        .eq("business_id", ctx.businessId)
        .select()
        .single();

      if (!upErr && updatedBill) {
        return NextResponse.json({
          success: true,
          message: "Saved bill updated successfully.",
          savedBill: { id: body.id, ...savedBillData },
        });
      }
    }

    const { data: insertedBill, error } = await ctx.supabase
      .from("saved_bills")
      .insert([savedBillData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Bill placed on hold in saved bills.",
      savedBill: {
        id: insertedBill.id,
        draftNumber,
        ...savedBillData,
      },
    });
  } catch (error: any) {
    console.error("Error saving bill:", error);
    return NextResponse.json({ success: false, error: "Failed to save bill." }, { status: 500 });
  }
}

// DELETE: Discard a saved bill in Supabase
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized access blocked." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("id");

    if (!billId) {
      return NextResponse.json({ success: false, error: "Missing bill ID." }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("saved_bills")
      .delete()
      .eq("id", billId)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Saved bill removed." });
  } catch (error: any) {
    console.error("Error deleting saved bill:", error);
    return NextResponse.json({ success: false, error: "Failed to delete saved bill." }, { status: 500 });
  }
}
