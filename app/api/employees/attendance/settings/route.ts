import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

export interface AttendanceSettings {
  monthDivisor: 30 | 31;
  enableAttendanceBonus: boolean;
  bonusDays: number;
  sundayIsHoliday: boolean;
}

const DEFAULT_SETTINGS: AttendanceSettings = {
  monthDivisor: 30,
  enableAttendanceBonus: false,
  bonusDays: 1,
  sundayIsHoliday: true,
};

// GET /api/employees/attendance/settings
export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const { data } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId || null)
      .maybeSingle();

    const attSettings = data?.settings?.attendance_settings;
    if (!attSettings) {
      return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS });
    }

    const settings: AttendanceSettings = {
      monthDivisor: attSettings.monthDivisor === 31 ? 31 : 30,
      enableAttendanceBonus: Boolean(attSettings.enableAttendanceBonus),
      bonusDays: Number(attSettings.bonusDays) || 1,
      sundayIsHoliday: attSettings.sundayIsHoliday !== undefined ? Boolean(attSettings.sundayIsHoliday) : true,
    };

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("GET attendance settings error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings." },
      { status: 500 }
    );
  }
}

// POST /api/employees/attendance/settings
export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const monthDivisor = body.monthDivisor === 31 ? 31 : 30;
    const enableAttendanceBonus = Boolean(body.enableAttendanceBonus);
    const bonusDays = Math.max(0, Number(body.bonusDays) || 1);
    const sundayIsHoliday = body.sundayIsHoliday !== undefined ? Boolean(body.sundayIsHoliday) : true;

    const newSettings: AttendanceSettings = {
      monthDivisor,
      enableAttendanceBonus,
      bonusDays,
      sundayIsHoliday,
    };

    const { data: existing } = await ctx.supabase
      .from("business_settings")
      .select("settings")
      .eq("business_id", ctx.businessId)
      .eq("store_id", ctx.storeId || null)
      .maybeSingle();

    const currentSettings = existing?.settings || {};
    currentSettings.attendance_settings = newSettings;

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

    return NextResponse.json({
      success: true,
      settings: newSettings,
      message: "Attendance & salary settings saved successfully.",
    });
  } catch (err: any) {
    console.error("POST attendance settings error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update settings." },
      { status: 500 }
    );
  }
}
