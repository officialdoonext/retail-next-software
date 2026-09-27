"use client";

import Link from "next/link";
import SoftwareLayout from "@/components/SoftwareLayout";

interface ComingSoonPageProps {
  title: string;
  category?: string;
  description?: string;
  icon?: React.ReactNode;
  features?: string[];
}

export default function ComingSoonPage({
  title,
  category = "Retail Manager",
  description = "This module is currently in development and will be available in the upcoming release.",
  features = [
    "Real-time database synchronization & fast local caching",
    "Comprehensive reporting, filtering & export options",
    "Staff access controls & audit logs",
  ],
}: ComingSoonPageProps) {
  return (
    <SoftwareLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-[#5e2b9d] transition-colors">
            Home
          </Link>
          <span>/</span>
          {category && (
            <>
              <span className="text-slate-500">{category}</span>
              <span>/</span>
            </>
          )}
          <span className="text-[#5e2b9d] font-medium">{title}</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-[6px] border border-slate-200/80 p-8 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
          {/* Subtle Ambient Backlight */}
          <div
            className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(94, 43, 157, 0.25) 0%, rgba(147, 51, 234, 0.08) 50%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto">
            {/* Pulsing Status Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-purple-50 border border-purple-100/90 text-[#5e2b9d] text-xs font-medium mb-5">
              <span className="w-2 h-2 rounded-full bg-[#5e2b9d] animate-pulse" />
              <span>Module Coming Soon</span>
              <span className="text-purple-300">•</span>
              <span className="text-[11px] text-purple-600 font-semibold uppercase tracking-wider">
                {category}
              </span>
            </div>

            {/* Icon / Emblem */}
            <div className="w-16 h-16 rounded-[6px] bg-[#f8fafc] border border-slate-200 flex items-center justify-center text-[#5e2b9d] mb-4 shadow-xs">
              <svg className="w-8 h-8 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal mb-8">
              {description}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-all flex items-center gap-2 shadow-xs"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Dashboard</span>
              </Link>

              <Link
                href="/pos"
                className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-[6px] transition-all flex items-center gap-2 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Open POS Terminal</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Planned Capabilities Grid */}
        <div className="bg-white rounded-[6px] border border-slate-200/80 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Planned Features for {title}
              </h2>
              <p className="text-xs text-slate-400 font-normal">
                What will be built for this section in the next development step.
              </p>
            </div>
            <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-[4px]">
              Ready for Implementation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-[6px] bg-[#f8fafc] border border-slate-200/70 flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-slate-600 leading-snug font-normal">
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SoftwareLayout>
  );
}
