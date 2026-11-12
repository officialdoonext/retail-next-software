"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import QRCode from "qrcode";
import {
  IdCard,
  Search,
  Printer,
  Sliders,
  CheckSquare,
  Square,
  X,
  Building2,
  Phone,
  QrCode as QrIcon,
  Sparkles,
  Save,
  User,
} from "lucide-react";

interface Employee {
  id: string;
  employee_id?: string;
  name: string;
  designation?: string;
  role?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  qr_code_url?: string;
  status?: string;
  store_name?: string;
}

interface IdCardDesign {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textDarkColor: string;
  textLightColor: string;
  showName: boolean;
  showEmpId: boolean;
  showMobile: boolean;
  showQr: boolean;
  bgPattern: "dots" | "lines" | "none";
}

const DEFAULT_DESIGN: IdCardDesign = {
  primaryColor: "#5e2b9d",
  secondaryColor: "#7c3aed",
  accentColor: "#a78bfa",
  textDarkColor: "#1a1a2e",
  textLightColor: "#6b7280",
  showName: true,
  showEmpId: true,
  showMobile: true,
  showQr: true,
  bgPattern: "dots",
};

export default function IdCardsPage() {
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});
  const [design, setDesign] = useState<IdCardDesign>(DEFAULT_DESIGN);
  const [savingDesign, setSavingDesign] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Single Card Print Preview Modal
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);

  // 1. Fetch Employees and Design
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, designRes] = await Promise.all([
        fetch("/api/employees?all=true"),
        fetch("/api/employees/id-card"),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        if (empData.success && Array.isArray(empData.employees)) {
          const activeList = empData.employees.filter(
            (e: any) => e.status !== "Terminated" && e.status !== "Inactive"
          );
          setEmployees(activeList);

          // Generate QR codes for all employees
          const qrs: Record<string, string> = {};
          await Promise.all(
            activeList.map(async (emp: Employee) => {
              const codePayload = emp.employee_id || emp.id;
              try {
                const url = await QRCode.toDataURL(codePayload, {
                  margin: 1,
                  width: 140,
                  color: { dark: "#1a1a2e", light: "#ffffff" },
                });
                qrs[emp.id] = url;
              } catch (qrErr) {
                console.error("QR gen error for:", emp.id, qrErr);
              }
            })
          );
          setQrCodeMap(qrs);
        }
      }

      if (designRes.ok) {
        const dData = await designRes.json();
        if (dData.success && dData.design) {
          setDesign((prev) => ({ ...prev, ...dData.design }));
        }
      }
    } catch (err) {
      console.error("Failed loading ID cards data:", err);
      toast.error("Network error while loading staff list.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Custom Badge Design
  const handleSaveDesign = async () => {
    try {
      setSavingDesign(true);
      const res = await fetch("/api/employees/id-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Card design settings saved!");
        setIsDesignModalOpen(false);
      } else {
        toast.error(data.error || "Failed to save design.");
      }
    } catch (err) {
      console.error("Design save error:", err);
      toast.error("Failed to save card design settings.");
    } finally {
      setSavingDesign(false);
    }
  };

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        emp.name.toLowerCase().includes(q) ||
        (emp.employee_id && emp.employee_id.toLowerCase().includes(q)) ||
        (emp.mobile && emp.mobile.includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q));

      const matchDesignation =
        designationFilter === "all" ||
        (emp.designation && emp.designation.toLowerCase() === designationFilter.toLowerCase());

      return matchSearch && matchDesignation;
    });
  }, [employees, searchQuery, designationFilter]);

  // Available unique designations
  const designations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.designation) set.add(e.designation);
    });
    return Array.from(set);
  }, [employees]);

  // Pagination Slice
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    const allSelected = paginatedEmployees.every((e) => selectedIds.has(e.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        paginatedEmployees.forEach((e) => next.delete(e.id));
      } else {
        paginatedEmployees.forEach((e) => next.add(e.id));
      }
      return next;
    });
  };

  // Trigger Print (either selected cards or preview)
  const handlePrint = (employee?: Employee) => {
    if (employee) {
      setPreviewEmployee(employee);
      setTimeout(() => {
        window.print();
      }, 200);
    } else {
      if (selectedIds.size === 0) {
        toast.error("Please select at least one employee badge to print.");
        return;
      }
      setPreviewEmployee(null);
      setTimeout(() => {
        window.print();
      }, 200);
    }
  };

  // Employees ready for batch print (either selected or all paginated if printing batch)
  const printList = useMemo(() => {
    if (previewEmployee) return [previewEmployee];
    if (selectedIds.size > 0) {
      return employees.filter((e) => selectedIds.has(e.id));
    }
    return paginatedEmployees;
  }, [previewEmployee, selectedIds, employees, paginatedEmployees]);

  return (
    <SoftwareLayout>
      <div className="space-y-5">
        {/* Sub Navigation */}
        <EmployeeSubNav />

        {/* Page Top Header Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0 border border-purple-100">
                <IdCard className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Staff ID Card Badges
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate, style, and print professional employee identity badges with scannable attendance QR codes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Customize Design */}
              <button
                type="button"
                onClick={() => setIsDesignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#5e2b9d]" />
                Badge Styling
              </button>

              {/* Print Selected Badges */}
              <button
                type="button"
                onClick={() => handlePrint()}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  Print Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Select All on Page */}
            <button
              type="button"
              onClick={handleSelectAllOnPage}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#5e2b9d] transition-colors cursor-pointer shrink-0"
            >
              {paginatedEmployees.length > 0 &&
              paginatedEmployees.every((e) => selectedIds.has(e.id)) ? (
                <CheckSquare className="w-4 h-4 text-[#5e2b9d]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select Page ({paginatedEmployees.length})</span>
            </button>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, ID or role..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={designationFilter}
              onChange={(e) => {
                setDesignationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Designations</option>
              {designations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-500 font-medium ml-1">
              {filteredEmployees.length} active badge(s)
            </span>
          </div>
        </div>

        {/* Badges Grid (Screen View) */}
        <div className="print:hidden">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400">
              <Spinner className="w-8 h-8 text-[#5e2b9d] mb-2" />
              <p className="text-xs">Generating employee identity badges...</p>
            </div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400">
              <IdCard className="w-10 h-10 stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No active employees found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Register new employees in the Directory to generate their identity badges.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {paginatedEmployees.map((emp) => {
                  const isSelected = selectedIds.has(emp.id);
                  const qr = qrCodeMap[emp.id];

                  return (
                    <div
                      key={emp.id}
                      className={`relative bg-white rounded-xl border transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col overflow-hidden group ${
                        isSelected
                          ? "border-[#5e2b9d] ring-2 ring-[#5e2b9d]/20"
                          : "border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      {/* Checkbox selector */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(emp.id)}
                        className="absolute top-2.5 left-2.5 z-10 p-1 bg-white/90 backdrop-blur-xs rounded-md shadow-2xs hover:bg-white text-slate-600 transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#5e2b9d]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {/* Print quick action */}
                      <button
                        type="button"
                        onClick={() => handlePrint(emp)}
                        title="Print this badge"
                        className="absolute top-2.5 right-2.5 z-10 p-1 bg-white/90 backdrop-blur-xs rounded-md shadow-2xs hover:bg-white text-slate-600 hover:text-[#5e2b9d] transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* ID Card Graphic Face */}
                      <div className="flex-1 flex flex-col items-center p-4 pt-3">
                        {/* Lanyard Hole Punch Slot */}
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3" />

                        {/* Top Store Header */}
                        <div
                          className="w-full text-center py-2 px-3 rounded-t-lg text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs"
                          style={{
                            background: `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})`,
                          }}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{emp.store_name || "Retail Next Store"}</span>
                        </div>

                        {/* Card Body */}
                        <div className="w-full bg-slate-50/70 border-x border-b border-slate-200 rounded-b-lg p-4 flex flex-col items-center">
                          {/* Avatar */}
                          <div
                            className="w-20 h-20 rounded-full p-1 bg-white shadow-xs border-2 mb-2 relative overflow-hidden"
                            style={{ borderColor: design.primaryColor }}
                          >
                            {emp.avatar_url ? (
                              <img
                                src={emp.avatar_url}
                                alt={emp.name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xl">
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Name */}
                          {design.showName && (
                            <h3 className="font-bold text-slate-900 text-sm text-center line-clamp-1 mt-0.5">
                              {emp.name}
                            </h3>
                          )}

                          {/* Designation */}
                          <div className="mt-1">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white tracking-wide"
                              style={{ backgroundColor: design.secondaryColor }}
                            >
                              {emp.designation || emp.role || "Staff Member"}
                            </span>
                          </div>

                          {/* Employee ID */}
                          {design.showEmpId && (
                            <div className="mt-1.5 font-mono text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              ID: {emp.employee_id || emp.id.slice(0, 8)}
                            </div>
                          )}

                          {/* QR Code Container */}
                          {design.showQr && qr && (
                            <div className="mt-3 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col items-center">
                              <img
                                src={qr}
                                alt="Employee QR"
                                className="w-24 h-24 object-contain"
                              />
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                Scan for Attendance
                              </span>
                            </div>
                          )}

                          {/* Contact Mobile */}
                          {design.showMobile && emp.mobile && (
                            <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{emp.mobile}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setPreviewEmployee(emp)}
                          className="text-[#5e2b9d] hover:text-[#4d2282] font-semibold text-xs cursor-pointer"
                        >
                          View Full Size
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(emp)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 24-Item Pagination Controls */}
              {totalItems > 0 && (
                <div className="mt-5">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={PAGE_SIZE}
                    onPageChange={(page) => setCurrentPage(page)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Print-Only Layout (@media print) */}
        <div className="hidden print:block">
          <div className="grid grid-cols-2 gap-6 p-6">
            {printList.map((emp) => {
              const qr = qrCodeMap[emp.id];
              return (
                <div
                  key={emp.id}
                  className="w-[260px] h-[410px] mx-auto border-2 border-slate-300 rounded-xl overflow-hidden flex flex-col items-center p-4 bg-white relative break-inside-avoid shadow-none"
                >
                  {/* Lanyard punch hole */}
                  <div className="w-10 h-1.5 bg-slate-400 rounded-full mb-3" />

                  {/* Top Bar */}
                  <div
                    className="w-full text-center py-2 px-3 rounded-t-lg text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5"
                    style={{
                      background: `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})`,
                    }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{emp.store_name || "Retail Next Store"}</span>
                  </div>

                  {/* Body */}
                  <div className="w-full flex-1 bg-slate-50 border-x border-b border-slate-200 rounded-b-lg p-3 flex flex-col items-center justify-between">
                    <div className="flex flex-col items-center">
                      {/* Avatar */}
                      <div
                        className="w-20 h-20 rounded-full p-1 bg-white border-2 mb-2 relative overflow-hidden"
                        style={{ borderColor: design.primaryColor }}
                      >
                        {emp.avatar_url ? (
                          <img
                            src={emp.avatar_url}
                            alt={emp.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xl">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-bold text-slate-900 text-sm text-center">
                        {emp.name}
                      </h3>

                      {/* Designation */}
                      <span
                        className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white tracking-wide"
                        style={{ backgroundColor: design.secondaryColor }}
                      >
                        {emp.designation || emp.role || "Staff Member"}
                      </span>

                      {/* Employee ID */}
                      <div className="mt-1 font-mono text-[10.5px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        ID: {emp.employee_id || emp.id.slice(0, 8)}
                      </div>
                    </div>

                    {/* QR Code */}
                    {qr && (
                      <div className="bg-white p-1 rounded-lg border border-slate-200 flex flex-col items-center my-1">
                        <img
                          src={qr}
                          alt="Employee QR"
                          className="w-20 h-20 object-contain"
                        />
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Attendance Scan
                        </span>
                      </div>
                    )}

                    {/* Footer Mobile */}
                    {emp.mobile && (
                      <div className="text-[10px] text-slate-600 font-mono">
                        Phone: {emp.mobile}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Single Card Full Preview Modal */}
        {previewEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs print:hidden">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <IdCard className="w-4 h-4 text-[#5e2b9d]" />
                  <h3 className="font-bold text-slate-900 text-xs">
                    Badge Preview • {previewEmployee.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrint(previewEmployee)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#5e2b9d] text-white rounded text-xs font-semibold hover:bg-[#4d2282] transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewEmployee(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Rendering */}
              <div className="p-6 flex justify-center bg-slate-100/50">
                <div className="w-[260px] bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col items-center">
                  <div className="w-10 h-1.5 bg-slate-200 rounded-full mb-3" />

                  <div
                    className="w-full text-center py-2 px-3 rounded-t-lg text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs"
                    style={{
                      background: `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})`,
                    }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{previewEmployee.store_name || "Retail Next Store"}</span>
                  </div>

                  <div className="w-full bg-slate-50 border-x border-b border-slate-200 rounded-b-lg p-4 flex flex-col items-center">
                    <div
                      className="w-20 h-20 rounded-full p-1 bg-white shadow-xs border-2 mb-2 relative overflow-hidden"
                      style={{ borderColor: design.primaryColor }}
                    >
                      {previewEmployee.avatar_url ? (
                        <img
                          src={previewEmployee.avatar_url}
                          alt={previewEmployee.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xl">
                          {previewEmployee.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm text-center">
                      {previewEmployee.name}
                    </h3>

                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white tracking-wide"
                      style={{ backgroundColor: design.secondaryColor }}
                    >
                      {previewEmployee.designation || previewEmployee.role || "Staff Member"}
                    </span>

                    <div className="mt-1.5 font-mono text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      ID: {previewEmployee.employee_id || previewEmployee.id.slice(0, 8)}
                    </div>

                    {qrCodeMap[previewEmployee.id] && (
                      <div className="mt-3 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col items-center">
                        <img
                          src={qrCodeMap[previewEmployee.id]}
                          alt="Employee QR"
                          className="w-24 h-24 object-contain"
                        />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                          Scan for Attendance
                        </span>
                      </div>
                    )}

                    {previewEmployee.mobile && (
                      <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{previewEmployee.mobile}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Badge Styling Customizer Modal */}
        {isDesignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs print:hidden">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#5e2b9d]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Customize ID Card Design
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDesignModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Primary Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={design.primaryColor}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, primaryColor: e.target.value }))
                      }
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={design.primaryColor}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, primaryColor: e.target.value }))
                      }
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secondary Gradient Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={design.secondaryColor}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, secondaryColor: e.target.value }))
                      }
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={design.secondaryColor}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, secondaryColor: e.target.value }))
                      }
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                {/* Visible Elements Toggles */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Card Elements
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={design.showName}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, showName: e.target.checked }))
                      }
                      className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <span>Show Staff Name</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={design.showEmpId}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, showEmpId: e.target.checked }))
                      }
                      className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <span>Show Employee Numeric ID</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={design.showMobile}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, showMobile: e.target.checked }))
                      }
                      className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <span>Show Contact Phone Number</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={design.showQr}
                      onChange={(e) =>
                        setDesign((prev) => ({ ...prev, showQr: e.target.checked }))
                      }
                      className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <span>Show Scannable Attendance QR Code</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsDesignModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDesign}
                  disabled={savingDesign}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingDesign ? (
                    <>
                      <Spinner className="w-3.5 h-3.5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Design</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
