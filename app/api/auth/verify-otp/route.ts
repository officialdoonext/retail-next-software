import { NextResponse } from "next/server";
import { hashOtp, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = body.email;
    const rawOtp = body.otp;

    if (!rawEmail || !rawOtp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP code are required." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase().trim();
    const otp = String(rawOtp).trim();

    if (otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "OTP must be a 6-digit number." },
        { status: 400 }
      );
    }

    const sessionDocRef = doc(db, "otp_sessions", email.replace(/[^a-zA-Z0-9_]/g, "_"));
    const sessionSnap = await getDoc(sessionDocRef);

    if (!sessionSnap.exists()) {
      return NextResponse.json(
        { success: false, error: "No active verification code found. Please request a new OTP." },
        { status: 400 }
      );
    }

    const sessionData = sessionSnap.data();

    // Check expiry
    if (Date.now() > sessionData.expiresAt) {
      await deleteDoc(sessionDocRef);
      return NextResponse.json(
        { success: false, error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Rate limit failed attempts (max 5)
    if (sessionData.attempts >= 5) {
      await deleteDoc(sessionDocRef);
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please request a new verification code." },
        { status: 429 }
      );
    }

    // Verify hash
    const enteredHash = hashOtp(email, otp);
    if (enteredHash !== sessionData.otpHash) {
      await updateDoc(sessionDocRef, {
        attempts: (sessionData.attempts || 0) + 1,
      });
      return NextResponse.json(
        { success: false, error: "Incorrect verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // OTP is valid! Delete session doc to prevent reuse
    await deleteDoc(sessionDocRef);

    // Record user profile in Firestore
    const userDocRef = doc(db, "users", email.replace(/[^a-zA-Z0-9_]/g, "_"));
    const userSnap = await getDoc(userDocRef);

    let effectiveStatus = "Inactive";
    let effectiveExpiry: any = null;
    let effectivePlan: any = null;
    let effectiveModules: string[] | null = null;

    if (!userSnap.exists()) {
      // First-time registration: Inactive status and null expiry date by default
      await setDoc(userDocRef, {
        email,
        role: "Admin",
        status: "Inactive",
        plan: null,
        expiryDate: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      });
    } else {
      // Existing user: Preserve manually configured status, plan, expiry date & modules
      const existing = userSnap.data();
      effectiveStatus = existing.status || "Inactive";
      effectiveExpiry = existing.expiryDate ?? null;
      effectivePlan = existing.plan ?? null;
      effectiveModules = Array.isArray(existing.enabledModules) ? existing.enabledModules : null;

      await updateDoc(userDocRef, {
        lastLoginAt: Date.now(),
        status: effectiveStatus,
        expiryDate: effectiveExpiry,
      });
    }

    // Strict validation: check active status & unexpired validity date
    const isStatusActive = effectiveStatus?.toLowerCase() === "active";
    let expiryTime: number | null = null;
    if (effectiveExpiry) {
      const t = new Date(effectiveExpiry).getTime();
      if (!isNaN(t)) expiryTime = t;
    }
    const isAllowedDirectly = isStatusActive && expiryTime !== null && expiryTime > Date.now();

    // Issue cryptographically signed JWT token with embedded status, expiry & modules
    const token = await createSessionToken({
      email,
      role: "Admin",
      status: effectiveStatus,
      expiryDate: effectiveExpiry,
      plan: effectivePlan,
      enabledModules: effectiveModules || undefined,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful.",
      user: {
        email,
        role: "Admin",
        status: effectiveStatus,
        plan: effectivePlan,
        expiryDate: effectiveExpiry,
        enabledModules: effectiveModules,
      },
      redirect: isAllowedDirectly ? "/dashboard" : "/onboarding",
      isAllowed: isAllowedDirectly,
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Error in verify-otp route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during verification." },
      { status: 500 }
    );
  }
}
