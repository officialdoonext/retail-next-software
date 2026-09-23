"use client";

import React, { useState, useEffect, useRef } from "react";

interface CustomMonthPickerProps {
  value: string; // YYYY-MM
  onChange: (monthStr: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
}

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CustomMonthPicker({
  value,
  onChange,
  label,
  placeholder = "Select Month",
  disabled = false,
  className = "",
  align = "left",
}: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view year from value or today
  const [viewYear, setViewYear] = useState(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      return Number(value.split("-")[0]);
    }
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      setViewYear(Number(value.split("-")[0]));
    }
  }, [value]);

  // Click outside to close popover
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  // Auto flip upward if close to bottom of screen
  const [openUpward, setOpenUpward] = useState(false);
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 250 && rect.top > 250) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((y) => y - 1);
  };

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((y) => y + 1);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const formatted = `${viewYear}-${mm}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleCurrentMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, "0");
    onChange(`${curYear}-${curMonth}`);
    setViewYear(curYear);
    setIsOpen(false);
  };

  // Formatted display: e.g. "September 2026"
  const formattedDisplay = (() => {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return "";
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      return `${MONTH_FULL[m - 1]} ${y}`;
    }
    return value;
  })();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  return (
    <div className={`relative font-sans ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-medium flex items-center justify-between gap-2.5 transition-colors focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed ${
          isOpen ? "bg-white border-[#5e2b9d] ring-1 ring-[#5e2b9d]" : "hover:bg-white"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <svg className="w-3.5 h-3.5 text-[#5e2b9d] shrink-0 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={formattedDisplay ? "text-slate-900" : "text-slate-400 font-normal"}>
            {formattedDisplay || placeholder}
          </span>
        </div>

        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-[#5e2b9d]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Month Picker Popover (Floating above everything: z-[9999]) */}
      {isOpen && (
        <div
          className={`absolute z-[9999] ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${
            align === "right" ? "right-0" : "left-0"
          } bg-white border border-slate-200 rounded-[6px] shadow-2xl p-3 w-[260px] select-none animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header Year Navigator */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevYear}
              className="w-6 h-6 rounded-[4px] hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Previous Year"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-xs font-medium text-slate-900">
              {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextYear}
              className="w-6 h-6 rounded-[4px] hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Next Year"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 12 Months Grid (3 columns x 4 rows) */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((name, idx) => {
              const mmStr = String(idx + 1).padStart(2, "0");
              const isSelected = value === `${viewYear}-${mmStr}`;
              const isCurrent = viewYear === currentYear && idx === currentMonthIdx;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={`py-2 px-1 text-xs rounded-[4px] font-medium transition-all text-center cursor-pointer ${
                    isSelected
                      ? "bg-[#5e2b9d] text-white shadow-xs"
                      : isCurrent
                      ? "text-[#5e2b9d] border border-[#5e2b9d]/30 bg-purple-50/50 hover:bg-purple-50"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Quick Footer */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="text-[#5e2b9d] font-medium hover:underline cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
