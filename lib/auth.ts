import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "7f68c5b058a9e623192083b38ef05ca7e3cf4d8c72877a5e0192e21bf18db35d"
);
const OTP_SECRET =
  process.env.OTP_HASH_SECRET || "a92bd0385df19f5a773229b1cd4591a27e78d91024bc63b21845ef20a7b45129";

export const AUTH_COOKIE_NAME = "auth_session";
export const ACTIVE_STORE_COOKIE = "active_store_id";

export interface SessionPayload {
  email: string;
  role: "Admin" | "Staff";
  createdAt: number;
  mobile?: string;
  staffId?: string;
  staffName?: string;
  storeId?: string;
  access?: string[]; // Array of permitted page hrefs (e.g. ["/pos", "/orders"])
}

// Generates a 6-digit secure numeric OTP
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// Hash OTP with SHA-256 + secret salt so plain OTP is never in database
export function hashOtp(email: string, otp: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.toLowerCase().trim()}:${otp.trim()}`)
    .digest("hex");
}

// Issue a cryptographically signed JWT session token (valid for 7 days)
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SESSION_SECRET);
}

// Verify JWT session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
