"use client";

import React, { useState, useEffect, useRef } from "react";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

export interface EmployeeSummary {
  id: string;
  employeeId?: string; // 7-digit numeric string
  name: string;
  mobile: string;
  city?: string;
  avatarUrl?: string;
  salaryType?: "monthly" | "daily";
  salaryAmount?: number;
  acceptedLeaves?: number;
  status?: string;
}

interface EmployeeSearchPickerProps {
  selectedEmployee: EmployeeSummary | null;
  onSelectEmployee: (emp: EmployeeSummary | null) => void;
  employees?: EmployeeSummary[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export default function EmployeeSearchPicker({
  selectedEmployee,
  onSelectEmployee,
  employees: propEmployees,
  placeholder = "Search by Employee ID, Name, or Mobile...",
  label = "Select Employee",
  required = false,
  disabled = false,
  helperText,
}: EmployeeSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [internalEmployees, setInternalEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propEmployees && propEmployees.length > 0) {
      setInternalEmployees(propEmployees);
      return;
    }

    let isMounted = true;
    const fetchEmps = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/employees");
        const data = await res.json();
        if (isMounted && res.ok && data.success && Array.isArray(data.employees)) {
          setInternalEmployees(data.employees);
        }
      } catch (err) {
        console.error("Failed to load employees for picker:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEmps();
    return () => {
      isMounted = false;
    };
  }, [propEmployees]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = trimmedQuery
    ? internalEmployees.filter((emp) => {
        const nameMatch = (emp.name || "").toLowerCase().includes(trimmedQuery);
        const idMatch = String(emp.employeeId || "").includes(trimmedQuery);
        const mobileMatch = String(emp.mobile || "").includes(trimmedQuery);
        return nameMatch || idMatch || mobileMatch;
      })
    : [];

  const handleSelect = (emp: EmployeeSummary) => {
    onSelectEmployee(emp);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectEmployee(null);
    setQuery("");
  };

  return (
    <div className="w-full relative font-sans" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {selectedEmployee ? (
        /* Selected Employee Card */
        <div className="flex items-center justify-between p-2 bg-[#f8fafc] border border-slate-200 rounded-[6px]">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedEmployee.avatarUrl ? (
              <img
                src={selectedEmployee.avatarUrl}
                alt={selectedEmployee.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${getFirstLetterColor(
                  getFirstLetter(selectedEmployee.name)
                )}`}
              >
                {getFirstLetter(selectedEmployee.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-slate-900 truncate">
                  {selectedEmployee.name}
                </span>
                {selectedEmployee.employeeId && (
                  <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-mono font-medium bg-[#5e2b9d]/10 text-[#5e2b9d]">
                    #{selectedEmployee.employeeId}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>📱 {selectedEmployee.mobile}</span>
                {selectedEmployee.salaryAmount !== undefined && (
                  <span>
                    • ₹{selectedEmployee.salaryAmount?.toLocaleString()}/
                    {selectedEmployee.salaryType || "mo"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-medium text-slate-500 hover:text-rose-600 px-2 py-1 rounded-[4px] hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer shrink-0 ml-2"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-8 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Floating Dropdown Results */}
          {isOpen && trimmedQuery && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-[6px] shadow-lg border border-slate-200 py-1 divide-y divide-slate-100">
              {loading && internalEmployees.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">Loading employees...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelect(emp)}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {emp.avatarUrl ? (
                        <img
                          src={emp.avatarUrl}
                          alt={emp.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${getFirstLetterColor(
                            getFirstLetter(emp.name)
                          )}`}
                        >
                          {getFirstLetter(emp.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <span>📱 {emp.mobile}</span>
                          {emp.city && <span>• {emp.city}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      {emp.employeeId && (
                        <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-mono font-medium bg-[#5e2b9d]/10 text-[#5e2b9d] block">
                          #{emp.employeeId}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-slate-500">
                  No employee found matching &quot;{query}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {helperText && <p className="text-[10.5px] text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
}
