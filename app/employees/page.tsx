"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import EmployeeModal, { EmployeeFormData } from "@/components/EmployeeModal";
import BulkUploadEmployeeModal from "@/components/BulkUploadEmployeeModal";
import { useToast } from "@/components/ToastProvider";

interface EmployeeItem extends EmployeeFormData {
  id: string;
  storeId?: string;
  qrCodeUrl?: string;
  avatarUrl?: string;
  acceptedLeaves?: number;
  status: string;
  createdAt: number;
}

interface PaginationInfo {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function EmployeesPage() {
  const toast = useToast();

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL");
  const [selectedSalaryType, setSelectedSalaryType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    totalPages: 1,
    page: 1,
    limit: 24,
    hasMore: false,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeFormData | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Quick View Modal
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeItem | null>(null);

  // Delete Confirmation State
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch paginated employees (strictly 24 items per page)
  const fetchEmployees = useCallback(
    async (pageToFetch = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(pageToFetch),
          limit: "24",
        });

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (selectedCity !== "ALL") {
          params.set("city", selectedCity);
        }
        if (selectedSalaryType !== "ALL") {
          params.set("salaryType", selectedSalaryType);
        }
        if (selectedStatus !== "ALL") {
          params.set("status", selectedStatus);
        }

        const res = await fetch(`/api/employees?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setEmployees(data.employees || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        } else {
          toast.error(data.error || "Failed to load employees.");
        }
      } catch (err: any) {
        console.error("Error fetching employees:", err);
        toast.error("Network error while loading employees.");
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, selectedCity, selectedSalaryType, selectedStatus, toast]
  );

  // Fetch all employees once for quick summary metrics and filter options
  const fetchAllForMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/employees?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.employees)) {
        setAllEmployees(data.employees);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchEmployees(1);
  }, [fetchEmployees]);

  useEffect(() => {
    fetchAllForMetrics();
  }, [fetchAllForMetrics]);

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleEmployeeSaved = () => {
    fetchEmployees(pagination.page);
    fetchAllForMetrics();
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/employees?id=${deletingEmployee.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Employee removed successfully.");
        setDeletingEmployee(null);
        fetchEmployees(pagination.page);
        fetchAllForMetrics();
      } else {
        toast.error(data.error || "Failed to delete employee.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Unique cities from dataset
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach((e) => {
      if (e.city) set.add(e.city);
    });
    return Array.from(set);
  }, [allEmployees]);

  // Derived metrics
  const totalEmployeesCount = pagination.total;
  const monthlyCount = useMemo(() => {
    return allEmployees.filter((e) => e.salaryType === "monthly").length;
  }, [allEmployees]);

  const dailyCount = useMemo(() => {
    return allEmployees.filter((e) => e.salaryType === "daily").length;
  }, [allEmployees]);

  const activeCount = useMemo(() => {
    return allEmployees.filter((e) => e.status === "Active" || !e.status).length;
  }, [allEmployees]);

  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-7xl mx-auto pb-12">
        
        {/* Navigation Tabs Bar for Employee Module */}
        <EmployeeSubNav />

        {/* Top Header & Metrics Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Employee Directory
                </h1>
                <p className="text-xs text-slate-500">
                  Staff profiles, monthly salaries, daily wages & emergency contact records
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchEmployees(pagination.page)}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh employee list"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#5e2b9d]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Bulk import employees from Excel"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Bulk Upload</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 px-4 text-xs font-semibold text-white bg-gradient-to-r from-[#5e2b9d] to-purple-700 hover:from-purple-700 hover:to-[#5e2b9d] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Staff
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                {totalEmployeesCount}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Headcount</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Monthly Salary
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-[#5e2b9d] font-mono">
                {monthlyCount}
              </span>
              <span className="text-[10px] text-[#5e2b9d] font-medium">Salaried</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Daily Wage Workers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">
                {dailyCount}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">Daily Pay</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Workforce
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                {activeCount}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">On Duty</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:max-w-md relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, 10-digit mobile, 7-digit ID, city, emergency..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#5e2b9d] focus:outline-none transition-colors"
            />
          </div>

          <div className="w-full md:w-auto flex flex-wrap items-center gap-2 text-xs">
            {/* Salary Type Filter */}
            <select
              value={selectedSalaryType}
              onChange={(e) => setSelectedSalaryType(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Wage Types</option>
              <option value="monthly">Monthly Salary</option>
              <option value="daily">Daily Wages</option>
            </select>

            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Cities</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Employees Table (Latest 24 items) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-3.5">Emp ID</th>
                  <th className="py-3 px-3.5">Employee Name & Email</th>
                  <th className="py-3 px-3.5">Mobile Number</th>
                  <th className="py-3 px-3.5">City & Address</th>
                  <th className="py-3 px-3.5">Salary / Wage</th>
                  <th className="py-3 px-3.5">Emergency Contact</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="animate-spin w-6 h-6 text-[#5e2b9d]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-xs font-medium">Loading latest 24 employees...</span>
                      </div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">No employees found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchQuery
                            ? `No records matching "${searchQuery}". Try a different keyword.`
                            : "Click below to register your first staff employee."}
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="mt-4 px-4 py-2 bg-[#5e2b9d] text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-purple-800 transition-colors cursor-pointer"
                        >
                          + Add Employee
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const isMonthly = emp.salaryType === "monthly";
                    const salaryAmountNum = Number(emp.salaryAmount) || 0;

                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setViewingEmployee(emp)}
                      >
                        {/* Employee ID */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded border border-purple-100">
                            {emp.employeeId || "—"}
                          </span>
                        </td>

                        {/* Name, Avatar & Optional Email */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-[#5e2b9d] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-purple-200">
                              {emp.avatarUrl ? (
                                <Image
                                  src={emp.avatarUrl}
                                  alt={emp.name}
                                  width={32}
                                  height={32}
                                  unoptimized
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{emp.name.slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">
                                  {emp.name}
                                </span>
                                {emp.latitude && emp.longitude ? (
                                  <span
                                    title={`GPS: ${emp.latitude}, ${emp.longitude}`}
                                    className="text-emerald-600 shrink-0 cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </span>
                                ) : null}
                              </div>
                              {emp.email ? (
                                <span className="text-[11px] text-slate-400 font-sans truncate max-w-[170px]">
                                  {emp.email}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-300 italic">No email provided</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Mobile Number */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs">
                          <span className="text-slate-800 font-medium flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {emp.mobile}
                          </span>
                        </td>

                        {/* City & Address */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-slate-800">{emp.city || "—"}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {emp.address || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Wage / Compensation */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              ₹{salaryAmountNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                            <span
                              className={`text-[10px] font-semibold mt-0.5 inline-block w-fit px-1.5 py-0.2 rounded ${
                                isMonthly
                                  ? "bg-purple-50 text-[#5e2b9d]"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {isMonthly ? "Monthly Salary" : "Daily Wages"}
                            </span>
                          </div>
                        </td>

                        {/* Emergency Contact: Name, Relation & Mobile */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-slate-800 truncate max-w-[150px]">
                              {emp.emergencyName || "—"}{" "}
                              {emp.emergencyRelation ? (
                                <span className="text-[10px] text-slate-400">({emp.emergencyRelation})</span>
                              ) : null}
                            </span>
                            <span className="text-[10.5px] font-mono text-slate-500">
                              {emp.emergencyContactNumber || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {emp.status === "Inactive" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              Inactive
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(emp)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors cursor-pointer"
                              title="Edit Employee"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingEmployee(emp)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Employee"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer: Strictly 24 items per page */}
          <div className="bg-slate-50/70 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{" "}
              <b className="text-slate-800">
                {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
              </b>{" "}
              to{" "}
              <b className="text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </b>{" "}
              of <b className="text-slate-800">{pagination.total}</b> employees
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchEmployees(pagination.page - 1)}
                className="h-8 px-3 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Prev</span>
              </button>

              {/* Page Number Chips */}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - pagination.page) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => fetchEmployees(p)}
                        className={`w-8 h-8 rounded text-xs font-semibold transition-colors cursor-pointer ${
                          p === pagination.page
                            ? "bg-[#5e2b9d] text-white"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchEmployees(pagination.page + 1)}
                className="h-8 px-3 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Add / Edit Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleEmployeeSaved}
        initialEmployee={editingEmployee}
      />

      {/* Bulk Upload Employee Modal */}
      <BulkUploadEmployeeModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={() => {
          setIsBulkUploadOpen(false);
          fetchEmployees(1);
        }}
      />

      {/* Employee Quick Details View Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="bg-[#5e2b9d] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{viewingEmployee.name}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px]">
                  ID: {viewingEmployee.employeeId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
              {/* Profile Card with Photo & Attendance QR Code */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-full border-2 border-purple-300 bg-white overflow-hidden shadow-xs shrink-0 flex items-center justify-center">
                    {viewingEmployee.avatarUrl ? (
                      <Image
                        src={viewingEmployee.avatarUrl}
                        alt={viewingEmployee.name}
                        width={56}
                        height={56}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-[#5e2b9d]">
                        {viewingEmployee.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {viewingEmployee.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-500">
                      <span>ID: {viewingEmployee.employeeId}</span>
                      <span>•</span>
                      <span>{viewingEmployee.mobile}</span>
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded">
                      {viewingEmployee.status || "Active"}
                    </span>
                  </div>
                </div>

                {/* Attendance QR Code */}
                {viewingEmployee.qrCodeUrl ? (
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-14 h-14 bg-white p-1 rounded-lg border border-purple-200 shadow-2xs">
                      <Image
                        src={viewingEmployee.qrCodeUrl}
                        alt="Attendance QR Code"
                        width={56}
                        height={56}
                        unoptimized
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <a
                      href={viewingEmployee.qrCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9.5px] font-semibold text-[#5e2b9d] hover:underline mt-0.5"
                    >
                      Attendance QR ↗
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mobile</span>
                  <span className="text-slate-800 font-mono font-medium">{viewingEmployee.mobile}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                  <span className="text-slate-800">{viewingEmployee.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">City</span>
                  <span className="text-slate-800 font-semibold">{viewingEmployee.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">GPS Location</span>
                  {viewingEmployee.latitude && viewingEmployee.longitude ? (
                    <a
                      href={`https://maps.google.com/?q=${viewingEmployee.latitude},${viewingEmployee.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5e2b9d] font-mono text-[11px] underline hover:text-purple-900"
                    >
                      {viewingEmployee.latitude}, {viewingEmployee.longitude} ↗
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Not recorded</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Compensation Type</span>
                  <span className="text-slate-800 font-semibold capitalize">{viewingEmployee.salaryType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    {viewingEmployee.salaryType === "monthly" ? "Monthly Salary" : "Daily Wage Rate"}
                  </span>
                  <span className="text-[#5e2b9d] font-mono font-bold text-sm">
                    ₹{Number(viewingEmployee.salaryAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-2">
                  Emergency Contact Record
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Contact Person</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.emergencyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Relation</span>
                    <span className="font-semibold text-slate-800">{viewingEmployee.emergencyRelation}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Emergency Mobile</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingEmployee.emergencyContactNumber}</span>
                  </div>
                </div>
              </div>

              {viewingEmployee.address && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Full Address</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-md border border-slate-100 mt-1">
                    {viewingEmployee.address}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const empToEdit = viewingEmployee;
                  setViewingEmployee(null);
                  handleOpenEditModal(empToEdit);
                }}
                className="px-3 py-1.5 bg-[#5e2b9d] text-white rounded font-medium text-xs hover:bg-purple-800 transition-colors cursor-pointer"
              >
                Edit Employee
              </button>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-medium text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Delete Employee?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to remove{" "}
              <b className="text-slate-800">{deletingEmployee.name}</b> (
              <span className="font-mono text-purple-700">ID: {deletingEmployee.employeeId}</span>)?
              This will remove their profile from the active directory.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteEmployee}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}
