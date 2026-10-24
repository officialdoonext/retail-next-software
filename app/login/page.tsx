"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  // Mode: "login" (Sign In) | "register" (Create Account) | "staff" (Staff MPIN)
  const [activeTab, setActiveTab] = useState<"login" | "register" | "staff">("login");

  // Sign In States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Create Account (Business Registration) States
  const [businessName, setBusinessName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Staff Login States
  const [staffMobile, setStaffMobile] = useState("");
  const [staffMpin, setStaffMpin] = useState("");
  const [staffStep, setStaffStep] = useState<"mobile" | "mpin">("mobile");
  const [staffFoundName, setStaffFoundName] = useState("");

  // Shared UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // PWA Install State & Lifecycle
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<"ios" | "android" | "desktop">("desktop");

  // Handle Sign In (Email + Password via Supabase Auth)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMessage("Please enter both email address and password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Authentication failed. Please check your credentials.");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("staff_role", "Admin");
          localStorage.removeItem("staff_access");
          localStorage.removeItem("staff_name");
        }
        setSuccessMessage("Authenticated successfully! Verifying authorization...");
        const destination = data.redirect || (data.isAllowed ? "/dashboard" : "/onboarding");
        router.push(destination);
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error connecting to authentication server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Account & Business (Supabase Auth + Business Record)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!businessName.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }
    const cleanMobile = mobileNumber.replace(/\D/g, "");
    if (cleanMobile.length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!registerEmail.trim() || !registerEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (registerPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          mobileNumber: cleanMobile,
          email: registerEmail.trim(),
          password: registerPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Account creation failed. Please try again.");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("staff_role", "Admin");
          localStorage.removeItem("staff_access");
          localStorage.removeItem("staff_name");
        }
        setSuccessMessage("Account created successfully! Redirecting to onboarding...");
        // Strictly redirects to /onboarding because business is Inactive and expiry is null
        router.push(data.redirect || "/onboarding");
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error connecting to registration server.");
    } finally {
      setIsSubmitting(false);
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

  // Detect PWA installation and capture install prompt event
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://")
    ) {
      setIsStandalone(true);
      setPwaInstalled(true);
    }

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setGuidePlatform("ios");
    } else if (/android/.test(ua)) {
      setGuidePlatform("android");
    } else {
      setGuidePlatform("desktop");
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPwaInstalled(false);
    };

    const handleAppInstalled = () => {
      setPwaInstalled(true);
      setDeferredPrompt(null);
      setIsInstalling(false);
      setShowInstallGuideModal(false);
      toast.success("RetailNext has been installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast]);

  const handleInstallPwa = async () => {
    if (isStandalone || pwaInstalled) {
      toast.success("RetailNext is already installed on your device.");
      return;
    }

    if (deferredPrompt) {
      try {
        setIsInstalling(true);
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setPwaInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Installation prompt error:", err);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col justify-center items-center px-4 py-8 relative selection:bg-[#5e2b9d] selection:text-white font-sans text-slate-800">
      {/* Background Decor */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(#5e2b9d 0.5px, transparent 0.5px), radial-gradient(#5e2b9d 0.5px, #fcfcfd 0.5px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <Image
              src="/logo.jpeg"
              alt="RetailNext Logo"
              width={200}
              height={56}
              priority
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {activeTab === "register"
              ? "Create Business Account"
              : activeTab === "staff"
              ? "Staff Terminal Access"
              : "Business Terminal Login"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs font-normal">
            {activeTab === "register"
              ? "Register your enterprise business & setup software access"
              : activeTab === "staff"
              ? "Enter your registered mobile & security MPIN"
              : "Access your cloud POS, inventory & multi-store manager"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-[0_4px_25px_rgba(0,0,0,0.03)] p-6 sm:p-7 relative">
          {/* Top Segmented Tabs: Sign In / Create Account / Staff */}
          <div className="flex bg-[#f1f5f9] p-1 rounded-[6px] mb-5 gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 h-[34px] max-h-[34px] text-xs font-medium rounded-[6px] transition-all duration-200 cursor-pointer flex items-center justify-center ${
                activeTab === "login"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 h-[34px] max-h-[34px] text-xs font-medium rounded-[6px] transition-all duration-200 cursor-pointer flex items-center justify-center ${
                activeTab === "register"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
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
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Staff
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

          {/* TAB 1: SIGN IN (EMAIL + PASSWORD) */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col space-y-3.5">
              <div>
                <label htmlFor="loginEmail" className="text-xs font-medium text-slate-800 mb-1.5 block">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    id="loginEmail"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@yourbusiness.com"
                    className="w-full h-[36px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="loginPassword" className="text-xs font-medium text-slate-800 block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#5e2b9d] hover:underline cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="loginPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[36px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[36px] max-h-[36px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500">
                  New to Retail Next?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("register");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-[#5e2b9d] font-semibold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: CREATE ACCOUNT (BUSINESS REGISTRATION) */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="flex flex-col space-y-3">
              {/* Business Name */}
              <div>
                <label htmlFor="regBusinessName" className="text-xs font-medium text-slate-800 mb-1 block">
                  Business Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  <input
                    id="regBusinessName"
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Supermarket"
                    className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label htmlFor="regMobile" className="text-xs font-medium text-slate-800 mb-1 block">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <input
                    id="regMobile"
                    type="tel"
                    required
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="regEmail" className="text-xs font-medium text-slate-800 mb-1 block">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    id="regEmail"
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="owner@yourbusiness.com"
                    className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="regPass" className="text-xs font-medium text-slate-800 block">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="text-[11px] text-[#5e2b9d] hover:underline cursor-pointer"
                  >
                    {showRegisterPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="regPass"
                  type={showRegisterPassword ? "text" : "password"}
                  required
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="regConfirmPass" className="text-xs font-medium text-slate-800 mb-1 block">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="regConfirmPass"
                  type={showRegisterPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all"
                />
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-[6px] p-2.5 text-[11px] text-amber-800 leading-relaxed">
                <strong>Important Notice:</strong> Newly registered businesses are created with <strong>Inactive</strong> status and pending subscription approval. Once activated by an administrator, full software terminal features unlock.
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[36px] max-h-[36px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Business Account...
                    </span>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <p className="text-[11px] text-slate-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("login");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-[#5e2b9d] font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB 3: STAFF LOGIN */}
          {activeTab === "staff" && (
            <div>
              {staffStep === "mobile" ? (
                <form onSubmit={handleStaffCheckMobile} className="flex flex-col">
                  <label htmlFor="staffMobile" className="text-xs font-medium text-slate-800 mb-1.5 block">
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
                      className="w-full h-[36px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] tracking-wide transition-all"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Enter the 10-digit mobile number registered by your store manager.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting || staffMobile.length < 10}
                    className="w-full h-[36px] max-h-[36px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs text-center cursor-pointer disabled:opacity-50"
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
                <form onSubmit={handleStaffVerifyMpin} className="flex flex-col">
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

                  <label htmlFor="staffMpin" className="text-xs font-medium text-slate-800 mb-1.5 block">
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
                      className="w-full h-[36px] bg-[#f8fafc] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] tracking-[0.3em] transition-all"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Enter your confidential 4-6 digit numeric MPIN set by your administrator.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting || staffMpin.length < 4}
                    className="w-full h-[36px] max-h-[36px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all duration-200 flex items-center justify-center gap-2 shadow-xs text-center cursor-pointer disabled:opacity-50"
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
          <div className="mt-5 pt-3.5 border-t border-slate-100 text-center">
            <p className="text-[10.5px] text-slate-400 leading-relaxed font-normal">
              Protected by Enterprise Multi-Tenant Supabase Cloud.
              <br />
              All terminal sessions are cryptographically signed.
            </p>
          </div>
        </div>

        {/* PWA Install Banner */}
        <div className="w-full mt-3.5 bg-white rounded-[6px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] px-5 py-3.5 flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-[34px] h-[34px] rounded-[6px] bg-[#5e2b9d] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-800">Install RetailNext App</span>
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
            disabled={isInstalling}
            className={`h-[34px] max-h-[34px] inline-flex items-center gap-1.5 px-4 text-xs font-semibold rounded-[6px] transition-all shadow-xs cursor-pointer ${
              isStandalone || pwaInstalled
                ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-purple-50 hover:text-[#5e2b9d] hover:border-purple-200"
            }`}
          >
            {isInstalling ? (
              <span className="flex items-center gap-1.5 text-[#5e2b9d]">
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Installing...
              </span>
            ) : isStandalone || pwaInstalled ? (
              <span className="text-[#00966a] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                App Installed
              </span>
            ) : (
              <>
                <span>Install App</span>
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
