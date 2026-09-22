import { NextResponse } from "next/server";
import { generateSecureOtp, hashOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format." },
        { status: 400 }
      );
    }

    // Generate cryptographically secure OTP
    const otp = generateSecureOtp();
    const hashed = hashOtp(email, otp);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store hashed OTP in Firestore (keyed by sanitized email)
    const sessionDocRef = doc(db, "otp_sessions", email.replace(/[^a-zA-Z0-9_]/g, "_"));
    await setDoc(sessionDocRef, {
      email,
      otpHash: hashed,
      createdAt: Date.now(),
      expiresAt,
      attempts: 0,
    });

    // Send email via SMTP
    const sent = await sendOtpEmail(email, otp);
    if (!sent) {
      return NextResponse.json(
        { success: false, error: "Failed to dispatch email. Please verify SMTP configuration." },
        { status: 500 }
      );
    }

    // Never return the OTP in the API response
    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email address.",
    });
  } catch (error) {
    console.error("Error in send-otp route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while processing OTP." },
      { status: 500 }
    );
  }
}
