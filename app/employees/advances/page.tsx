"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import PaginationControls from "@/components/ui/PaginationControls";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";

interface AdvanceRecord {
  id: string;
  storeId?: string;
  employeeId: string;
  employeeNumericId?: string;
  employeeName: string;
  amount: number;
  remainingAmount: number;
  date: string;
  notes?: string;
  status: "Pending" | "Partially Repaid" | "Repaid";
  createdAt: number;
}

export default function EmployeeAdvancesPage() {
  const toast = useToast();

  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination (Strictly 24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [repayingAdvance, setRepayingAdvance] = useState<AdvanceRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Advance Form State
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeNumericId: "",
    employeeName: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees/advances");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.advances)) {
        setAdvances(data.advances);
      } else {
        toast.error(data.error || "Failed to load employee advances.");
      }
    } catch {
      toast.error("Network error while loading advances.");
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
    fetchAdvances();
    loadEmployees();
  }, [fetchAdvances, loadEmployees]);

  // Filter
  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !a.employeeName.toLowerCase().includes(q) && !(a.employeeId || "").includes(q)) return false;
      if (statusFilter === "pending" && a.remainingAmount <= 0) return false;
      if (statusFilter === "repaid" && a.remainingAmount > 0) return false;
      return true;
    });
  }, [advances, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAdvances.length / PAGE_SIZE));
  const paginatedAdvances = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAdvances.slice(start, start + PAGE_SIZE);
  }, [filteredAdvances, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const totalIssued = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalRemaining = advances.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);
    const totalRepaid = totalIssued - totalRemaining;
    return { totalIssued, totalRemaining, totalRepaid };
  }, [advances]);

  // Issue Advance
  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || formData.amount <= 0) {
      toast.error("Please select an employee and enter a positive advance amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/employees/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Advance of ₹${formData.amount.toLocaleString("en-IN")} issued to ${formData.employeeName}.`);
        setIsAddModalOpen(false);
        fetchAdvances();
      } else {
        toast.error(data.error || "Failed to issue advance.");
      }
    } catch {
      toast.error("Network error while recording advance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record Repayment
  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingAdvance || repayAmount <= 0) {
      toast.error("Enter a valid repayment amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/employees/advances/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceId: repayingAdvance.id,
          employeeId: repayingAdvance.employeeId,
          amount: repayAmount,
          date: new Date().toISOString().slice(0, 10),
          notes: "Manual deduction / cash settlement",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Repayment of ₹${repayAmount.toLocaleString("en-IN")} recorded.`);
        setRepayingAdvance(null);
        fetchAdvances();
      } else {
        toast.error(data.error || "Failed to record repayment.");
      }
    } catch {
      toast.error("Network error while recording repayment.");
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Employee Advances & Deductions</h1>
                <p className="text-xs text-slate-500">
                  Track salary advances, loan disbursements & automated monthly payroll deduction ledger
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchAdvances}
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
                  amount: 0,
                  date: new Date().toISOString().slice(0, 10),
                  notes: "",
                });
                setIsAddModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Issue Salary Advance</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Advances Disbursed
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{stats.totalIssued.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">({advances.length} records)</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Remaining Balance
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">
                ₹{stats.totalRemaining.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">To be deducted</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Recovered / Repaid
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                ₹{stats.totalRepaid.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Deducted</span>
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
            {["all", "pending", "repaid"].map((st) => (
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Disbursed Date</th>
                  <th className="py-3 px-4 text-right">Disbursed Amount ₹</th>
                  <th className="py-3 px-4 text-right">Remaining Due ₹</th>
                  <th className="py-3 px-4">Notes / Purpose</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading advances...</span>
                    </td>
                  </tr>
                ) : paginatedAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No advance records found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Issue Salary Advance&quot; to disburse staff loans.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAdvances.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{a.employeeName}</div>
                        {a.employeeNumericId && (
                          <div className="text-[10px] text-slate-400 font-mono">Emp #{a.employeeNumericId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {a.date}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{(a.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {a.remainingAmount > 0 ? (
                          <span className="text-rose-600">₹{a.remainingAmount.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-emerald-600">₹0 (Cleared)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {a.notes || "Salary advance"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            a.remainingAmount <= 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {a.remainingAmount <= 0 ? "Repaid" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {a.remainingAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRepayingAdvance(a);
                              setRepayAmount(a.remainingAmount);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Repay
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredAdvances.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredAdvances.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="advances"
              />
            </div>
          )}
        </div>

        {/* Issue Advance Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Issue Salary Advance</h3>
                  <p className="text-[11px] text-purple-200">Record advance to be deducted from monthly payroll</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleIssueAdvance} className="p-5 space-y-4 text-xs">
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
                      Advance Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={100}
                      required
                      placeholder="e.g. 5000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 font-mono font-bold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Disbursement Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full h-9 px-3 font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Purpose
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Medical emergency advance"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
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
                    <span>Disburse Advance</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Repay Modal */}
        {repayingAdvance && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">Record Advance Repayment</h3>
                <button
                  type="button"
                  onClick={() => setRepayingAdvance(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRepay} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Employee:</span>
                    <span className="font-semibold text-slate-800">{repayingAdvance.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Outstanding Balance:</span>
                    <span className="font-mono font-bold text-rose-600">₹{repayingAdvance.remainingAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Repayment Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={repayingAdvance.remainingAmount}
                    required
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 font-mono font-bold text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRepayingAdvance(null)}
                    className="h-8 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-8 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Processing..." : "Confirm Repayment"}
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
