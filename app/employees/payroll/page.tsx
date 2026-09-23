"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import { useToast } from "@/components/ToastProvider";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

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
  status?: string;
}

export default function EmployeePayrollPage() {
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [payrollData, setPayrollData] = useState<{
    daysInMonth: number;
    monthDivisor: number;
    enableAttendanceBonus: boolean;
    bonusDays: number;
    sundayIsHoliday: boolean;
    holidaysCount: number;
    records: PayrollRecord[];
    savedPayroll: boolean;
  } | null>(null);

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState<PayrollRecord | null>(null);

  const printableRef = useRef<HTMLDivElement>(null);

  // Load payroll calculation for the selected month
  const loadPayroll = async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/payroll?month=${month}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayrollData(data);
        setRecords(data.records || []);
      } else {
        toast.error(data.error || "Failed to load payroll.");
      }
    } catch {
      toast.error("Network error while loading payroll.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll(selectedMonth);
  }, [selectedMonth]); // eslint-disable-line

  const handleToggleBonus = (empId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId !== empId) return r;
        const newApplyBonus = !r.applyBonus;
        const newBonusAmount = newApplyBonus ? Math.round(r.bonusDays * r.perDaySalary) : 0;

        let gross = 0;
        if (r.salaryType === "daily") {
          const effectivePresent = r.presentDays + r.halfDays * 0.5;
          gross = Math.max(0, Math.round((effectivePresent + r.payableLeaves) * r.perDaySalary + newBonusAmount));
        } else {
          const deduction = Math.round(r.unexcusedAbsences * r.perDaySalary);
          gross = Math.max(0, Math.round(r.baseSalary - deduction + newBonusAmount));
        }

        const net = Math.max(0, gross - r.advanceDeduction);

        return {
          ...r,
          applyBonus: newApplyBonus,
          bonusAmount: newBonusAmount,
          grossEarnings: gross,
          netSalary: net,
        };
      })
    );
  };

  const handleDeductionChange = (empId: string, val: string) => {
    const num = Math.max(0, Number(val) || 0);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId !== empId) return r;
        const deduction = Math.min(num, r.pendingAdvance, r.grossEarnings);
        const net = Math.max(0, r.grossEarnings - deduction);
        return {
          ...r,
          advanceDeduction: deduction,
          netSalary: net,
        };
      })
    );
  };

  const handleSavePayroll = async () => {
    if (records.length === 0) return;
    try {
      setSaving(true);
      const res = await fetch("/api/employees/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          records: records.map((r) => ({ ...r, status: "Finalized" })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Payroll for ${selectedMonth} successfully saved & finalized!`);
        loadPayroll(selectedMonth);
      } else {
        toast.error(data.error || "Failed to save payroll.");
      }
    } catch {
      toast.error("Network error while saving payroll.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = (r.employeeName || "").toLowerCase();
      const numId = String(r.employeeNumericId || "").toLowerCase();
      return name.includes(q) || numId.includes(q);
    });
  }, [records, searchQuery]);

  const totalGrossPayroll = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.grossEarnings || 0), 0);
  }, [records]);

  const totalAdvanceDeducted = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.advanceDeduction || 0), 0);
  }, [records]);

  const totalNetPayable = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.netSalary || 0), 0);
  }, [records]);

  const totalBonusPaid = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.applyBonus ? r.bonusAmount : 0), 0);
  }, [records]);

  const monthTitle = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Top HR Sub-Nav */}
        <EmployeeSubNav />

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Employee Payroll
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {records.length} Staff
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Automated monthly salary calculation based on attendance, accepted leaves, bonus, and advances.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-white px-2.5 h-[34px] rounded-[6px] border border-slate-300 shadow-2xs">
              <label className="text-xs font-semibold text-slate-700">Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleSavePayroll}
              disabled={saving || loading || records.length === 0}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>{saving ? "Finalizing..." : "Finalize & Save Payroll"}</span>
            </button>
          </div>
        </div>

        {/* Salary Configuration Overview Banner */}
        {payrollData && (
          <div className="bg-[#5e2b9d]/5 border border-[#5e2b9d]/15 p-2.5 rounded-[6px] flex flex-wrap items-center justify-between gap-3 text-xs mb-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-slate-500 font-medium">Month Divisor:</span>{" "}
                <strong className="text-[#5e2b9d] font-bold">
                  {payrollData.monthDivisor} Days
                </strong>{" "}
                <span className="text-[11px] text-slate-400">
                  (Rate = Salary ÷ {payrollData.monthDivisor})
                </span>
              </div>

              <div className="h-3 w-px bg-purple-200 hidden sm:block" />

              <div>
                <span className="text-slate-500 font-medium">Full Attendance Bonus:</span>{" "}
                <strong className="text-[#5e2b9d] font-bold">
                  {payrollData.enableAttendanceBonus
                    ? `Enabled (${payrollData.bonusDays}d)`
                    : "Disabled"}
                </strong>
              </div>

              <div className="h-3 w-px bg-purple-200 hidden sm:block" />

              <div>
                <span className="text-slate-500 font-medium">Sunday Holiday:</span>{" "}
                <strong className="text-[#5e2b9d] font-bold">
                  {payrollData.sundayIsHoliday ? "Weekly Off" : "Working Day"}
                </strong>
              </div>

              <div className="h-3 w-px bg-purple-200 hidden sm:block" />

              <div>
                <span className="text-slate-500 font-medium">Declared Holidays:</span>{" "}
                <strong className="text-[#5e2b9d] font-bold">
                  {payrollData.holidaysCount} Days
                </strong>
              </div>
            </div>

            {payrollData.savedPayroll && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                ✓ Finalized
              </span>
            )}
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500 font-medium">Gross Payroll</p>
            <h4 className="text-lg font-bold text-slate-900 mt-0.5">
              ₹{totalGrossPayroll.toLocaleString()}
            </h4>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <p className="text-[11px] text-[#5e2b9d] font-medium">Attendance Bonuses</p>
            <h4 className="text-lg font-bold text-[#5e2b9d] mt-0.5">
              ₹{totalBonusPaid.toLocaleString()}
            </h4>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <p className="text-[11px] text-rose-600 font-medium">Advance Deductions</p>
            <h4 className="text-lg font-bold text-rose-600 mt-0.5">
              -₹{totalAdvanceDeducted.toLocaleString()}
            </h4>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <p className="text-[11px] text-emerald-600 font-medium">Net Payable to Staff</p>
            <h4 className="text-lg font-bold text-emerald-700 mt-0.5">
              ₹{totalNetPayable.toLocaleString()}
            </h4>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search staff by name or 7-digit ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            Staff Count: <strong className="text-slate-900 font-semibold">{filteredRecords.length}</strong>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-500">Calculating payroll for {monthTitle}...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No employee records found for this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3 text-right">Base Salary</th>
                    <th className="py-2.5 px-3 text-center">Attendance Details</th>
                    <th className="py-2.5 px-3 text-center">Accepted Leaves</th>
                    <th className="py-2.5 px-3 text-center">Full Attendance Bonus</th>
                    <th className="py-2.5 px-3 text-right">Advance Deduction</th>
                    <th className="py-2.5 px-3 text-right">Net Payable</th>
                    <th className="py-2.5 px-3 text-right">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r) => {
                    return (
                      <tr key={r.employeeId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {r.avatarUrl ? (
                              <img
                                src={r.avatarUrl}
                                alt={r.employeeName}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${getFirstLetterColor(
                                  getFirstLetter(r.employeeName)
                                )}`}
                              >
                                {getFirstLetter(r.employeeName)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{r.employeeName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                #{r.employeeNumericId || "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="font-bold text-slate-900">
                            ₹{r.baseSalary.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ₹{r.perDaySalary}/day
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className="text-emerald-700 font-semibold" title="Days Present">
                              {r.presentDays}P
                            </span>
                            {r.halfDays > 0 && (
                              <span className="text-amber-700 font-semibold" title="Half Days (0.5)">
                                +{r.halfDays}HD
                              </span>
                            )}
                            {r.unexcusedAbsences > 0 && (
                              <span className="text-rose-600 font-bold" title="Unexcused Absences">
                                -{r.unexcusedAbsences}A
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="text-[11px]">
                            <span className="font-semibold text-slate-800">
                              {r.acceptedLeaves} allowed
                            </span>
                            <div className="text-[10px] text-[#5e2b9d]">
                              ({r.approvedLeavesTaken} taken, {r.payableLeaves} paid)
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={r.applyBonus}
                                onChange={() => handleToggleBonus(r.employeeId)}
                                className="w-3.5 h-3.5 text-[#5e2b9d] rounded focus:ring-[#5e2b9d]"
                              />
                              <span
                                className={`text-[11px] font-bold ${
                                  r.applyBonus ? "text-[#5e2b9d]" : "text-slate-400"
                                }`}
                              >
                                {r.applyBonus ? `+₹${r.bonusAmount.toLocaleString()}` : "No Bonus"}
                              </span>
                            </label>

                            {r.isBonusEligible ? (
                              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                ✓ Eligible
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-1 py-0.2 rounded">
                                Unexcused Absences
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-xs">-₹</span>
                              <input
                                type="number"
                                min="0"
                                max={Math.min(r.pendingAdvance, r.grossEarnings)}
                                value={r.advanceDeduction}
                                onChange={(e) => handleDeductionChange(r.employeeId, e.target.value)}
                                className="w-20 h-[28px] px-1.5 text-xs text-right font-bold text-rose-600 bg-[#f8fafc] border border-slate-200 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            </div>
                            {r.pendingAdvance > 0 && (
                              <span className="text-[10px] text-slate-400">
                                Pending: ₹{r.pendingAdvance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200">
                            ₹{r.netSalary.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipRecord(r)}
                            className="h-[28px] px-2.5 text-xs font-semibold text-[#5e2b9d] hover:text-white bg-purple-50 hover:bg-[#5e2b9d] rounded-[6px] border border-purple-200 transition-colors cursor-pointer"
                          >
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
        </div>

        {/* ══════════════════════════════════════════════════════
            PAYSLIP MODAL (View & Print)
        ══════════════════════════════════════════════════════ */}
        {selectedPayslipRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f8fafc] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Salary Payslip — {monthTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintPayslip}
                    className="h-[30px] px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayslipRecord(null)}
                    className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div ref={printableRef} className="p-5 space-y-4 overflow-y-auto">
                {/* Store & Payslip Header */}
                <div className="flex items-start justify-between border-b pb-3 border-slate-200">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      RETAIL NEXT STORE
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Employee Monthly Salary Slip
                    </p>
                    <p className="text-xs font-semibold text-[#5e2b9d] mt-1">
                      Pay Period: {monthTitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-[4px] text-xs font-mono font-bold bg-[#5e2b9d]/10 text-[#5e2b9d]">
                      #{selectedPayslipRecord.employeeNumericId || "STAFF"}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Divisor: {payrollData?.monthDivisor || 30} Days
                    </p>
                  </div>
                </div>

                {/* Employee Details Card */}
                <div className="bg-[#f8fafc] p-3 rounded-[6px] border border-slate-200 grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Employee Name
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedPayslipRecord.employeeName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Mobile Number
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedPayslipRecord.mobile || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Salary Structure
                    </span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedPayslipRecord.salaryType} (₹{selectedPayslipRecord.baseSalary.toLocaleString()})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Daily Divisor Rate
                    </span>
                    <span className="font-semibold text-slate-800">
                      ₹{selectedPayslipRecord.perDaySalary} / day
                    </span>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-[6px] bg-[#f8fafc] border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Present</span>
                    <strong className="text-slate-900 font-bold">{selectedPayslipRecord.presentDays}</strong>
                  </div>
                  <div className="p-2 rounded-[6px] bg-[#f8fafc] border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Half Day</span>
                    <strong className="text-slate-900 font-bold">{selectedPayslipRecord.halfDays}</strong>
                  </div>
                  <div className="p-2 rounded-[6px] bg-[#f8fafc] border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Paid Leaves</span>
                    <strong className="text-[#5e2b9d] font-bold">{selectedPayslipRecord.payableLeaves}</strong>
                  </div>
                  <div className="p-2 rounded-[6px] bg-[#f8fafc] border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Absences</span>
                    <strong className="text-rose-600 font-bold">{selectedPayslipRecord.unexcusedAbsences}</strong>
                  </div>
                </div>

                {/* Earnings & Deductions Breakdown */}
                <div className="border border-slate-200 rounded-[6px] overflow-hidden text-xs">
                  <div className="grid grid-cols-2 divide-x divide-slate-200 bg-[#f8fafc] font-bold text-[11px] text-slate-700 py-1.5 px-3">
                    <div>EARNINGS</div>
                    <div className="pl-3">DEDUCTIONS</div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-slate-200 p-3 gap-y-2">
                    <div className="space-y-1.5 pr-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Base Salary:</span>
                        <strong className="text-slate-900">
                          ₹{selectedPayslipRecord.baseSalary.toLocaleString()}
                        </strong>
                      </div>
                      {selectedPayslipRecord.applyBonus && (
                        <div className="flex justify-between text-[#5e2b9d] font-semibold">
                          <span>Full Attendance Bonus ({selectedPayslipRecord.bonusDays}d):</span>
                          <span>+₹{selectedPayslipRecord.bonusAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-1 flex justify-between font-bold text-slate-800">
                        <span>Gross Earnings:</span>
                        <span>₹{selectedPayslipRecord.grossEarnings.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pl-3">
                      {selectedPayslipRecord.unexcusedAbsences > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Absence Penalty ({selectedPayslipRecord.unexcusedAbsences}d):</span>
                          <span>
                            -₹
                            {(
                              selectedPayslipRecord.unexcusedAbsences *
                              selectedPayslipRecord.perDaySalary
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedPayslipRecord.advanceDeduction > 0 && (
                        <div className="flex justify-between text-rose-600 font-medium">
                          <span>Salary Advance Deduction:</span>
                          <span>-₹{selectedPayslipRecord.advanceDeduction.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-1 flex justify-between font-bold text-rose-700">
                        <span>Total Deductions:</span>
                        <span>
                          -₹
                          {(
                            (selectedPayslipRecord.unexcusedAbsences *
                              selectedPayslipRecord.perDaySalary) +
                            selectedPayslipRecord.advanceDeduction
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Payable Highlight Card */}
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-[6px] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                      Net Salary Payable
                    </span>
                    <span className="text-[10.5px] text-emerald-600">
                      Disbursement after all additions and deductions
                    </span>
                  </div>
                  <span className="text-xl font-bold text-emerald-700">
                    ₹{selectedPayslipRecord.netSalary.toLocaleString()}
                  </span>
                </div>

                {/* Signatures */}
                <div className="pt-4 flex justify-between text-xs text-slate-400 border-t border-slate-100">
                  <div>
                    <div className="w-32 border-b border-slate-300 pb-1 mb-1"></div>
                    <span>Employee Signature</span>
                  </div>
                  <div className="text-right">
                    <div className="w-32 border-b border-slate-300 pb-1 mb-1 ml-auto"></div>
                    <span>Store Manager</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-3 border-t border-slate-100 bg-[#f8fafc] flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPayslipRecord(null)}
                  className="h-[34px] px-3.5 rounded-[6px] text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintPayslip}
                  className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs cursor-pointer"
                >
                  Print Payslip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
