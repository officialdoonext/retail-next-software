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
  expires: string;
  status: "Active" | "Inactive";
}

export default function OnboardingPage() {
  const router = useRouter();
  // Stores initialize empty - no dummy pharmacy data
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("admin@retailnext.com");

  // Form state for adding a new store
  const [newStore, setNewStore] = useState({
    name: "",
    location: "",
    phone: "",
    license: "",
  });

  // Load any previously created stores from localStorage if available
  useEffect(() => {
    try {
      const savedStores = localStorage.getItem("retailnext_stores");
      if (savedStores) {
        const parsed = JSON.parse(savedStores);
        if (Array.isArray(parsed)) {
          setStores(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name.trim()) return;

    const generatedCode = `RET ${Math.floor(1000 + Math.random() * 9000)}`;
    const createdStore: RetailStore = {
      id: Date.now().toString(),
      code: generatedCode,
      name: newStore.name.trim(),
      location: newStore.location.trim() || "Main Branch",
      phone: newStore.phone.trim() || "+91 98745 89654",
      license: newStore.license.trim() || `RET-TS-${Math.floor(1000 + Math.random() * 9000)}`,
      expires: "01 Oct 2027",
      status: "Active",
    };

    const updated = [...stores, createdStore];
    setStores(updated);
    try {
      localStorage.setItem("retailnext_stores", JSON.stringify(updated));
    } catch {
      // ignore
    }

    setNewStore({ name: "", location: "", phone: "", license: "" });
    setIsModalOpen(false);
  };

  const handleDeleteStore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = stores.filter((s) => s.id !== id);
    setStores(updated);
    try {
      localStorage.setItem("retailnext_stores", JSON.stringify(updated));
    } catch {
      // ignore
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
            <span className="font-medium text-slate-700">{userEmail}</span>
            <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
              Admin
            </span>
          </div>

          {/* Log Out Button */}
          <Link
            href="/login"
            className="h-[34px] max-h-[34px] border border-slate-200 rounded-[6px] px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
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
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
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
            onClick={() => setIsModalOpen(true)}
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

        {/* Empty State: Shown if no stores are registered */}
        {stores.length === 0 ? (
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
              No retail stores found for this account. Register your first store to set up the inventory, Point of Sale, and start billing.
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
          /* Stores Grid - matching design reference */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div
                key={store.id}
                className="bg-white rounded-[6px] border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between p-5 sm:p-6 relative group"
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {/* Storefront Icon */}
                      <div className="w-11 h-11 rounded-[6px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
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

                    {/* Active Status Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-[6px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </div>
                  </div>

                  {/* Store Details */}
                  <div className="space-y-2 text-xs text-slate-500 my-4 pt-2 border-t border-slate-100 font-normal">
                    {/* Location */}
                    <div className="flex items-center gap-2.5">
                      <svg
                        className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate">{store.location}</span>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-2.5">
                      <svg
                        className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <span>{store.phone}</span>
                    </div>

                    {/* License / GSTIN */}
                    <div className="flex items-center gap-2.5">
                      <svg
                        className="w-4 h-4 text-slate-400 stroke-[1.8] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="font-mono text-[11px] text-slate-600 truncate">
                        {store.license}
                      </span>
                    </div>

                    {/* Validity */}
                    <div className="flex items-center gap-2.5 text-emerald-700 font-medium">
                      <svg
                        className="w-4 h-4 text-emerald-600 stroke-[1.8] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-[11.5px]">Expires: {store.expires}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="flex-1 h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] active:bg-[#431d73] text-white font-medium text-xs px-4 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Enter Software</span>
                    <svg
                      className="w-3.5 h-3.5 stroke-[2]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </button>

                  {/* Remove store button */}
                  <button
                    type="button"
                    title="Remove Store"
                    onClick={(e) => handleDeleteStore(store.id, e)}
                    className="h-[34px] max-h-[34px] w-[34px] border border-slate-200 rounded-[6px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
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
                  Add details to set up your retail POS & store inventory.
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
                  placeholder="e.g. RetailNext Express Store"
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
                  className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all cursor-pointer shadow-xs"
                >
                  Register Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
