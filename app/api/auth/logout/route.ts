import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.delete(AUTH_COOKIE_NAME);
  response.cookies.delete(ACTIVE_STORE_COOKIE);
  response.cookies.delete("staff_role");
  response.cookies.delete("staff_access");
  return response;
}
