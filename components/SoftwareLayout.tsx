"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SIDEBAR_NAV, NavGroupItem } from "@/lib/nav-pages";
import { usePrinter } from "@/context/PrinterContext";
import ThermalPrinterModal from "@/components/ThermalPrinterModal";

interface SoftwareLayoutProps {
  children?: React.ReactNode;
}

export default function SoftwareLayout({ children }: SoftwareLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [activeStoreName, setActiveStoreName] = useState("Retail Next");
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"Admin" | "Staff" | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffAccess, setStaffAccess] = useState<string[]>([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    "sales-manager": true,
    "product-manager": true,
  });

  const { isConnected: printerConnected, printerType, printerName } = usePrinter();
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  // Initialize roles & access on mount
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

  // Auto-expand accordion that contains the current active route
  useEffect(() => {
    SIDEBAR_NAV.forEach((group) => {
      if (group.children) {
        const hasActiveChild = group.children.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + "/")
        );
        if (hasActiveChild) {
          setOpenAccordions((prev) => ({ ...prev, [group.id]: true }));
        }
      }
    });
  }, [pathname]);

  // Load session & check account validity
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

          // Verify that Admin account is active and plan is not expired
          if (data.user.role === "Admin") {
            const isPlanActive = data.user.status?.toLowerCase() === "active";
            let expiryTime: number | null = null;
            if (data.user.expiryDate) {
              const t = new Date(data.user.expiryDate).getTime();
              if (!isNaN(t)) expiryTime = t;
            }

            const isExpired = !expiryTime || expiryTime <= Date.now();
            if (!isPlanActive || isExpired) {
              router.push("/onboarding");
              return;
            }
          }

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

        if (data.activeStore?.name) {
          setActiveStoreName(data.activeStore.name);
        }
      } catch {
        // ignore
      }
    }

    loadSession();
  }, [router]);

  // Toggle single accordion
  const toggleAccordion = (groupId: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Toggle Collapse All / Expand All
  const areAllOpen = useMemo(() => {
    const accordionGroups = SIDEBAR_NAV.filter((g) => g.children);
    return accordionGroups.every((g) => !!openAccordions[g.id]);
  }, [openAccordions]);

  const handleToggleAllAccordions = () => {
    if (areAllOpen) {
      setOpenAccordions({});
    } else {
      const all: Record<string, boolean> = {};
      SIDEBAR_NAV.forEach((g) => {
        if (g.children) all[g.id] = true;
      });
      setOpenAccordions(all);
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

  // Filter sidebar items for Staff accounts
  const visibleNavGroups = useMemo(() => {
    if (userRole === "Admin") return SIDEBAR_NAV;
    if (userRole === "Staff") {
      return SIDEBAR_NAV.map((group) => {
        if (group.href) {
          return staffAccess.includes(group.href) ? group : null;
        }
        if (group.children) {
          const permittedChildren = group.children.filter((child) =>
            staffAccess.includes(child.href)
          );
          if (permittedChildren.length > 0) {
            return { ...group, children: permittedChildren };
          }
        }
        return null;
      }).filter(Boolean) as NavGroupItem[];
    }
    return SIDEBAR_NAV;
  }, [userRole, staffAccess]);

  const userInitials = mounted
    ? userRole === "Staff"
      ? (staffName || userEmail || "ST").slice(0, 2).toUpperCase()
      : (userEmail || "AD").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-[#fcfcfd] font-sans text-slate-800">
      {/* Top Navbar — Strictly fixed height, pinned at top */}
      <header className="h-[57px] shrink-0 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between z-40">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center" suppressHydrationWarning>
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

        {/* Right: Actions & User Info */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active Store Switcher Button */}
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
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-[6px] shadow-xl py-1 z-50 animate-in fade-in duration-150">
                <Link
                  href="/onboarding"
                  onClick={() => setIsStoreDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Onboarding & Plan</span>
                </Link>
                <Link
                  href="/stores"
                  onClick={() => setIsStoreDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Manage All Stores</span>
                </Link>
              </div>
            )}
          </div>

          {/* Connect Thermal Printer Button */}
          <button
            type="button"
            onClick={() => setIsPrinterModalOpen(true)}
            title={printerConnected ? `Connected: ${printerName || printerType}` : "Connect Thermal Printer"}
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
              {printerConnected ? `Printer Online` : "Connect Printer"}
            </span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-1" suppressHydrationWarning>
            <div
              className="w-[34px] h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0"
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

      {/* Main Workspace: Fills remaining viewport height */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Accordion Sidebar — Fixed 268px width, independent scroll */}
        <aside className="w-[268px] h-full shrink-0 bg-white border-r border-slate-200/80 flex flex-col justify-between">
          {/* Top Quick Actions Header inside Sidebar */}
          <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            <span>Menu</span>
            <button
              type="button"
              onClick={handleToggleAllAccordions}
              className="text-[10.5px] font-medium text-slate-400 hover:text-[#5e2b9d] transition-colors cursor-pointer lowercase"
            >
              {areAllOpen ? "collapse all" : "expand all"}
            </button>
          </div>

          {/* Navigation Accordion List with Sleek Scrollbar */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-0.5 custom-sidebar-scroll select-none">
            {visibleNavGroups.map((group) => {
              // Direct Link (Dashboard, POS, Stores)
              if (group.href) {
                const isActive = pathname === group.href;
                return (
                  <Link
                    key={group.id}
                    href={group.href}
                    className={`h-[36px] px-3 rounded-[6px] flex items-center gap-2.5 text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-[#5e2b9d] text-white shadow-xs"
                        : "text-slate-700 hover:bg-purple-50/70 hover:text-[#5e2b9d]"
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {Array.isArray(group.icon) ? (
                        group.icon.map((d, i) => (
                          <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={d} />
                        ))
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={group.icon} />
                      )}
                    </svg>
                    <span className="truncate">{group.label}</span>
                  </Link>
                );
              }

              // Accordion with Child Menus
              const isOpen = !!openAccordions[group.id];
              const hasActiveChild = group.children?.some(
                (c) => pathname === c.href || pathname.startsWith(c.href + "/")
              );

              return (
                <div key={group.id} className="flex flex-col">
                  {/* Accordion Header Button */}
                  <button
                    type="button"
                    onClick={() => toggleAccordion(group.id)}
                    className={`h-[36px] px-3 rounded-[6px] flex items-center justify-between text-[13px] font-medium transition-colors text-left cursor-pointer ${
                      hasActiveChild
                        ? "text-[#5e2b9d] font-semibold bg-purple-50/60"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <svg
                        className={`w-4 h-4 shrink-0 ${hasActiveChild ? "text-[#5e2b9d]" : "text-slate-400"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {Array.isArray(group.icon) ? (
                          group.icon.map((d, i) => (
                            <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={d} />
                          ))
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={group.icon} />
                        )}
                      </svg>
                      {/* Ensures long titles like 'Return & Exchange Manager' fit comfortably without truncation */}
                      <span className="whitespace-nowrap">{group.label}</span>
                    </div>

                    {/* Rotating Chevron */}
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${
                        isOpen ? "rotate-180 text-[#5e2b9d]" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Accordion Submenu Items */}
                  {isOpen && group.children && (
                    <div className="flex flex-col ml-4 pl-2.5 border-l-2 border-slate-100 py-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      {group.children.map((child) => {
                        const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            className={`h-[32px] px-2.5 rounded-[4px] flex items-center gap-2 text-[13px] font-medium transition-colors truncate ${
                              isChildActive
                                ? "bg-[#5e2b9d] text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isChildActive ? "bg-white" : "bg-slate-300"
                              }`}
                            />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Pinned Bottom Sidebar Footer */}
          <div className="shrink-0 px-3.5 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between text-[11px] text-slate-400">
            <Link
              href="/onboarding"
              className="flex items-center gap-1.5 hover:text-[#5e2b9d] transition-colors"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Onboarding</span>
            </Link>
            <span className="text-[10px] text-slate-400 font-mono">RetailNext</span>
          </div>
        </aside>

        {/* Page Content Container — Independent Scroll */}
        <main className="flex-1 h-full overflow-y-auto bg-[#fcfcfd] p-3 sm:p-4">
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
