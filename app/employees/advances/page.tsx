"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import EmployeeSearchPicker, { EmployeeSummary } from "@/components/EmployeeSearchPicker";
import CustomDatePicker from "@/components/CustomDatePicker";
import { useToast } from "@/components/ToastProvider";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

interface Advance {
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

interface Repayment {
  id: string;
  storeId?: string;
  employeeId: string;
  employeeNumericId?: string;
  employeeName: string;
  amount: number;
  date: string;
  notes?: string;
  settlementSummary?: {
    advanceId: string;
    settled: number;
    newRemaining: number;
    status: string;
  }[];
  createdAt: number;
}

export default function EmployeeAdvancesPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"advances" | "repayment" | "analysis">("advances");

  /* ──────── Common Data ──────── */
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState(true);
  const [loadingRepayments, setLoadingRepayments] = useState(false);

  /* ──────── Tab 1: Add Advance Modal State ──────── */
  const [isAddAdvanceOpen, setIsAddAdvanceOpen] = useState(false);
  const [advEmp, setAdvEmp] = useState<EmployeeSummary | null>(null);
  const [advAmount, setAdvAmount] = useState("");
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [advNotes, setAdvNotes] = useState("");
  const [advSubmitting, setAdvSubmitting] = useState(false);
  const [advError, setAdvError] = useState("");
  const [advSearchFilter, setAdvSearchFilter] = useState("");

  /* ──────── Tab 2: Repayment Modal / Form State ──────── */
  const [isRecordRepaymentOpen, setIsRecordRepaymentOpen] = useState(false);
  const [repayEmp, setRepayEmp] = useState<EmployeeSummary | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [repayNotes, setRepayNotes] = useState("");
  const [repaySubmitting, setRepaySubmitting] = useState(false);
  const [repayError, setRepayError] = useState("");
  const [repaySearchFilter, setRepaySearchFilter] = useState("");

  const inputCls =
    "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";

  /* ──────── Loaders ──────── */
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

  const loadAdvances = async () => {
    setLoadingAdvances(true);
    try {
      const res = await fetch("/api/employees/advances");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.advances)) {
        setAdvances(data.advances);
      }
    } catch {
      toast.error("Failed to load advances.");
    } finally {
      setLoadingAdvances(false);
    }
  };

  const loadRepayments = async () => {
    setLoadingRepayments(true);
    try {
      const res = await fetch("/api/employees/advances/repay");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.repayments)) {
        setRepayments(data.repayments);
      }
    } catch {
      toast.error("Failed to load repayment records.");
    } finally {
      setLoadingRepayments(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadAdvances();
    loadRepayments();
  }, []); // eslint-disable-line

  const empPendingAdvances = useMemo(() => {
    if (!repayEmp) return [];
    return advances
      .filter((a) => a.employeeId === repayEmp.id && (a.remainingAmount || 0) > 0 && a.status !== "Repaid")
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [advances, repayEmp]);

  const empTotalOutstanding = useMemo(() => {
    return empPendingAdvances.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);
  }, [empPendingAdvances]);

  const simulatedFifoPlan = useMemo(() => {
    const num = Number(repayAmount);
    if (!num || num <= 0 || empPendingAdvances.length === 0) return [];

    let left = num;
    return empPendingAdvances.map((adv) => {
      const curr = adv.remainingAmount || 0;
      if (left <= 0) {
        return {
          id: adv.id,
          date: adv.date,
          original: adv.amount,
          currentRemaining: curr,
          settled: 0,
          futureRemaining: curr,
          status: adv.status,
        };
      }

      if (left >= curr) {
        const settled = curr;
        left -= curr;
        return {
          id: adv.id,
          date: adv.date,
          original: adv.amount,
          currentRemaining: curr,
          settled,
          futureRemaining: 0,
          status: "Repaid",
        };
      } else {
        const settled = left;
        const futureRemaining = curr - left;
        left = 0;
        return {
          id: adv.id,
          date: adv.date,
          original: adv.amount,
          currentRemaining: curr,
          settled,
          futureRemaining,
          status: "Partially Repaid",
        };
      }
    });
  }, [repayAmount, empPendingAdvances]);

  /* ──────── Handlers: Tab 1 Add Advance ──────── */
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advEmp) {
      setAdvError("Please search and select an employee.");
      return;
    }
    const num = Number(advAmount);
    if (!num || num <= 0) {
      setAdvError("Please enter a valid advance amount greater than 0.");
      return;
    }

    try {
      setAdvSubmitting(true);
      setAdvError("");
      const res = await fetch("/api/employees/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: advEmp.id,
          employeeNumericId: advEmp.employeeId || "",
          employeeName: advEmp.name,
          amount: num,
          date: advDate,
          notes: advNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Advance of ₹${num.toLocaleString()} recorded for ${advEmp.name}`);
        setIsAddAdvanceOpen(false);
        setAdvEmp(null);
        setAdvAmount("");
        setAdvNotes("");
        loadAdvances();
      } else {
        setAdvError(data.error || "Failed to record advance.");
      }
    } catch {
      setAdvError("Network error. Please try again.");
    } finally {
      setAdvSubmitting(false);
    }
  };

  /* ──────── Handlers: Tab 2 Record Repayment ──────── */
  const handleSaveRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayEmp) {
      setRepayError("Please search and select an employee.");
      return;
    }
    const num = Number(repayAmount);
    if (!num || num <= 0) {
      setRepayError("Please enter a valid repayment amount.");
      return;
    }
    if (num > empTotalOutstanding) {
      setRepayError(
        `Repayment amount (₹${num.toLocaleString()}) cannot exceed total pending advances (₹${empTotalOutstanding.toLocaleString()}).`
      );
      return;
    }

    try {
      setRepaySubmitting(true);
      setRepayError("");
      const res = await fetch("/api/employees/advances/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: repayEmp.id,
          employeeNumericId: repayEmp.employeeId || "",
          employeeName: repayEmp.name,
          amount: num,
          date: repayDate,
          notes: repayNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Repayment of ₹${num.toLocaleString()} processed!`);
        setIsRecordRepaymentOpen(false);
        setRepayEmp(null);
        setRepayAmount("");
        setRepayNotes("");
        loadAdvances();
        loadRepayments();
      } else {
        setRepayError(data.error || "Failed to process repayment.");
      }
    } catch {
      setRepayError("Network error during repayment.");
    } finally {
      setRepaySubmitting(false);
    }
  };

  /* ──────── Tab 3: Aggregate Analysis Calculations ──────── */
  const storeTotalAdvances = useMemo(() => {
    return advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [advances]);

  const storeTotalRepaid = useMemo(() => {
    return advances.reduce((sum, a) => {
      const orig = Number(a.amount) || 0;
      const rem = Number(a.remainingAmount) || 0;
      return sum + (orig - rem);
    }, 0);
  }, [advances]);

  const storeTotalPending = useMemo(() => {
    return advances.reduce((sum, a) => sum + (Number(a.remainingAmount) || 0), 0);
  }, [advances]);

  const employeeAnalysisList = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: EmployeeSummary;
        totalTaken: number;
        totalRepaid: number;
        totalPending: number;
        pendingCount: number;
      }
    >();

    advances.forEach((a) => {
      const emp = employees.find((e) => e.id === a.employeeId) || {
        id: a.employeeId,
        name: a.employeeName,
        employeeId: a.employeeNumericId,
        mobile: "",
      };

      if (!map.has(a.employeeId)) {
        map.set(a.employeeId, {
          employee: emp,
          totalTaken: 0,
          totalRepaid: 0,
          totalPending: 0,
          pendingCount: 0,
        });
      }

      const row = map.get(a.employeeId)!;
      const amt = Number(a.amount) || 0;
      const rem = Number(a.remainingAmount) || 0;
      row.totalTaken += amt;
      row.totalRepaid += amt - rem;
      row.totalPending += rem;
      if (rem > 0 && a.status !== "Repaid") {
        row.pendingCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [advances, employees]);

  const handleQuickSettle = (emp: EmployeeSummary) => {
    setRepayEmp(emp);
    setRepayAmount("");
    setRepayNotes("");
    setIsRecordRepaymentOpen(true);
    setActiveTab("repayment");
  };

  const filteredAdvances = useMemo(() => {
    const q = advSearchFilter.trim().toLowerCase();
    if (!q) return advances;
    return advances.filter((a) => {
      const name = (a.employeeName || "").toLowerCase();
      const numId = String(a.employeeNumericId || "").toLowerCase();
      const st = (a.status || "").toLowerCase();
      return name.includes(q) || numId.includes(q) || st.includes(q);
    });
  }, [advances, advSearchFilter]);

  const filteredRepayments = useMemo(() => {
    const q = repaySearchFilter.trim().toLowerCase();
    if (!q) return repayments;
    return repayments.filter((r) => {
      const name = (r.employeeName || "").toLowerCase();
      const numId = String(r.employeeNumericId || "").toLowerCase();
      return name.includes(q) || numId.includes(q);
    });
  }, [repayments, repaySearchFilter]);

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
                Advances &amp; Repayments
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {advances.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Issue salary advances, record FIFO repayments, and inspect pending balances.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setAdvEmp(null);
                setAdvAmount("");
                setAdvNotes("");
                setAdvDate(new Date().toISOString().split("T")[0]);
                setAdvError("");
                setIsAddAdvanceOpen(true);
              }}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Advance</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRepayEmp(null);
                setRepayAmount("");
                setRepayNotes("");
                setRepayDate(new Date().toISOString().split("T")[0]);
                setRepayError("");
                setIsRecordRepaymentOpen(true);
              }}
              className="h-[34px] max-h-[34px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs px-3 rounded-[6px] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2] text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Record Repayment</span>
            </button>
          </div>
        </div>

        {/* Local Tab Navigation (Advances | Repayment | Pending Analysis) */}
        <div className="flex items-center gap-1 border-b border-slate-200/80 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab("advances")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "advances"
                ? "border-[#5e2b9d] text-[#5e2b9d] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>All Advances ({advances.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("repayment")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "repayment"
                ? "border-[#5e2b9d] text-[#5e2b9d] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Repayment History ({repayments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analysis")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "analysis"
                ? "border-[#5e2b9d] text-[#5e2b9d] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Pending Analysis</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB 1: ADVANCES LIST
        ══════════════════════════════════════════════════════ */}
        {activeTab === "advances" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
              <div className="relative flex-1">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter by employee name or 7-digit ID..."
                  value={advSearchFilter}
                  onChange={(e) => setAdvSearchFilter(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                Total Advances: <strong className="text-slate-900 font-medium">{filteredAdvances.length}</strong>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              {loadingAdvances ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Loading advances...</p>
                </div>
              ) : filteredAdvances.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] mx-auto flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-slate-800">No advances recorded</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;Add Advance&quot; above to issue a salary advance to an employee.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Advance Amount</th>
                        <th className="py-2.5 px-3 text-right">Remaining Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAdvances.map((adv) => {
                        const rem = Number(adv.remainingAmount) || 0;
                        const orig = Number(adv.amount) || 0;
                        const isRepaid = rem === 0 || adv.status === "Repaid";
                        const isPartial = rem > 0 && rem < orig;

                        return (
                          <tr key={adv.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-xs shrink-0 border ${getFirstLetterColor(
                                    getFirstLetter(adv.employeeName)
                                  )}`}
                                >
                                  {getFirstLetter(adv.employeeName)}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">{adv.employeeName}</div>
                                  {adv.employeeNumericId && (
                                    <div className="text-[10px] font-mono text-[#5e2b9d]">
                                      #{adv.employeeNumericId}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              {new Date(adv.date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                              ₹{orig.toLocaleString()}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`font-medium ${
                                  rem > 0 ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                ₹{rem.toLocaleString()}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {isRepaid ? (
                                <span className="inline-flex px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Repaid
                                </span>
                              ) : isPartial ? (
                                <span className="inline-flex px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  Partially Repaid
                                </span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                  Pending
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 max-w-xs truncate text-slate-500 italic">
                              {adv.notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: REPAYMENT HISTORY
        ══════════════════════════════════════════════════════ */}
        {activeTab === "repayment" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
              <div className="relative flex-1">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter repayments by employee..."
                  value={repaySearchFilter}
                  onChange={(e) => setRepaySearchFilter(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setRepayEmp(null);
                  setRepayAmount("");
                  setRepayNotes("");
                  setRepayDate(new Date().toISOString().split("T")[0]);
                  setRepayError("");
                  setIsRecordRepaymentOpen(true);
                }}
                className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Record New Repayment</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              {loadingRepayments ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Loading repayment history...</p>
                </div>
              ) : filteredRepayments.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-xs font-medium text-slate-800">No repayment entries found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;Record New Repayment&quot; to settle employee advances using FIFO.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Repayment Date</th>
                        <th className="py-2.5 px-3 text-right">Repaid Amount</th>
                        <th className="py-2.5 px-3">FIFO Settlement Breakdown</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRepayments.map((rep) => (
                        <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-xs shrink-0 border ${getFirstLetterColor(
                                  getFirstLetter(rep.employeeName)
                                )}`}
                              >
                                {getFirstLetter(rep.employeeName)}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{rep.employeeName}</div>
                                {rep.employeeNumericId && (
                                  <div className="text-[10px] font-mono text-[#5e2b9d]">
                                    #{rep.employeeNumericId}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {new Date(rep.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                            ₹{(Number(rep.amount) || 0).toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3">
                            {rep.settlementSummary && rep.settlementSummary.length > 0 ? (
                              <div className="space-y-1">
                                {rep.settlementSummary.map((s, idx) => (
                                  <div key={idx} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                    <span className="font-medium text-[#5e2b9d]">
                                      Adv #{idx + 1}:
                                    </span>
                                    <span>Settled ₹{s.settled?.toLocaleString()}</span>
                                    <span
                                      className={`px-1 py-0.2 rounded-[3px] text-[9.5px] font-medium ${
                                        s.status === "Repaid"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {s.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">FIFO Settled</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 max-w-xs truncate text-slate-500 italic">
                            {rep.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: PENDING ANALYSIS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "analysis" && (
          <div className="flex flex-col">
            {/* Store Level Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Total Advances Issued</p>
                  <h3 className="text-lg font-medium text-slate-900 mt-0.5">
                    ₹{storeTotalAdvances.toLocaleString()}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-[6px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                  <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Total Repaid Back</p>
                  <h3 className="text-lg font-medium text-emerald-600 mt-0.5">
                    ₹{storeTotalRepaid.toLocaleString()}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Total Outstanding Pending</p>
                  <h3 className="text-lg font-medium text-rose-600 mt-0.5">
                    ₹{storeTotalPending.toLocaleString()}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-[6px] bg-rose-50 text-rose-600 flex items-center justify-center">
                  <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Employee Breakdown Table */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-[#f8fafc]">
                <h3 className="text-xs font-medium text-slate-800">
                  Employee-Wise Pending Balance Breakdown
                </h3>
                <span className="text-[11px] text-slate-500">
                  {employeeAnalysisList.length} staff records
                </span>
              </div>

              {employeeAnalysisList.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No advance balances found across staff.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3 text-right">Total Taken</th>
                        <th className="py-2.5 px-3 text-right">Total Repaid</th>
                        <th className="py-2.5 px-3 text-right">Pending Balance</th>
                        <th className="py-2.5 px-3 text-center">Pending Advances</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employeeAnalysisList.map((row) => (
                        <tr key={row.employee.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-xs shrink-0 border ${getFirstLetterColor(
                                  getFirstLetter(row.employee.name)
                                )}`}
                              >
                                {getFirstLetter(row.employee.name)}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{row.employee.name}</div>
                                {row.employee.employeeId && (
                                  <div className="text-[10px] font-mono text-[#5e2b9d]">
                                    #{row.employee.employeeId}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                            ₹{row.totalTaken.toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                            ₹{row.totalRepaid.toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`font-medium ${
                                row.totalPending > 0 ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              ₹{row.totalPending.toLocaleString()}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {row.pendingCount > 0 ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                {row.pendingCount} pending
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Fully Settled
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {row.totalPending > 0 && (
                              <button
                                type="button"
                                onClick={() => handleQuickSettle(row.employee)}
                                className="h-[28px] px-2.5 text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] rounded-[6px] transition-colors cursor-pointer"
                              >
                                Settle / Repay
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MODAL 1: ADD ADVANCE (Search-Only Picker)
        ══════════════════════════════════════════════════════ */}
        {isAddAdvanceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-md overflow-visible relative">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f8fafc] rounded-t-[6px]">
                <h3 className="text-sm font-medium text-slate-900">Issue Salary Advance</h3>
                <button
                  type="button"
                  onClick={() => setIsAddAdvanceOpen(false)}
                  className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveAdvance} className="p-4 space-y-3">
                {advError && (
                  <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-[4px]">
                    {advError}
                  </div>
                )}

                <EmployeeSearchPicker
                  label="Search & Select Employee"
                  required
                  employees={employees}
                  selectedEmployee={advEmp}
                  onSelectEmployee={(emp) => {
                    setAdvEmp(emp);
                    setAdvError("");
                  }}
                  placeholder="Type Name, 7-digit ID, or Mobile..."
                  helperText="Search is required to pick an employee (no pre-loaded full list)."
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Advance Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 5000"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <CustomDatePicker
                      label="Date"
                      required
                      value={advDate}
                      onChange={(d) => setAdvDate(d)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Festival advance, Medical advance..."
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddAdvanceOpen(false)}
                    className="h-[34px] px-3.5 rounded-[6px] text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={advSubmitting}
                    className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {advSubmitting ? "Saving..." : "Save Advance"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MODAL 2: RECORD REPAYMENT (FIFO Settlement)
        ══════════════════════════════════════════════════════ */}
        {isRecordRepaymentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-visible relative max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f8fafc] shrink-0 rounded-t-[6px]">
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Record Advance Repayment</h3>
                  <p className="text-[11px] text-slate-500">
                    Repayments automatically settle oldest pending advances first (FIFO).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecordRepaymentOpen(false)}
                  className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveRepayment} className="p-4 space-y-3 overflow-y-auto">
                {repayError && (
                  <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-[4px]">
                    {repayError}
                  </div>
                )}

                <EmployeeSearchPicker
                  label="Search & Select Employee"
                  required
                  employees={employees}
                  selectedEmployee={repayEmp}
                  onSelectEmployee={(emp) => {
                    setRepayEmp(emp);
                    setRepayError("");
                  }}
                  placeholder="Type Name, 7-digit ID, or Mobile..."
                  helperText="Search is required to pick an employee (no pre-loaded full list)."
                />

                {repayEmp && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800">
                        Pending Advances ({empPendingAdvances.length})
                      </span>
                      <span className="text-xs font-medium text-rose-600">
                        Total Outstanding: ₹{empTotalOutstanding.toLocaleString()}
                      </span>
                    </div>

                    {empPendingAdvances.length === 0 ? (
                      <div className="p-2.5 bg-emerald-50 rounded-[6px] border border-emerald-200 text-xs text-emerald-800 font-medium">
                        ✓ {repayEmp.name} has no pending advances. All previous advances are fully repaid!
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-[6px] overflow-hidden divide-y divide-slate-100 text-xs bg-slate-50/50">
                        {empPendingAdvances.map((adv, idx) => (
                          <div key={adv.id} className="p-2 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.2 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] font-medium">
                                  #{idx + 1} Oldest
                                </span>
                                <span>Date: {adv.date}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Original: ₹{adv.amount?.toLocaleString()} • Status: {adv.status}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-medium text-rose-600 block">
                                Pending: ₹{adv.remainingAmount?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {repayEmp && empPendingAdvances.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Repayment Amount (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max={empTotalOutstanding}
                          placeholder={`Max ₹${empTotalOutstanding}`}
                          value={repayAmount}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <CustomDatePicker
                          label="Repayment Date"
                          required
                          value={repayDate}
                          onChange={(d) => setRepayDate(d)}
                        />
                      </div>
                    </div>

                    {simulatedFifoPlan.length > 0 && (
                      <div className="p-2.5 bg-[#5e2b9d]/5 border border-[#5e2b9d]/15 rounded-[6px] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#5e2b9d]">
                            FIFO Settlement Distribution:
                          </span>
                          <span className="text-[10.5px] text-slate-500">Oldest first</span>
                        </div>
                        <div className="space-y-1 divide-y divide-purple-100 text-[11px]">
                          {simulatedFifoPlan.map((item, idx) => (
                            <div key={item.id} className="pt-1 flex items-center justify-between">
                              <span className="text-slate-700">
                                Advance #{idx + 1} ({item.date}):
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-emerald-700">
                                  -₹{item.settled.toLocaleString()}
                                </span>
                                <span
                                  className={`px-1 py-0.2 rounded-[3px] text-[9.5px] font-medium ${
                                    item.status === "Repaid"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : item.status === "Partially Repaid"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {item.status} (Bal: ₹{item.futureRemaining.toLocaleString()})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Notes / Reference
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Cash repayment, UPI transfer reference..."
                        value={repayNotes}
                        onChange={(e) => setRepayNotes(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRecordRepaymentOpen(false)}
                    className="h-[34px] px-3.5 rounded-[6px] text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={repaySubmitting || !repayEmp || empPendingAdvances.length === 0}
                    className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {repaySubmitting ? "Processing..." : "Confirm Repayment"}
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
