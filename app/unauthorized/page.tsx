"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NAV_PAGES } from "@/lib/nav-pages";

export default function UnauthorizedPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [storeName, setStoreName] = useState("");
  const [allowedAccess, setAllowedAccess] = useState<string[]>([]);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUserName(data.user.staffName || data.user.email || "Account");
            setUserRole(data.user.role);
            setAllowedAccess(data.user.access || []);
            setEnabledModules(data.user.enabledModules || []);
          }
          if (data.activeStore) {
            setStoreName(data.activeStore.name);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, []);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        document.cookie = "client_modules=; path=/; max-age=0;";
        localStorage.removeItem("client_enabled_modules");
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const isAdmin = userRole === "Admin";
  const defaultAllowedRoute = isAdmin ? "/dashboard" : allowedAccess[0] || "/pos";
  const allowedNavPages = isAdmin
    ? NAV_PAGES.filter((p) => {
        if (p.href === "/dashboard") return true;
        return true;
      })
    : NAV_PAGES.filter((p) => allowedAccess.includes(p.href));

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[6px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 sm:p-8 flex flex-col items-center text-center">
        {/* Brand Logo */}
        <div className="mb-6">
          <Image
            src="/logo.jpeg"
            alt="RetailNext Logo"
            width={160}
            height={44}
            priority
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Shield Alert Icon */}
        <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
          <svg className="w-7 h-7 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0112 3.464zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight mb-1">
          {isAdmin ? "Module Disabled" : "Access Restricted"}
        </h1>
        <p className="text-xs text-slate-500 font-normal max-w-sm mb-5 leading-relaxed">
          {isAdmin
            ? "This software module is not enabled for your organization's account. Please contact your administrator to activate this module."
            : "Your staff account does not have permission to access this module. Please contact your store manager if you require access."}
        </p>

        {/* User / Store Status Pill */}
        {!loading && (
          <div className="w-full bg-[#f8fafc] border border-slate-200/80 rounded-[6px] p-3 mb-5 text-left text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-500">{isAdmin ? "Client Account:" : "Staff Account:"}</span>
              <span className="font-medium text-slate-800">{userName}</span>
            </div>
            {storeName && (
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-500">Active Store:</span>
                <span className="font-medium text-slate-800 truncate max-w-[200px]">
                  {storeName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Account Type:</span>
              <span className="bg-purple-100 text-[#5e2b9d] text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                {userRole || (isAdmin ? "Admin" : "Staff")}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-2">
          <Link
            href={defaultAllowedRoute}
            className="flex-1 h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-4 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{isAdmin ? "Return to Dashboard" : "Return to Terminal"}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="h-[34px] max-h-[34px] border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs px-4 rounded-[6px] transition-all flex items-center justify-center cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
