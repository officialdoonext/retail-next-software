"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

function parseDateExpiry(expires: any): { isUnexpired: boolean; display: string } {
  if (!expires) return { isUnexpired: false, display: "null (Not Set)" };
  let time: number | null = null;
  let display = "";

  if (typeof expires === "string" || typeof expires === "number") {
    const t = new Date(expires).getTime();
    if (!isNaN(t)) {
      time = t;
      display =
        typeof expires === "string" && expires.length < 12
          ? expires
          : new Date(t).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
    }
  } else if (typeof expires === "object" && expires !== null) {
    if (typeof expires.toDate === "function") {
      const d = expires.toDate();
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } else if ("seconds" in expires) {
      const d = new Date(expires.seconds * 1000);
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  return {
    isUnexpired: time !== null && time > Date.now(),
    display: display || String(expires),
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User details & Subscription plan state (User-Specific)
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"Admin" | "Staff">("Admin");
  const [userName, setUserName] = useState("");
  const [userStatus, setUserStatus] = useState<string>("Inactive");
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [userExpiryDate, setUserExpiryDate] = useState<any>(null);

  // Load session from /api/auth/me
  const loadUserData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.authenticated && meData.user) {
        setUserEmail(meData.user.email);
        setUserRole(meData.user.role || "Admin");
        setUserName(meData.user.staffName || "");
        setUserStatus(meData.user.status || "Inactive");
        setUserPlan(meData.user.plan || null);
        setUserExpiryDate(meData.user.expiryDate ?? null);
      }
    } catch (err) {
      console.error("Failed to load user account status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/auth/refresh-session", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserStatus(data.status || "Inactive");
        setUserPlan(data.plan || null);
        setUserExpiryDate(data.expiryDate ?? null);

        if (data.isAllowed) {
          router.push(data.redirect || "/dashboard");
          router.refresh();
          return;
        }
      } else {
        await loadUserData();
      }
    } catch {
      await loadUserData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("staff_role");
        localStorage.removeItem("staff_access");
        localStorage.removeItem("staff_name");
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // Evaluate user status & expiry
  const { isUnexpired, display: formattedExpiry } = parseDateExpiry(userExpiryDate);
  const isStatusActive = userStatus?.toLowerCase() === "active";
  const isUserAllowed = userRole === "Staff" ? true : isStatusActive && isUnexpired;

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col font-sans text-slate-800">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center">
          <Link href="/onboarding" className="block">
            <Image
              src="/logo.jpeg"
              alt="RetailNext Logo"
              width={160}
              height={44}
              priority
              className="h-9 sm:h-10 w-auto object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* User Profile Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-[#f8fafc] border border-slate-200/90 rounded-[6px] px-3 py-1.5 text-xs text-slate-700">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isUserAllowed ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="font-medium text-slate-700">
              {userName || userEmail || "User"}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider bg-[#5e2b9d]/10 text-[#5e2b9d]">
              {userRole}
            </span>
          </div>

          {/* Log Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="h-[34px] max-h-[34px] border border-slate-200 rounded-[6px] px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 stroke-[2] text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center justify-center">
        {loading ? (
          /* Loading State */
          <div className="w-full bg-white rounded-[6px] border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-xs">
            <svg className="animate-spin h-7 w-7 text-[#5e2b9d] mb-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium">Verifying account plan & validity status...</p>
          </div>
        ) : !isUserAllowed ? (
          /* INACTIVE OR EXPIRED PLAN CARD — USER SPECIFIC */
          <div className="w-full bg-white rounded-[6px] border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 sm:p-8 animate-in fade-in duration-200 relative overflow-hidden">
            {/* Soft Ambient Warning Glow */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30"
              style={{
                background: "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
              }}
            />

            {/* Warning Emblem */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-2xs">
                <svg className="w-7 h-7 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-amber-100/70 text-amber-800 text-[11px] font-semibold uppercase tracking-wider mb-2">
                <span>Account Disabled</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                Plan Inactive or Expired
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed font-normal">
                Your account subscription is currently inactive or has expired. Access to the software is restricted.
                <strong className="text-slate-800 block mt-1">
                  Please ask the administrator to make it enabled.
                </strong>
              </p>
            </div>

            {/* User Account Verification Details Box */}
            <div className="bg-[#f8fafc] rounded-[6px] border border-slate-200/80 p-4 mb-6 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Email Address:</span>
                <span className="font-mono text-slate-800 font-medium">{userEmail}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Account Status:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-[4px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {userStatus || "Inactive"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Assigned Plan:</span>
                <span className="font-medium text-slate-700">
                  {userPlan || "None (Plan Not Assigned)"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-normal">Expiry Date:</span>
                <span className="font-mono text-slate-700 font-medium">
                  {userExpiryDate ? formattedExpiry : "null (Not Set)"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="w-full sm:flex-1 h-[36px] max-h-[36px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg
                  className={`w-3.5 h-3.5 text-[#5e2b9d] ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? "Checking Account Status..." : "Refresh Status"}</span>
              </button>

              <button
                type="button"
                disabled
                className="w-full sm:flex-1 h-[36px] max-h-[36px] bg-slate-100 text-slate-400 font-medium text-xs rounded-[6px] flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Enter Software (Blocked)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-4 font-normal">
              Once your administrator updates your account status to <strong>Active</strong> with a valid expiry date, click <strong>Refresh Status</strong> to enter.
            </p>
          </div>
        ) : (
          /* ACTIVE & UNEXPIRED PLAN CARD — USER SPECIFIC */
          <div className="w-full bg-white rounded-[6px] border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 sm:p-8 animate-in fade-in duration-200 relative overflow-hidden">
            {/* Soft Ambient Emerald Glow */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30"
              style={{
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)",
              }}
            />

            {/* Success Emblem */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-2xs">
                <svg className="w-7 h-7 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-emerald-100 text-emerald-800 text-[11px] font-semibold uppercase tracking-wider mb-2">
                <span>Verified & Active</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                Account Plan Active
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed font-normal">
                Your account is verified and currently active with valid software terminal privileges.
              </p>
            </div>

            {/* Account Details Box */}
            <div className="bg-[#f8fafc] rounded-[6px] border border-slate-200/80 p-4 mb-6 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Email:</span>
                <span className="font-mono text-slate-800 font-medium">{userEmail}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Account Status:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[4px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-normal">Assigned Plan:</span>
                <span className="font-semibold text-slate-800">
                  {userPlan || "Active Plan"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-normal">Expiry Date:</span>
                <span className="font-mono text-emerald-700 font-medium">
                  {formattedExpiry}
                </span>
              </div>
            </div>

            {/* Enter Software CTA */}
            <div className="flex flex-col gap-2.5">
              <Link
                href="/dashboard"
                className="w-full h-[38px] max-h-[38px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-semibold text-xs px-5 rounded-[6px] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Enter Software</span>
                <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="w-full h-[34px] max-h-[34px] text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors cursor-pointer text-center"
              >
                {refreshing ? "Re-checking..." : "Check Status"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
