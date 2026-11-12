"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";

interface LeaveRecord {
  id: string;
  storeId?: string;
  employeeId: string;
  employeeNumericId?: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
  daysCount: number;
  reason: string;
  status: "Approved" | "Pending" | "Rejected";
  createdAt: number;
}

export default function EmployeeLeavesPage() {
  const toast = useToast();

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeNumericId: "",
    employeeName: "",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: "Sick Leave / Health",
  });

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees/leaves");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.leaves)) {
        setLeaves(data.leaves);
      } else {
        toast.error(data.error || "Failed to load leave records.");
      }
    } catch {
      toast.error("Network error while loading leaves.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees?all=true");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.employees)) {
          setEmployees(data.employees);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    loadEmployees();
  }, [fetchLeaves, loadEmployees]);

  // Filter
  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !l.employeeName.toLowerCase().includes(q) && !(l.employeeId || "").includes(q)) return false;
      if (statusFilter !== "all" && l.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [leaves, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE));
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeaves.slice(start, start + PAGE_SIZE);
  }, [filteredLeaves, currentPage]);

  // Calculate day count in modal
  const calculatedDays = useMemo(() => {
    if (!formData.fromDate || !formData.toDate) return 1;
    const start = new Date(formData.fromDate).getTime();
    const end = new Date(formData.toDate).getTime();
    const diffDays = Math.round((end - start) / (1000 * 3600 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [formData.fromDate, formData.toDate]);

  // Stats
  const stats = useMemo(() => {
    const total = leaves.length;
    const approved = leaves.filter((l) => l.status === "Approved").length;
    const pending = leaves.filter((l) => l.status === "Pending").length;
    const rejected = leaves.filter((l) => l.status === "Rejected").length;
    return { total, approved, pending, rejected };
  }, [leaves]);

  // Update Status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/employees/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaves((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: newStatus as any } : l))
        );
        toast.success(`Leave status marked as ${newStatus}.`);
      } else {
        toast.error(data.error || "Failed to update status.");
      }
    } catch {
      toast.error("Network error while updating status.");
    }
  };

  // Submit Leave
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      toast.error("Please select an employee.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/employees/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          daysCount: calculatedDays,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Leave request registered for ${formData.employeeName}.`);
        setIsAddModalOpen(false);
        fetchLeaves();
      } else {
        toast.error(data.error || "Failed to submit leave.");
      }
    } catch {
      toast.error("Network error while submitting leave.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 pb-12">
        <EmployeeSubNav />

        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Employee Leaves & Permissions</h1>
                <p className="text-xs text-slate-500">
                  Staff leave applications, vacation calendars, medical absence approvals & quota tracking
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchLeaves}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : "↻"}
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const firstEmp = employees[0];
                setFormData({
                  employeeId: firstEmp?.id || "",
                  employeeNumericId: firstEmp?.employeeId || "",
                  employeeName: firstEmp?.name || "",
                  fromDate: new Date().toISOString().slice(0, 10),
                  toDate: new Date().toISOString().slice(0, 10),
                  reason: "Sick Leave / Health",
                });
                setIsAddModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Apply Staff Leave</span>
            </button>
          </div>
        </div>

        {/* 4 Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Applications
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{stats.total}</span>
              <span className="text-[10px] text-slate-400 font-medium">Requests</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Approved Leaves
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">{stats.approved}</span>
              <span className="text-[10px] text-emerald-700 font-medium">Sanctioned</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Decisions
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">{stats.pending}</span>
              <span className="text-[10px] text-amber-700 font-medium">Awaiting</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Rejected Requests
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">{stats.rejected}</span>
              <span className="text-[10px] text-rose-700 font-medium">Declined</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee name..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "approved", "pending", "rejected"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-[#5e2b9d] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Leaves Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Duration</th>
                  <th className="py-3 px-4 text-center">Days</th>
                  <th className="py-3 px-4">Reason / Category</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading leave requests...</span>
                    </td>
                  </tr>
                ) : paginatedLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No leave requests found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Apply Staff Leave&quot; to log time off.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedLeaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{l.employeeName}</div>
                        {l.employeeNumericId && (
                          <div className="text-[10px] text-slate-400 font-mono">Emp #{l.employeeNumericId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {l.fromDate} → {l.toDate}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {l.daysCount} {l.daysCount === 1 ? "day" : "days"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {l.reason}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            l.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : l.status === "Rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(l.id, "Approved")}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {l.status !== "Rejected" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(l.id, "Rejected")}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLeaves.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredLeaves.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="leave requests"
              />
            </div>
          )}
        </div>

        {/* Apply Leave Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Apply Staff Leave</h3>
                  <p className="text-[11px] text-purple-200">Submit time-off request for employee</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.employeeId}
                    onChange={(e) => {
                      const emp = employees.find((emp) => emp.id === e.target.value);
                      setFormData({
                        ...formData,
                        employeeId: e.target.value,
                        employeeName: emp?.name || "",
                        employeeNumericId: emp?.employeeId || "",
                      });
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.mobile || emp.city || "Staff"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      From Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fromDate}
                      onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      To Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.toDate}
                      onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-purple-50/50 rounded-lg border border-purple-100">
                  <span className="text-slate-600 font-semibold">Total Days Requested:</span>
                  <span className="font-mono font-bold text-sm text-[#5e2b9d]">{calculatedDays} {calculatedDays === 1 ? "day" : "days"}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason / Leave Category
                  </label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  >
                    <option value="Sick Leave / Health">Sick Leave / Health</option>
                    <option value="Casual / Personal Leave">Casual / Personal Leave</option>
                    <option value="Family Function / Wedding">Family Function / Wedding</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Festival Holiday">Festival Holiday</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-5 bg-[#5e2b9d] hover:bg-[#4d2282] text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
                    <span>Submit Leave</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
