"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RetailStore {
  id: string;
  code: string;
  name: string;
  location: string;
  phone: string;
  license: string;
  expires: any;
  status: "Active" | "Inactive";
}

function parseExpiry(expires: any): { isUnexpired: boolean; display: string } {
  if (!expires) return { isUnexpired: false, display: "" };
  let time: number | null = null;
  let display = "";

  if (typeof expires === "string" || typeof expires === "number") {
    const t = new Date(expires).getTime();
    if (!isNaN(t)) {
      time = t;
      display = typeof expires === "string" ? expires : new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  } else if (typeof expires === "object" && expires !== null) {
    if (typeof expires.toDate === "function") {
      const d = expires.toDate();
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } else if ("seconds" in expires) {
      const d = new Date(expires.seconds * 1000);
      time = d.getTime();
      display = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }

  return {
    isUnexpired: time !== null && time > Date.now(),
    display: display || String(expires),
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form state for registering a new store
  const [newStore, setNewStore] = useState({
    name: "",
    location: "",
    phone: "",
    license: "",
  });

  // Fetch authenticated session and stores
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch authenticated session
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/login");
          return;
        }
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          setUserEmail(meData.user.email);
        }

        // 2. Fetch stores from Firestore
        const storesRes = await fetch("/api/stores");
        if (storesRes.ok) {
          const storesData = await storesRes.json();
          if (storesData.success && Array.isArray(storesData.stores)) {
            setStores(storesData.stores);
          }
        }
      } catch (err) {
        console.error("Failed to load onboarding data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Handle register new store
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name.trim()) return;

    setSubmitting(true);
    setActionError("");

    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStore),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.error || "Failed to create store.");
      } else {
        // Store is created in Inactive state with no expiry
        setStores((prev) => [...prev, data.store]);
        setNewStore({ name: "", location: "", phone: "", license: "" });
        setIsModalOpen(false);
      }
    } catch {
      setActionError("Error saving store. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Select store and enter software
  const handleEnterSoftware = async (store: RetailStore) => {
    setActionError("");

    // Check client-side first
    const isExpired = !store.expires || new Date(store.expires).getTime() <= Date.now();
    if (store.status !== "Active" || isExpired) {
      setActionError(
        "This store is Inactive or awaiting admin approval. You cannot enter the software until an administrator activates it."
      );
      return;
    }

    try {
      const res = await fetch("/api/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.error || "Access denied. Store is not active.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setActionError("Failed to connect to store terminal.");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

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
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="font-medium text-slate-700">{userEmail || "Authenticated Admin"}</span>
            <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
              Admin
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
        {/* Error Alert */}
        {actionError && (
          <div className="mb-6 p-3.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-rose-600 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError("")}
              className="text-rose-500 hover:text-rose-800 text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Heading & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium text-slate-900 tracking-tight">
              Retail Stores
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Select an active, verified store to launch the software or register a new store.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActionError("");
              setIsModalOpen(true);
            }}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs sm:text-sm px-4 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <svg
              className="w-4 h-4 stroke-[2.2]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Store</span>
          </button>
        </div>

        {loading ? (
          /* Loading State */
          <div className="w-full bg-white rounded-[6px] border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
            <svg className="animate-spin h-6 w-6 text-[#5e2b9d] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium">Loading registered stores...</p>
          </div>
        ) : stores.length === 0 ? (
          /* Empty State: Exactly when no stores are registered for this user */
          <div className="w-full bg-white rounded-[6px] border border-dashed border-slate-300/80 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="w-14 h-14 rounded-[6px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 stroke-[1.75]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-base sm:text-lg font-medium text-slate-800 mb-1">
              No Stores Registered
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed font-normal">
              No retail stores have been registered under this account yet. Click below to register your store details.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Your First Store</span>
            </button>
          </div>
        ) : (
          /* Stores Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => {
              const isUnexpired = store.expires && new Date(store.expires).getTime() > Date.now();
              const isStoreActive = store.status === "Active" && isUnexpired;

              return (
                <div
                  key={store.id}
                  className={`bg-white rounded-[6px] border shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all flex flex-col justify-between p-5 sm:p-6 relative ${
                    isStoreActive
                      ? "border-slate-200/90 hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)]"
                      : "border-amber-200/80 bg-slate-50/30"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {/* Storefront Icon */}
                        <div
                          className={`w-11 h-11 rounded-[6px] border flex items-center justify-center flex-shrink-0 ${
                            isStoreActive
                              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                              : "bg-amber-50 border-amber-200/70 text-amber-600"
                          }`}
                        >
                          <svg
                            className="w-6 h-6 stroke-[1.75]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                        </div>

                        <div>
                          <span className="text-[10.5px] font-medium text-slate-400 tracking-wider uppercase block">
                            {store.code}
                          </span>
                          <h3 className="text-base font-medium text-slate-900 leading-tight">
                            {store.name}
                          </h3>
                        </div>
                      </div>

                      {/* Status Badge: Active vs Inactive */}
                      <div className="flex items-center gap-1.5">
                        {isStoreActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-[6px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-[6px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Store Details */}
                    <div className="space-y-2 text-xs text-slate-500 my-4 pt-2 border-t border-slate-100 font-normal">
                      {/* Location */}
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{store.location}</span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{store.phone}</span>
                      </div>

                      {/* License / GSTIN */}
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-mono text-[11px] text-slate-600 truncate">
                          {store.license}
                        </span>
                      </div>

                      {/* Validity Status */}
                      <div className="flex items-center gap-2.5 font-medium">
                        <svg
                          className={`w-4 h-4 stroke-[1.8] flex-shrink-0 ${
                            isStoreActive ? "text-emerald-600" : "text-amber-500"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isStoreActive ? (
                          <span className="text-[11.5px] text-emerald-700">Expires: {store.expires}</span>
                        ) : (
                          <span className="text-[11px] text-amber-700">
                            Awaiting Activation (No Expiry Set)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action & Strict Activation State */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    {isStoreActive ? (
                      <button
                        type="button"
                        onClick={() => handleEnterSoftware(store)}
                        className="w-full h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs px-4 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Enter Software</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled
                          className="w-full h-[34px] max-h-[34px] bg-slate-100 text-slate-400 font-medium text-xs px-4 rounded-[6px] flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>Store Disabled (Inactive)</span>
                        </button>
                        <p className="text-[10px] text-amber-600/90 text-center font-normal leading-tight">
                          Awaiting manual activation by administrator.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add New Retail Store Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-xl w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-medium text-slate-900">
                  Register New Retail Store
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Add details to submit store for administrator activation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Store Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RetailNext Supermart"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Location / City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad, Telangana"
                  value={newStore.location}
                  onChange={(e) => setNewStore({ ...newStore, location: e.target.value })}
                  className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98745 89654"
                  value={newStore.phone}
                  onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })}
                  className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  GSTIN / Retail Trade License
                </label>
                <input
                  type="text"
                  placeholder="e.g. 36AAACT1234F1Z0 / RET-TS-2026"
                  value={newStore.license}
                  onChange={(e) => setNewStore({ ...newStore, license: e.target.value })}
                  className="w-full h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200 rounded-[6px] px-3 text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <strong>Notice:</strong> Newly registered stores are created as <em>Inactive</em> with no expiry. An administrator will manually verify and activate this store before terminal access is granted.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all cursor-pointer shadow-xs disabled:opacity-75"
                >
                  {submitting ? "Registering..." : "Register Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
