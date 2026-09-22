"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  // Staff Login States
  const [staffMobile, setStaffMobile] = useState("");
  const [staffMpin, setStaffMpin] = useState("");
  const [staffStep, setStaffStep] = useState<"mobile" | "mpin">("mobile");
  const [staffFoundName, setStaffFoundName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pwaInstalled, setPwaInstalled] = useState(false);

  // Send real email OTP via API
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to send verification code. Please check email.");
      } else {
        setOtpSent(true);
        setSuccessMessage("Verification code has been dispatched to your inbox.");
      }
    } catch {
      setErrorMessage("Network error connecting to authentication server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify entered OTP via API
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      setErrorMessage("Please enter all 6 digits.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: fullOtp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Invalid code. Please try again.");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("staff_role", "Admin");
          localStorage.removeItem("staff_access");
          localStorage.removeItem("staff_name");
        }
        // Successfully verified and cookie issued! Redirect to onboarding
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      setErrorMessage("Failed to verify code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Staff Step 1: Check mobile number exists across any store
  const handleStaffCheckMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = staffMobile.replace(/\D/g, "");
    if (!clean || clean.length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-mobile", mobile: clean }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Staff mobile number not recognized.");
      } else {
        setStaffFoundName(data.staffName || "Staff Member");
        setStaffStep("mpin");
        setStaffMpin("");
        setSuccessMessage(`Staff member verified: ${data.staffName}. Please enter your Security MPIN.`);
      }
    } catch {
      setErrorMessage("Network error connecting to staff authentication server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Staff Step 2: Verify MPIN and issue staff session
  const handleStaffVerifyMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = staffMobile.replace(/\D/g, "");
    const cleanPin = staffMpin.trim();

    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage("Please enter your 4-digit or 6-digit MPIN.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-mpin", mobile: clean, mpin: cleanPin }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Invalid Security MPIN. Please try again.");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("staff_role", "Staff");
          if (data.staffName) localStorage.setItem("staff_name", data.staffName);
        }
        setSuccessMessage("Authenticated successfully! Redirecting...");
        router.push(data.redirect || "/onboarding");
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error verifying MPIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstallPwa = () => {
    setPwaInstalled(true);
    setTimeout(() => setPwaInstalled(false), 3000);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 sm:p-6 bg-[#fcfcfd] overflow-hidden font-sans">
      {/* Soft Ambient Background Lighting */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(94, 43, 157, 0.14) 0%, rgba(147, 51, 234, 0.05) 50%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, rgba(110, 231, 183, 0.04) 50%, transparent 70%)",
        }}
      />

      {/* Main Container */}
      <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center">
        {/* Brand Logo & Subtitle */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="relative mb-2 px-2 py-1">
            <Image
              src="/logo.jpeg"
              alt="RetailNext Logo"
              width={240}
              height={64}
              priority
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-slate-400 uppercase">
            Smart Retail POS
          </p>
        </div>

        {/* Login Card - max 6px border radius */}
        <div className="w-full bg-white rounded-[6px] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 sm:p-7">
          {/* Segmented Tab Controls */}
          <div className="bg-[#f1f4f9] p-1 rounded-[6px] flex items-center mb-5 gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setOtpSent(false);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 h-[34px] max-h-[34px] text-xs font-medium rounded-[6px] transition-all duration-200 cursor-pointer flex items-center justify-center ${
                activeTab === "admin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Admin Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("staff");
                setStaffStep("mobile");
                setStaffMpin("");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 h-[34px] max-h-[34px] text-xs font-medium rounded-[6px] transition-all duration-200 cursor-pointer flex items-center justify-center ${
                activeTab === "staff"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Staff Login
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-2.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tab 1: Admin Login */}
          {activeTab === "admin" && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="flex flex-col">
                  <label
                    htmlFor="email"
                    className="text-xs font-medium text-slate-800 mb-1.5 block"
                  >
                    Administrator Email Address
                  </label>

                  <div className="relative mb-2">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@yourbusiness.com"
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    We will send a one-time 6-digit verification code to this inbox.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending Code...
                      </span>
                    ) : (
                      <>
                        <span>Send OTP Code</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* OTP Verification View */
                <div className="flex flex-col animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-800">
                      Enter 6-Digit Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setErrorMessage("");
                      }}
                      className="text-xs font-medium text-[#5e2b9d] hover:underline cursor-pointer"
                    >
                      Change email
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3.5">
                    Sent to <span className="text-slate-700 font-medium">{email}</span>
                  </p>

                  <div className="flex justify-between gap-1.5 mb-4">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`otp-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-[34px] h-[34px] max-h-[34px] text-center text-sm font-medium bg-[#f8fafc] border border-slate-200 rounded-[6px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] text-slate-900 transition-all"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleVerifyOtp()}
                    disabled={isSubmitting}
                    className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs text-center mb-2.5 cursor-pointer disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      <>
                        <span>Verify & Continue</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-slate-400">
                    Didn&apos;t receive code?{" "}
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[#5e2b9d] font-medium hover:underline cursor-pointer"
                    >
                      Resend OTP
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Staff Login */}
          {activeTab === "staff" && (
            <div>
              {staffStep === "mobile" ? (
                /* Step 1: Staff enters Mobile Number */
                <form onSubmit={handleStaffCheckMobile} className="flex flex-col">
                  <label
                    htmlFor="staffMobile"
                    className="text-xs font-medium text-slate-800 mb-1.5 block"
                  >
                    Registered Staff Mobile Number
                  </label>
                  <div className="relative mb-2">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </span>
                    <input
                      id="staffMobile"
                      type="tel"
                      required
                      maxLength={10}
                      autoFocus
                      value={staffMobile}
                      onChange={(e) => setStaffMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="e.g. 9876543210"
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] tracking-wide transition-all"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Enter the 10-digit mobile number registered by your store manager.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting || staffMobile.length < 10}
                    className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs text-center cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Checking Authorization...
                      </span>
                    ) : (
                      <>
                        <span>Continue</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Staff enters Security MPIN */
                <form onSubmit={handleStaffVerifyMpin} className="flex flex-col">
                  {/* Verified Staff Badge with Change option */}
                  <div className="mb-3.5 p-2.5 rounded-[6px] bg-purple-50/70 border border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#5e2b9d] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                        {staffFoundName.slice(0, 1).toUpperCase() || "S"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {staffFoundName}
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-mono">
                          +91 {staffMobile}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffStep("mobile");
                        setStaffMpin("");
                        setErrorMessage("");
                      }}
                      className="text-[11px] font-medium text-[#5e2b9d] hover:underline cursor-pointer flex-shrink-0 ml-2"
                    >
                      Change
                    </button>
                  </div>

                  <label
                    htmlFor="staffMpin"
                    className="text-xs font-medium text-slate-800 mb-1.5 block"
                  >
                    Enter Security MPIN
                  </label>
                  <div className="relative mb-2">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      id="staffMpin"
                      type="password"
                      required
                      maxLength={6}
                      autoFocus
                      value={staffMpin}
                      onChange={(e) => setStaffMpin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••"
                      className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] tracking-[0.3em] transition-all"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Enter your confidential 4-6 digit numeric MPIN set by your administrator.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting || staffMpin.length < 4}
                    className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs text-center cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying MPIN...
                      </span>
                    ) : (
                      <>
                        <span>Verify & Enter Software</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Security Notice Disclaimer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              Restricted Access for Authorized Personnel Only.
              <br />
              Unauthorized access attempts are monitored and logged.
            </p>
          </div>
        </div>

        {/* PWA Install Banner - max 6px border radius */}
        <div className="w-full mt-3.5 bg-white rounded-[6px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] px-5 py-3.5 flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-[34px] h-[34px] rounded-[6px] bg-[#5e2b9d] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-800">
                  Install RetailNext App
                </span>
                <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[9.5px] font-medium px-1.5 py-0.5 rounded-[4px] tracking-wide uppercase">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                Install for faster access & auto updates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallPwa}
            className="h-[34px] max-h-[34px] inline-flex items-center gap-1.5 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            {pwaInstalled ? (
              <span className="text-[#00966a] flex items-center gap-1">
                <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                App Ready
              </span>
            ) : (
              <>
                <span>Install</span>
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
