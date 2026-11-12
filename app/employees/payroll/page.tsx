"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import {
  Banknote,
  Search,
  Calendar,
  Save,
  Download,
  Printer,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User,
  Percent,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";

interface PayrollRecord {
  employeeId: string;
  employeeNumericId: string;
  employeeName: string;
  avatarUrl?: string;
  mobile?: string;
  salaryType: "monthly" | "daily";
  baseSalary: number;
  perDaySalary: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  acceptedLeaves: number;
  approvedLeavesTaken: number;
  payableLeaves: number;
  unexcusedAbsences: number;
  isBonusEligible: boolean;
  applyBonus: boolean;
  bonusDays: number;
  bonusAmount: number;
  grossEarnings: number;
  pendingAdvance: number;
  advanceDeduction: number;
  netSalary: number;
  status: "Draft" | "Finalized" | "Paid";
}

interface PayrollApiResponse {
  success: boolean;
  month: string;
  daysInMonth: number;
  monthDivisor: number;
  enableAttendanceBonus: boolean;
  bonusDays: number;
  sundayIsHoliday: boolean;
  holidaysCount: number;
  records: PayrollRecord[];
  savedPayroll: boolean;
  error?: string;
}

export default function PayrollPage() {
  const toast = useToast();

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payrollData, setPayrollData] = useState<PayrollApiResponse | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Payslip Modal
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);

  // Fetch Payroll for chosen month
  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/employees/payroll?month=${encodeURIComponent(selectedMonth)}`);
      const data: PayrollApiResponse = await res.json();
      if (res.ok && data.success) {
        setPayrollData(data);
        setRecords(data.records || []);
      } else {
        toast.error(data.error || "Failed to load payroll records.");
        setRecords([]);
      }
    } catch (err: any) {
      console.error("Payroll fetch error:", err);
      toast.error("Failed to connect to payroll service.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, toast]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  // Recalculate row amounts when user edits bonus toggle or advance deduction
  const handleToggleBonus = (empId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId !== empId) return r;
        const newApplyBonus = !r.applyBonus;
        const bonusAmount = newApplyBonus ? Math.round(r.bonusDays * r.perDaySalary) : 0;
        let gross = 0;
        if (r.salaryType === "daily") {
          const effectivePresent = r.presentDays + r.halfDays * 0.5;
          gross = Math.max(0, Math.round((effectivePresent + r.payableLeaves) * r.perDaySalary + bonusAmount));
        } else {
          const deductionForAbsence = Math.round(r.unexcusedAbsences * r.perDaySalary);
          gross = Math.max(0, Math.round(r.baseSalary - deductionForAbsence + bonusAmount));
        }
        const advanceDeduction = Math.min(r.pendingAdvance, r.advanceDeduction, gross);
        const net = Math.max(0, gross - advanceDeduction);
        return {
          ...r,
          applyBonus: newApplyBonus,
          bonusAmount,
          grossEarnings: gross,
          advanceDeduction,
          netSalary: net,
        };
      })
    );
  };

  const handleAdvanceDeductionChange = (empId: string, value: string) => {
    const num = Math.max(0, Number(value) || 0);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId !== empId) return r;
        const deduction = Math.min(r.pendingAdvance, num, r.grossEarnings);
        const net = Math.max(0, r.grossEarnings - deduction);
        return {
          ...r,
          advanceDeduction: deduction,
          netSalary: net,
        };
      })
    );
  };

  const handleStatusChange = (empId: string, status: "Draft" | "Finalized" | "Paid") => {
    setRecords((prev) =>
      prev.map((r) => (r.employeeId === empId ? { ...r, status } : r))
    );
  };

  // Save / Finalize Payroll
  const handleSavePayroll = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/employees/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          records,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Payroll successfully saved & finalized!");
        fetchPayroll();
      } else {
        toast.error(data.error || "Failed to save payroll.");
      }
    } catch (err: any) {
      console.error("Save payroll error:", err);
      toast.error("Network error while saving payroll.");
    } finally {
      setSaving(false);
    }
  };

  // Export Bank CSV
  const handleExportBankCSV = () => {
    if (records.length === 0) {
      toast.error("No payroll records available to export.");
      return;
    }

    const headers = [
      "Employee ID",
      "Employee Name",
      "Mobile",
      "Salary Type",
      "Base Salary",
      "Gross Earnings",
      "Advance Deducted",
      "Net Payable Salary",
      "Month",
      "Status",
    ];

    const rows = records.map((r) => [
      `"${r.employeeNumericId || r.employeeId}"`,
      `"${r.employeeName}"`,
      `"${r.mobile || ""}"`,
      `"${r.salaryType}"`,
      r.baseSalary,
      r.grossEarnings,
      r.advanceDeduction,
      r.netSalary,
      `"${selectedMonth}"`,
      `"${r.status}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payroll_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Bank disbursement CSV downloaded!");
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeNumericId && r.employeeNumericId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.mobile && r.mobile.includes(searchQuery));

      const matchStatus =
        statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();

      const matchType =
        typeFilter === "all" || r.salaryType.toLowerCase() === typeFilter.toLowerCase();

      return matchSearch && matchStatus && matchType;
    });
  }, [records, searchQuery, statusFilter, typeFilter]);

  // Pagination Slice
  const totalItems = filteredRecords.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  // Overall KPI Metrics
  const summary = useMemo(() => {
    let gross = 0;
    let advance = 0;
    let net = 0;
    let paidCount = 0;

    records.forEach((r) => {
      gross += r.grossEarnings;
      advance += r.advanceDeduction;
      net += r.netSalary;
      if (r.status === "Paid") paidCount += 1;
    });

    return {
      gross,
      advance,
      net,
      totalStaff: records.length,
      paidCount,
      unpaidCount: records.length - paidCount,
    };
  }, [records]);

  // Format Month Display
  const displayMonthName = useMemo(() => {
    if (!selectedMonth) return "";
    const [y, m] = selectedMonth.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  return (
    <SoftwareLayout>
      <div className="space-y-5">
        {/* Sub Navigation */}
        <EmployeeSubNav />

        {/* Page Top Header Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-[#5e2b9d] flex items-center justify-center shrink-0 border border-purple-100">
                <Banknote className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Staff Payroll & Salary Register
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculate attendance-based monthly compensation, process advances deduction, and disburse payslips.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Month Selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
                />
              </div>

              {/* Export Bank CSV */}
              <button
                type="button"
                onClick={handleExportBankCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>

              {/* Save / Finalize Button */}
              <button
                type="button"
                onClick={handleSavePayroll}
                disabled={saving || loading || records.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5e2b9d] hover:bg-[#4d2282] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Finalize & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gross Earnings
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                ₹{summary.gross.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400">Total Pre-deduction</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Advances Deducted
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">
                ₹{summary.advance.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400">Recovered loans</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Net Salary Payable
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#5e2b9d]">
                ₹{summary.net.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-purple-700 font-medium">To Disburse</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Staff Status
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {summary.paidCount} / {summary.totalStaff}
              </span>
              <span className="text-xs text-slate-400">Paid Staff</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID or mobile..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Salary Types</option>
              <option value="monthly">Monthly Salary</option>
              <option value="daily">Daily Wage</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#5e2b9d] text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Finalized">Finalized</option>
              <option value="Paid">Paid</option>
            </select>

            <span className="text-xs text-slate-500 font-medium ml-1">
              Showing {filteredRecords.length} records for <span className="font-semibold text-slate-800">{displayMonthName}</span>
            </span>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Spinner className="w-8 h-8 text-[#5e2b9d] mb-2" />
              <p className="text-xs">Computing attendance & payroll records...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-10 h-10 stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No payroll records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Ensure active employees are registered and attendance is marked for {displayMonthName}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Type & Base</th>
                    <th className="py-3 px-3">Attendance Stats</th>
                    <th className="py-3 px-3">Bonus / Extra</th>
                    <th className="py-3 px-3">Gross</th>
                    <th className="py-3 px-3">Advance Deduction</th>
                    <th className="py-3 px-3">Net Salary</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedRecords.map((r) => {
                    return (
                      <tr key={r.employeeId} className="hover:bg-slate-50/70 transition-colors">
                        {/* Employee */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                              {r.avatarUrl ? (
                                <img
                                  src={r.avatarUrl}
                                  alt={r.employeeName}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                r.employeeName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{r.employeeName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {r.employeeNumericId || r.employeeId.slice(0, 8)}
                                {r.mobile && ` • ${r.mobile}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Salary Type & Base */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">
                            ₹{r.baseSalary.toLocaleString("en-IN")}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium capitalize mt-0.5 ${
                              r.salaryType === "daily"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {r.salaryType} (₹{r.perDaySalary}/day)
                          </span>
                        </td>

                        {/* Attendance Stats */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                              P: {r.presentDays}
                            </span>
                            {r.halfDays > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                                HD: {r.halfDays}
                              </span>
                            )}
                            {r.absentDays > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                                A: {r.absentDays}
                              </span>
                            )}
                            {r.payableLeaves > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                                Paid Leaves: {r.payableLeaves}
                              </span>
                            )}
                          </div>
                          {r.unexcusedAbsences > 0 && (
                            <div className="text-[10px] text-rose-600 mt-1">
                              Loss of Pay: {r.unexcusedAbsences} day(s)
                            </div>
                          )}
                        </td>

                        {/* Bonus / Extra */}
                        <td className="py-3 px-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={r.applyBonus}
                              onChange={() => handleToggleBonus(r.employeeId)}
                              className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] w-3.5 h-3.5"
                            />
                            <span className="text-[11px] font-medium text-slate-700">
                              +₹{r.bonusAmount}
                            </span>
                          </label>
                          {r.isBonusEligible && (
                            <div className="text-[9.5px] text-emerald-600 font-medium">
                              Full Attendance
                            </div>
                          )}
                        </td>

                        {/* Gross Earnings */}
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          ₹{r.grossEarnings.toLocaleString("en-IN")}
                        </td>

                        {/* Advance Deduction */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">₹</span>
                            <input
                              type="number"
                              min="0"
                              max={r.pendingAdvance}
                              value={r.advanceDeduction}
                              onChange={(e) =>
                                handleAdvanceDeductionChange(r.employeeId, e.target.value)
                              }
                              className="w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 outline-none focus:border-[#5e2b9d]"
                            />
                          </div>
                          {r.pendingAdvance > 0 && (
                            <div className="text-[10px] text-amber-600 mt-0.5">
                              Due: ₹{r.pendingAdvance.toLocaleString("en-IN")}
                            </div>
                          )}
                        </td>

                        {/* Net Salary */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#5e2b9d] text-sm">
                            ₹{r.netSalary.toLocaleString("en-IN")}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <select
                            value={r.status}
                            onChange={(e) =>
                              handleStatusChange(
                                r.employeeId,
                                e.target.value as "Draft" | "Finalized" | "Paid"
                              )
                            }
                            className={`text-[10.5px] font-semibold rounded px-2 py-0.5 border outline-none cursor-pointer ${
                              r.status === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : r.status === "Finalized"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Finalized">Finalized</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setActivePayslip(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 rounded-md transition-colors cursor-pointer border border-purple-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Payslip
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 24-Item Pagination Controls */}
          {totalItems > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setCurrentPage(page)}
            />
          )}
        </div>

        {/* Itemized Payslip Modal */}
        {activePayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs print:p-0 print:bg-white">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden print:border-none print:shadow-none print:w-full">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5e2b9d]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Employee Payslip • {displayMonthName}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePayslip(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Payslip Body */}
              <div className="p-6 space-y-5 print:p-8">
                {/* Company / Store Header */}
                <div className="text-center pb-4 border-b border-slate-200">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Retail Next Store
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Salary Statement & Pay Voucher for {displayMonthName}
                  </p>
                </div>

                {/* Employee Meta Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Employee Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {activePayslip.employeeName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Employee ID / Code
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {activePayslip.employeeNumericId || activePayslip.employeeId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Mobile Number
                    </span>
                    <span className="font-mono text-slate-800">
                      {activePayslip.mobile || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Pay Period & Status
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedMonth} • {activePayslip.status}
                    </span>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="flex items-center justify-between text-xs bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                  <div>
                    <span className="text-purple-900 font-semibold">Days Present:</span>{" "}
                    <span className="font-bold text-slate-900">{activePayslip.presentDays}</span>
                  </div>
                  <div>
                    <span className="text-purple-900 font-semibold">Half Days:</span>{" "}
                    <span className="font-bold text-slate-900">{activePayslip.halfDays}</span>
                  </div>
                  <div>
                    <span className="text-purple-900 font-semibold">Paid Leaves:</span>{" "}
                    <span className="font-bold text-slate-900">{activePayslip.payableLeaves}</span>
                  </div>
                  <div>
                    <span className="text-purple-900 font-semibold">Loss of Pay:</span>{" "}
                    <span className="font-bold text-rose-600">{activePayslip.unexcusedAbsences}</span>
                  </div>
                </div>

                {/* Itemized Earnings and Deductions Tables */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Earnings */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
                      Earnings
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Base Salary</span>
                        <span className="font-semibold text-slate-900">
                          ₹{activePayslip.baseSalary.toLocaleString("en-IN")}
                        </span>
                      </div>
                      {activePayslip.bonusAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Attendance Bonus</span>
                          <span className="font-semibold text-emerald-600">
                            +₹{activePayslip.bonusAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-2 border-t border-slate-100 text-slate-900">
                        <span>Gross Earnings</span>
                        <span>₹{activePayslip.grossEarnings.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h4 className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
                      Deductions
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      {activePayslip.unexcusedAbsences > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Loss of Pay ({activePayslip.unexcusedAbsences}d)</span>
                          <span className="font-semibold text-rose-600">
                            -₹{(Math.round(activePayslip.unexcusedAbsences * activePayslip.perDaySalary)).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-600">Advance Repayment</span>
                        <span className="font-semibold text-amber-700">
                          -₹{activePayslip.advanceDeduction.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t border-slate-100 text-slate-900">
                        <span>Total Deductions</span>
                        <span>
                          -₹{(
                            Math.round(activePayslip.unexcusedAbsences * activePayslip.perDaySalary) +
                            activePayslip.advanceDeduction
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Salary Payable Banner */}
                <div className="bg-[#5e2b9d] text-white p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-purple-200 text-xs uppercase font-semibold tracking-wider block">
                      Net Salary Disbursed / Payable
                    </span>
                    <span className="text-2xl font-black">
                      ₹{activePayslip.netSalary.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-semibold">
                      Mode: Bank Transfer / Cash
                    </span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 pt-8 text-center text-xs text-slate-500">
                  <div>
                    <div className="border-t border-slate-300 w-32 mx-auto mb-1"></div>
                    <span>Employer / Cashier Signature</span>
                  </div>
                  <div>
                    <div className="border-t border-slate-300 w-32 mx-auto mb-1"></div>
                    <span>Employee Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
