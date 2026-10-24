import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId || null)
      .maybeSingle();

    const design = data?.settings?.id_card_design || null;
    return NextResponse.json({ success: true, design });
  } catch (error: any) {
    console.error("Error fetching ID card design:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch design." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.primaryColor || !body.secondaryColor) {
      return NextResponse.json({ success: false, error: "Missing required design fields." }, { status: 400 });
    }

    const design = {
      primaryColor: body.primaryColor || "#5e2b9d",
      secondaryColor: body.secondaryColor || "#7c3aed",
      accentColor: body.accentColor || "#a78bfa",
      textDarkColor: body.textDarkColor || "#1a1a2e",
      textLightColor: body.textLightColor || "#6b7280",
      showName: body.showName !== false,
      showEmpId: body.showEmpId !== false,
      showMobile: body.showMobile !== false,
      showQr: body.showQr !== false,
      bgPattern: ["dots", "lines", "none"].includes(body.bgPattern) ? body.bgPattern : "dots",
      storeId: ctx.storeId,
      updatedAt: Date.now(),
    };

    const { data: existing } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId || null)
      .maybeSingle();

    const currentSettings = existing?.settings || {};
    currentSettings.id_card_design = design;

    const { error } = await ctx.supabase
      .from("business_settings")
      .upsert(
        {
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          settings: currentSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,store_id" }
      );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, design });
  } catch (error: any) {
    console.error("Error saving ID card design:", error);
    return NextResponse.json({ success: false, error: "Failed to save design." }, { status: 500 });
  }
}
