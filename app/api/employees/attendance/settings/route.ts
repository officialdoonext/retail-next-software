import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  if (!token || !storeId) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { session, storeId };
}

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
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const docRef = doc(db, "store_attendance_settings", ctx.storeId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS });
    }

    const data = snap.data();
    const settings: AttendanceSettings = {
      monthDivisor: data.monthDivisor === 31 ? 31 : 30,
      enableAttendanceBonus: Boolean(data.enableAttendanceBonus),
      bonusDays: Number(data.bonusDays) || 1,
      sundayIsHoliday: data.sundayIsHoliday !== undefined ? Boolean(data.sundayIsHoliday) : true,
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
    const ctx = await getStoreContext();
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

    const docRef = doc(db, "store_attendance_settings", ctx.storeId);
    await setDoc(docRef, { ...newSettings, updatedAt: Date.now() }, { merge: true });

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
