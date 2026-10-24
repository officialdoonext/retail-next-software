"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BusinessItem {
  id: string;
  name: string;
  mobile_number?: string;
  email: string;
  status: "Active" | "Inactive" | string;
  expiry_date?: any;
  plan?: string | null;
  isActiveSelection?: boolean;
  created_at?: string;
}

function parseDateExpiry(expires: any): { isUnexpired: boolean; display: string } {
  if (!expires) return { isUnexpired: false, display: "null (Pending Approval)" };
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

  // User Profile
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"Admin" | "Staff">("Admin");
  const [userName, setUserName] = useState("");

  // Businesses State
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<BusinessItem | null>(null);

  // Add Business Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBusName, setNewBusName] = useState("");
  const [newBusMobile, setNewBusMobile] = useState("");
  const [newBusCity, setNewBusCity] = useState("");
  const [newBusAddress, setNewBusAddress] = useState("");
  const [isCreatingBus, setIsCreatingBus] = useState(false);
  const [busModalError, setBusModalError] = useState("");

  // Load Session & Businesses List
  const loadData = useCallback(async () => {
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
      }

      // Fetch businesses list
      const busRes = await fetch("/api/businesses");
      if (busRes.ok) {
        const busData = await busRes.json();
        if (busData.success && Array.isArray(busData.businesses)) {
          setBusinesses(busData.businesses);
          const active =
            busData.businesses.find((b: any) => b.isActiveSelection) ||
            busData.businesses[0] ||
            null;
          setActiveBusiness(active);
        }
      }
    } catch (err) {
      console.error("Failed to load onboarding data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Select / Switch Active Business
  const handleSelectBusiness = async (busId: string) => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/businesses/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: busId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.isAllowed) {
          router.push(data.redirect || "/dashboard");
          router.refresh();
          return;
        }
        await loadData();
      }
    } catch (err) {
      console.error("Failed to switch business:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Add New Business (Strictly created as Inactive with null expiry)
  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusName.trim()) {
      setBusModalError("Business name is required.");
      return;
    }
    const cleanMobile = newBusMobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length < 10) {
      setBusModalError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsCreatingBus(true);
    setBusModalError("");

    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: newBusName.trim(),
          mobileNumber: cleanMobile,
          city: newBusCity.trim(),
          fullAddress: newBusAddress.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setBusModalError(data.error || "Failed to create business.");
      } else {
        setIsAddModalOpen(false);
        setNewBusName("");
        setNewBusMobile("");
        setNewBusCity("");
        setNewBusAddress("");
        await loadData();
      }
    } catch {
      setBusModalError("Network error creating business.");
    } finally {
      setIsCreatingBus(false);
    }
  };

  // Refresh status from Supabase (Checks live database if administrator manually approved)
  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/auth/refresh-session", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.isAllowed) {
          router.push(data.redirect || "/dashboard");
          router.refresh();
          return;
        }
      }
      await loadData();
    } catch {
      await loadData();
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

  // Evaluate active business validity
  const currentExpiry = activeBusiness?.expiry_date ?? null;
  const { isUnexpired, display: formattedExpiry } = parseDateExpiry(currentExpiry);
  const isStatusActive = activeBusiness?.status?.toLowerCase() === "active";
  const isBusinessValid = isStatusActive && isUnexpired;
  const isUserAllowed = userRole === "Staff" ? true : isBusinessValid;

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
            <span className="font-medium text-slate-700 truncate max-w-[140px]">
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
            <svg className="w-3.5 h-3.5 stroke-[2] text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        {loading ? (
          <div className="w-full bg-white rounded-[6px] border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-xs">
            <svg className="animate-spin h-7 w-7 text-[#5e2b9d] mb-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium">Verifying business status with Supabase...</p>
          </div>
        ) : (
          <>
            {/* Header with Title and Add Business Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-[6px] border border-slate-200/90 shadow-2xs">
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Business Onboarding & Access Terminal
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your enterprise organizations and software terminal activation status.
                </p>
              </div>

              {userRole === "Admin" && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer flex-shrink-0"
                >
                  <svg className="w-4 h-4 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Another Business</span>
                </button>
              )}
            </div>

            {/* Selected Business Status Card */}
            {activeBusiness ? (
              <div className="w-full bg-white rounded-[6px] border border-slate-200/90 shadow-sm p-6 sm:p-7 relative overflow-hidden">
                {/* Glow backdrop indicator */}
                <div
                  className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-25"
                  style={{
                    background: isUserAllowed
                      ? "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)"
                      : "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
                  }}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-[6px] flex items-center justify-center font-bold text-base shadow-2xs ${
                        isUserAllowed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {activeBusiness.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{activeBusiness.name}</h2>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] ${
                            isStatusActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isStatusActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                          {activeBusiness.status || "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Owner: {activeBusiness.email} | Mobile: {activeBusiness.mobile_number || "Not Provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleRefreshStatus}
                      disabled={refreshing}
                      className="h-[34px] max-h-[34px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs flex-1 sm:flex-none justify-center"
                    >
                      <svg
                        className={`w-3.5 h-3.5 text-[#5e2b9d] ${refreshing ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{refreshing ? "Checking..." : "Refresh Live Status"}</span>
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6 text-xs">
                  <div className="bg-[#f8fafc] border border-slate-200/80 rounded-[6px] p-3.5">
                    <span className="text-slate-400 block mb-1">Activation Status</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isStatusActive ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {activeBusiness.status || "Inactive"}
                    </span>
                  </div>

                  <div className="bg-[#f8fafc] border border-slate-200/80 rounded-[6px] p-3.5">
                    <span className="text-slate-400 block mb-1">Expiry Date</span>
                    <span
                      className={`font-semibold font-mono ${
                        isUnexpired ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {formattedExpiry}
                    </span>
                  </div>

                  <div className="bg-[#f8fafc] border border-slate-200/80 rounded-[6px] p-3.5">
                    <span className="text-slate-400 block mb-1">Terminal Privilege</span>
                    <span
                      className={`font-semibold ${
                        isUserAllowed ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {isUserAllowed ? "Access Authorized" : "Software Access Blocked"}
                    </span>
                  </div>
                </div>

                {/* Warning notice if Inactive or Expired */}
                {!isUserAllowed ? (
                  <div className="mb-6 p-4 rounded-[6px] bg-amber-50/70 border border-amber-200 text-xs text-amber-800 leading-relaxed flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <strong className="block font-semibold mb-0.5">Software Access Restricted</strong>
                      This business subscription is currently <strong>Inactive</strong> or has an unapproved expiry date.
                      Please ask the system administrator to activate this business manually in the database. Once updated, click <strong>Refresh Live Status</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-3.5 rounded-[6px] bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 leading-relaxed flex items-center gap-2.5">
                    <svg className="w-5 h-5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Business verified and active with valid unexpired license. Ready to enter software.</span>
                  </div>
                )}

                {/* Enter Software CTA */}
                <div className="flex items-center gap-3">
                  {isUserAllowed ? (
                    <Link
                      href="/dashboard"
                      className="h-[38px] max-h-[38px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-semibold text-xs px-6 rounded-[6px] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <span>Enter Software Terminal</span>
                      <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-[38px] max-h-[38px] bg-slate-100 text-slate-400 font-medium text-xs px-6 rounded-[6px] flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Enter Software (Blocked: Awaiting Activation)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* List of All Businesses Owned */}
            <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-5">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
                Your Registered Businesses ({businesses.length})
              </h3>

              <div className="space-y-2.5">
                {businesses.map((bus) => {
                  const bActive = bus.status?.toLowerCase() === "active";
                  const bExpiry = parseDateExpiry(bus.expiry_date);
                  const isCurrent = activeBusiness?.id === bus.id;

                  return (
                    <div
                      key={bus.id}
                      className={`p-3.5 rounded-[6px] border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-purple-50/40 border-[#5e2b9d]/30"
                          : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-[6px] flex items-center justify-center text-xs font-bold ${
                            bActive && bExpiry.isUnexpired
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {bus.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{bus.name}</span>
                            {isCurrent && (
                              <span className="bg-[#5e2b9d] text-white text-[9.5px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                            <span>Mobile: {bus.mobile_number || "—"}</span>
                            <span>Status: <strong className={bActive ? "text-emerald-700" : "text-amber-700"}>{bus.status || "Inactive"}</strong></span>
                            <span>Expiry: <span className="font-mono">{bExpiry.display}</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => handleSelectBusiness(bus.id)}
                            className="h-[30px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 rounded-[6px] transition-all cursor-pointer shadow-2xs"
                          >
                            Switch to this Business
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                            Currently Active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {businesses.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No businesses found. Click &quot;Add Another Business&quot; to create one.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Add Business Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[6px] border border-slate-200 shadow-xl p-6 relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Another Business</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {busModalError && (
              <div className="mb-4 p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {busModalError}
              </div>
            )}

            <form onSubmit={handleCreateBusiness} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-medium text-slate-800 mb-1 block">
                  Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBusName}
                  onChange={(e) => setNewBusName(e.target.value)}
                  placeholder="e.g. Metro Supermarket"
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-800 mb-1 block">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={newBusMobile}
                  onChange={(e) => setNewBusMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-800 mb-1 block">
                  City / Location
                </label>
                <input
                  type="text"
                  value={newBusCity}
                  onChange={(e) => setNewBusCity(e.target.value)}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className="w-full h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-800 mb-1 block">
                  Full Address
                </label>
                <textarea
                  rows={2}
                  value={newBusAddress}
                  onChange={(e) => setNewBusAddress(e.target.value)}
                  placeholder="Store / Office Address"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-[6px] p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-[6px] p-2.5 text-[11px] text-amber-800 leading-relaxed">
                <strong>Policy Notice:</strong> Any newly added business will have status <strong>Inactive</strong> and null expiry date. Activation must be approved manually by an administrator before software terminal access is allowed.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-[34px] px-4 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBus}
                  className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-75"
                >
                  {isCreatingBus ? "Registering..." : "Add Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
