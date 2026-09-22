"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_PAGES } from "@/lib/nav-pages";

interface SoftwareLayoutProps {
  children?: React.ReactNode;
}

export default function SoftwareLayout({ children }: SoftwareLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeStoreName, setActiveStoreName] = useState("Loading Store...");
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    expires?: string | null;
    isActiveSelection?: boolean;
  }>>([]);
  const [switchingStore, setSwitchingStore] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUserEmail(data.user.email);
        }

        let currentActiveId: string | null = null;
        if (data.activeStore) {
          setActiveStoreName(data.activeStore.name);
          setActiveStoreId(data.activeStore.id);
          currentActiveId = data.activeStore.id;
        }

        // Fetch stores to populate switcher and fallback if needed
        const storesRes = await fetch("/api/stores");
        if (storesRes.ok) {
          const storesData = await storesRes.json();
          if (storesData.success && Array.isArray(storesData.stores)) {
            setUserStores(storesData.stores);
            const activeId = storesData.activeStoreId || currentActiveId;
            if (activeId) {
              const matched = storesData.stores.find((s: any) => s.id === activeId);
              if (matched) {
                setActiveStoreName(matched.name);
                setActiveStoreId(matched.id);
              }
            } else {
              const firstActive = storesData.stores.find(
                (s: any) => s.status === "Active" && s.expires && new Date(s.expires).getTime() > Date.now()
              );
              if (firstActive) {
                setActiveStoreName(firstActive.name);
                setActiveStoreId(firstActive.id);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    loadSession();
  }, [router]);

  const handleSwitchStore = async (targetStore: { id: string; status: string; expires?: string | null; name: string }) => {
    if (targetStore.id === activeStoreId) {
      setIsStoreDropdownOpen(false);
      return;
    }

    const isUnexpired = targetStore.expires && new Date(targetStore.expires).getTime() > Date.now();
    if (targetStore.status !== "Active" || !isUnexpired) {
      alert("This store is inactive or awaiting admin approval.");
      return;
    }

    try {
      setSwitchingStore(true);
      const res = await fetch("/api/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: targetStore.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsStoreDropdownOpen(false);
        // Force complete page reload to reset all in-memory cart, products, categories, orders for newly selected store
        window.location.reload();
      } else {
        alert(data.error || "Failed to switch store terminal.");
        setSwitchingStore(false);
      }
    } catch {
      alert("Network error while switching store.");
      setSwitchingStore(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // Nav items are sourced from the shared NAV_PAGES list (lib/nav-pages.ts)
  // Adding a new page there automatically shows it in the sidebar AND in Staff access control.
  const navItems = NAV_PAGES.map((page) => ({
    label: page.label,
    href: page.href,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {Array.isArray(page.iconPath)
          ? page.iconPath.map((d, i) => (
              <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={d} />
            ))
          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={page.iconPath} />}
      </svg>
    ),
  }));

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "AD";

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfd] font-sans text-slate-800">
      {/* Top Bar */}
      <header className="h-[57px] bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/logo.jpeg"
              alt="RetailNext Logo"
              width={150}
              height={38}
              priority
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Right: Actions & User Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active Store Switcher Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
              className="h-[34px] max-h-[34px] bg-[#f8fafc] border border-slate-200/90 rounded-[6px] px-3 flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#5e2b9d] inline-block" />
              <span className="max-w-[130px] truncate">{activeStoreName}</span>
              <svg className="w-3 h-3 text-slate-400 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isStoreDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-[6px] shadow-xl py-1.5 z-50 animate-in fade-in duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                    Your Stores
                  </span>
                  {switchingStore && (
                    <span className="text-[10px] text-[#5e2b9d] font-medium flex items-center gap-1">
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Switching...
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                  {userStores.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">Loading stores...</div>
                  ) : (
                    userStores.map((st) => {
                      const isCurrent = st.id === activeStoreId;
                      const isUnexpired = st.expires && new Date(st.expires).getTime() > Date.now();
                      const isActive = st.status === "Active" && isUnexpired;

                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSwitchStore(st)}
                          disabled={switchingStore || !isActive}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                            isCurrent
                              ? "bg-purple-50/70 text-[#5e2b9d] font-medium cursor-default"
                              : isActive
                              ? "text-slate-700 hover:bg-slate-50 cursor-pointer"
                              : "text-slate-400 bg-slate-50/40 cursor-not-allowed"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-400"}`} />
                              <span className="text-xs truncate block font-medium">
                                {st.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block pl-3">
                              {st.code} {!isActive && "• (Inactive)"}
                            </span>
                          </div>

                          {isCurrent && (
                            <svg className="w-4 h-4 text-[#5e2b9d] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <Link
                    href="/onboarding"
                    onClick={() => setIsStoreDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Manage / Add New Store</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Connect Printer Button */}
          <button
            type="button"
            onClick={() => setPrinterConnected(!printerConnected)}
            className={`h-[34px] max-h-[34px] border rounded-[6px] px-3 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
              printerConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline">
              {printerConnected ? "Printer Online" : "Connect Printer"}
            </span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-[34px] h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium flex items-center justify-center flex-shrink-0">
              {userInitials}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-medium text-slate-800 leading-tight max-w-[140px] truncate">
                {userEmail || "Admin"}
              </span>
              <span className="text-[10px] font-normal text-slate-400 leading-tight">
                Administrator
              </span>
            </div>
          </div>

          {/* Quick Settings Icon */}
          <Link
            href="/settings"
            title="Settings"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            title="Log Out"
            onClick={handleLogout}
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex min-h-[calc(100vh-57px)]">
        {/* Left Sidebar - 90px width */}
        <aside className="w-[90px] bg-white border-r border-slate-200/80 flex flex-col justify-between py-3 flex-shrink-0 sticky top-[57px] h-[calc(100vh-57px)]">
          {/* Top Nav Items */}
          <nav className="flex flex-col items-center gap-1 px-1.5 overflow-y-auto flex-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-[76px] py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-[6px] transition-all duration-150 ${
                    isActive
                      ? "bg-[#5e2b9d] text-white shadow-xs"
                      : "text-slate-500 hover:text-[#5e2b9d] hover:bg-purple-50/60"
                  }`}
                >
                  <span className="flex items-center justify-center">
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-center">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Sidebar Action: Switch Store / Onboarding */}
          <div className="px-1.5 flex flex-col items-center pt-2 border-t border-slate-100">
            <Link
              href="/onboarding"
              title="Store Switcher"
              className="w-[56px] h-[34px] rounded-[6px] flex items-center justify-center text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors"
            >
              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </Link>
          </div>
        </aside>

        {/* Page Content Container */}
        <main className="flex-1 bg-[#fcfcfd] p-4 sm:p-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
