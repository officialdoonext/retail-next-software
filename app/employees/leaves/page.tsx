"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import EmployeeSearchPicker, { EmployeeSummary } from "@/components/EmployeeSearchPicker";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

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
  status: string;
  createdAt: number;
}

export default function EmployeeLeavesPage() {
  const toast = useToast();

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const inputCls =
    "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";

  // Calculate day count
  const calculatedDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    if (fromDate > toDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [fromDate, toDate]);

  // Load leaves
  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees/leaves");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.leaves)) {
        setLeaves(data.leaves);
      } else {
        toast.error(data.error || "Failed to load leaves.");
      }
    } catch {
      toast.error("Network error while loading leaves.");
    } finally {
      setLoading(false);
    }
  };

  // Load employees for fast search picker
  const loadEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLeaves();
    loadEmployees();
  }, []); // eslint-disable-line

  const handleOpenAddModal = () => {
    setSelectedEmp(null);
    const today = new Date().toISOString().split("T")[0];
    setFromDate(today);
    setToDate(today);
    setReason("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) {
      setFormError("Please select an employee by searching with Name, ID, or Mobile.");
      return;
    }
    if (!fromDate || !toDate) {
      setFormError("Please select both From and To dates.");
      return;
    }
    if (fromDate > toDate) {
      setFormError("From Date cannot be after To Date.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      const res = await fetch("/api/employees/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmp.id,
          employeeNumericId: selectedEmp.employeeId || "",
          employeeName: selectedEmp.name,
          fromDate,
          toDate,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Leave record saved successfully!");
        setIsModalOpen(false);
        loadLeaves();
      } else {
        setFormError(data.error || "Failed to save leave.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeave = async () => {
    if (!leaveToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/employees/leaves?id=${leaveToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Leave record removed.");
        setLeaves((prev) => prev.filter((l) => l.id !== leaveToDelete.id));
        setLeaveToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete leave.");
      }
    } catch {
      toast.error("Network error while deleting leave.");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter((l) => {
      const name = (l.employeeName || "").toLowerCase();
      const numId = String(l.employeeNumericId || "").toLowerCase();
      const r = (l.reason || "").toLowerCase();
      return name.includes(q) || numId.includes(q) || r.includes(q);
    });
  }, [leaves, searchQuery]);

  // Total summary metrics
  const totalDaysApproved = useMemo(() => {
    return leaves.reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
  }, [leaves]);

  const todayStr = new Date().toISOString().split("T")[0];
  const onLeaveTodayCount = useMemo(() => {
    return leaves.filter((l) => l.fromDate <= todayStr && l.toDate >= todayStr).length;
  }, [leaves, todayStr]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Top HR Sub-Nav */}
        <EmployeeSubNav />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Employee Leaves
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {leaves.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Record and track employee leave requests, durations, and approved absences.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Leave</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Leave Requests</p>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">{leaves.length}</h3>
            </div>
            <div className="w-8 h-8 rounded-[6px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">On Leave Today</p>
              <h3 className="text-lg font-bold text-amber-600 mt-0.5">{onLeaveTodayCount}</h3>
            </div>
            <div className="w-8 h-8 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Days Approved</p>
              <h3 className="text-lg font-bold text-emerald-600 mt-0.5">{totalDaysApproved} Days</h3>
            </div>
            <div className="w-8 h-8 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by Employee or Reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            Showing <strong className="text-slate-900 font-semibold">{filteredLeaves.length}</strong> leaves
          </div>
        </div>

        {/* Leaves Table */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-500">Loading leave records...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] mx-auto flex items-center justify-center mb-2">
                <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-800">No leave records found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &quot;Add Leave&quot; above to record approved leaves for your employees.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3 text-center">Total Days</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaves.map((l) => {
                    const isCurrentlyActive = l.fromDate <= todayStr && l.toDate >= todayStr;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${getFirstLetterColor(
                                getFirstLetter(l.employeeName)
                              )}`}
                            >
                              {getFirstLetter(l.employeeName)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{l.employeeName}</div>
                              {l.employeeNumericId && (
                                <div className="text-[10px] font-mono text-[#5e2b9d]">
                                  #{l.employeeNumericId}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">
                            {new Date(l.fromDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            →{" "}
                            {new Date(l.toDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {l.daysCount} {l.daysCount === 1 ? "Day" : "Days"}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 max-w-xs truncate">
                          <span className="text-slate-600 italic">
                            {l.reason || "No reason specified"}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {isCurrentlyActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Active Today
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setLeaveToDelete(l)}
                            className="p-1 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Cancel / Delete leave"
                          >
                            <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Leave Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f8fafc]">
                <h3 className="text-sm font-semibold text-slate-900">Add Employee Leave</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveLeave} className="p-4 space-y-3">
                {formError && (
                  <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-[4px]">
                    {formError}
                  </div>
                )}

                {/* Search-Only Employee Picker */}
                <EmployeeSearchPicker
                  label="Search & Select Employee"
                  required
                  employees={employees}
                  selectedEmployee={selectedEmp}
                  onSelectEmployee={(emp) => {
                    setSelectedEmp(emp);
                    setFormError("");
                  }}
                  placeholder="Type Name, 7-digit ID, or Mobile..."
                  helperText="Search is required to pick an employee (no pre-loaded full list)."
                />

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      From Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      To Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={toDate}
                      min={fromDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Duration indicator */}
                <div className="p-2 rounded-[6px] bg-[#5e2b9d]/5 border border-[#5e2b9d]/15 flex items-center justify-between text-xs">
                  <span className="text-[#5e2b9d] font-medium">Leave Duration:</span>
                  <span className="font-bold text-[#5e2b9d]">
                    {calculatedDays} {calculatedDays === 1 ? "Day" : "Days"}
                  </span>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Reason for Leave
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Family emergency, Medical, Vacation..."
                    className="w-full px-3 py-1.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-[34px] px-3.5 rounded-[6px] text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Saving..." : "Save Leave"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {leaveToDelete && (
          <ConfirmModal
            isOpen={!!leaveToDelete}
            title="Cancel Leave Record"
            message={`Are you sure you want to cancel the leave record for ${leaveToDelete.employeeName} (${leaveToDelete.fromDate} to ${leaveToDelete.toDate})?`}
            confirmText={deleting ? "Deleting..." : "Yes, Cancel Leave"}
            cancelText="Keep"
            onConfirm={handleDeleteLeave}
            onClose={() => setLeaveToDelete(null)}
          />
        )}
      </div>
    </SoftwareLayout>
  );
}
