"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_PAGES } from "@/lib/nav-pages";
import { usePrinter } from "@/context/PrinterContext";
import ThermalPrinterModal from "@/components/ThermalPrinterModal";

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
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"Admin" | "Staff" | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffAccess, setStaffAccess] = useState<string[]>([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const { isConnected: printerConnected, printerType, printerName } = usePrinter();
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<{ label: string; top: number } | null>(null);

  // Synchronize on mount to eliminate SSR mismatch while keeping instant render
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("staff_role");
      if (storedRole === "Staff" || storedRole === "Admin") {
        setUserRole(storedRole);
      }
      const storedName = localStorage.getItem("staff_name");
      if (storedName) setStaffName(storedName);
      try {
        const storedAccess = localStorage.getItem("staff_access");
        if (storedAccess) setStaffAccess(JSON.parse(storedAccess));
      } catch {}
    }
  }, []);

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
          setUserRole(data.user.role || "Admin");
          setStaffName(data.user.staffName || "");
          setStaffAccess(data.user.access || []);

          if (typeof window !== "undefined") {
            localStorage.setItem("staff_role", data.user.role || "Admin");
            if (data.user.staffName) {
              localStorage.setItem("staff_name", data.user.staffName);
            }
            if (data.user.role === "Staff") {
              localStorage.setItem("staff_access", JSON.stringify(data.user.access || []));
            } else {
              localStorage.removeItem("staff_access");
            }
          }
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
        if (data.access && typeof window !== "undefined") {
          localStorage.setItem("staff_access", JSON.stringify(data.access));
        }
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

  // Nav items: Admin sees all; Staff only sees assigned permissions in staffAccess.
  // Guard: if userRole is null (uninitialized), do not default to showing all menus to prevent any flash/delay!
  const accessiblePages = NAV_PAGES.filter((page) => {
    if (userRole === "Staff") {
      return staffAccess.includes(page.href);
    }
    if (userRole === null) {
      return false;
    }
    return true;
  });

  const navItems = accessiblePages.map((page) => ({
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

  const userInitials = mounted
    ? userRole === "Staff"
      ? (staffName || userEmail || "ST").slice(0, 2).toUpperCase()
      : (userEmail || "AD").slice(0, 2).toUpperCase()
    : "AD";

  const brandHomeHref =
    mounted && userRole === "Staff"
      ? staffAccess.includes("/dashboard")
        ? "/dashboard"
        : staffAccess[0] || "/pos"
      : "/dashboard";

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfd] font-sans text-slate-800">
      {/* Top Bar */}
      <header className="h-[57px] bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href={brandHomeHref} className="flex items-center" suppressHydrationWarning>
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
                {/* <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
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
                </div> */}

                {/* <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
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
                </div> */}

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <Link
                    href="/onboarding"
                    onClick={() => setIsStoreDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>{userRole === "Staff" ? "Switch Store" : "Switch Store"}</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Connect Printer Button */}
          <button
            type="button"
            onClick={() => setIsPrinterModalOpen(true)}
            title={printerConnected ? `Connected: ${printerName || printerType} (Click to manage)` : "Connect Thermal Printer (WebUSB / Bluetooth)"}
            className={`h-[34px] max-h-[34px] border rounded-[6px] px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
              printerConnected
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                printerConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline">
              {printerConnected ? `Printer Online (${printerType})` : "Connect Printer"}
            </span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-1" suppressHydrationWarning>
            <div
              className="w-[34px] h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium flex items-center justify-center flex-shrink-0"
              suppressHydrationWarning
            >
              {userInitials}
            </div>
            <div className="hidden md:flex flex-col text-left" suppressHydrationWarning>
              <span
                className="text-xs font-medium text-slate-800 leading-tight max-w-[140px] truncate"
                suppressHydrationWarning
              >
                {mounted ? (userRole === "Staff" ? staffName || "Staff Member" : userEmail || "Admin") : "Admin"}
              </span>
              <span
                suppressHydrationWarning
                className={`text-[10px] leading-tight ${
                  mounted && userRole === "Staff" ? "text-purple-600 font-medium" : "text-slate-400 font-normal"
                }`}
              >
                {mounted && userRole === "Staff" ? "Staff Terminal" : "Administrator"}
              </span>
            </div>
          </div>

          {/* Watch Intro Video Button */}
          <button
            type="button"
            title="Watch Welcome Video"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("open-retail-welcome"));
              }
            }}
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Quick Settings Icon - Only if Admin or if Staff has settings access */}
          {mounted && (userRole === "Admin" || staffAccess.includes("/settings")) && (
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
          )}

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
        <aside className="w-[90px] bg-white border-r border-slate-200/80 flex flex-col justify-between py-3 flex-shrink-0 sticky top-[57px] h-[calc(100vh-57px)] overflow-x-hidden">
          {/* Top Nav Items */}
          <nav
            className="flex flex-col items-center gap-1 px-1.5 overflow-y-auto overflow-x-hidden flex-1 select-none"
            onScroll={() => setHoveredNav(null)}
            suppressHydrationWarning
          >
            {!mounted || (navItems.length === 0 && userRole === null) ? (
              <div className="flex flex-col items-center gap-2 py-2 w-full animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-[76px] h-[52px] rounded-[6px] bg-slate-100 flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-200" />
                    <div className="w-8 h-2 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : (
              navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredNav({
                        label: item.label,
                        top: rect.top + rect.height / 2,
                      });
                    }}
                    onMouseLeave={() => setHoveredNav(null)}
                    className={`w-[76px] py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-[6px] transition-all duration-150 relative ${
                      isActive
                        ? "bg-[#5e2b9d] text-white shadow-xs"
                        : "text-slate-500 hover:text-[#5e2b9d] hover:bg-purple-50/60"
                    }`}
                  >
                    <span className="flex items-center justify-center">
                      {item.icon}
                    </span>
                    <span className="text-[11px] font-medium leading-tight text-center w-full max-w-[68px] truncate block">
                      {item.label}
                    </span>
                  </Link>
                );
              })
            )}
          </nav>

          {/* Floating Popover on Hover for Menu Names */}
          {hoveredNav && (
            <div
              style={{ top: hoveredNav.top }}
              className="fixed left-[94px] -translate-y-1/2 z-[999] pointer-events-none flex items-center animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="relative bg-[#5e2b9d] text-white text-xs font-semibold px-2.5 py-1 rounded-[6px] shadow-md whitespace-nowrap flex items-center gap-1.5">
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#5e2b9d] rotate-45" />
                <span className="relative z-10">{hoveredNav.label}</span>
              </div>
            </div>
          )}

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

      {/* Thermal Printer Hardware Connection Modal */}
      <ThermalPrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </div>
  );
}
