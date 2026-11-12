"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface EmployeeAttendanceRecord {
  employeeId: string;
  employeeNumericId: string;
  employeeName: string;
  mobile: string;
  status: "Present" | "Absent" | "Half Day" | "Leave";
  isLeave?: boolean;
}

export default function EmployeeAttendancePage() {
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "Present" | "Absent" | "Half Day" | "Leave">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load employees and attendance for date
  const loadAttendanceData = useCallback(async (dateToFetch: string) => {
    try {
      setLoading(true);
      const [empRes, attRes] = await Promise.all([
        fetch("/api/employees?all=true"),
        fetch(`/api/employees/attendance?date=${dateToFetch}`),
      ]);

      let empList: any[] = [];
      if (empRes.ok) {
        const eData = await empRes.json();
        if (eData.success && Array.isArray(eData.employees)) {
          empList = eData.employees.filter((e: any) => e.status !== "Terminated" && e.status !== "Inactive");
          setEmployees(empList);
        }
      }

      const map: Record<string, "Present" | "Absent" | "Half Day" | "Leave"> = {};
      if (attRes.ok) {
        const aData = await attRes.json();
        if (aData.success && Array.isArray(aData.attendance)) {
          aData.attendance.forEach((rec: any) => {
            map[rec.employeeId] = rec.status;
          });
        }
      }

      // Default unmarked employees to "Present"
      empList.forEach((e) => {
        if (!map[e.id]) {
          map[e.id] = "Present";
        }
      });

      setAttendanceMap(map);
    } catch {
      toast.error("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendanceData(selectedDate);
  }, [selectedDate, loadAttendanceData]);

  // Handle single employee status toggle
  const handleSetStatus = (empId: string, status: "Present" | "Absent" | "Half Day" | "Leave") => {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: status,
    }));
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    const updated: Record<string, "Present" | "Absent" | "Half Day" | "Leave"> = {};
    employees.forEach((e) => {
      updated[e.id] = "Present";
    });
    setAttendanceMap(updated);
    toast.success("All employees marked as Present.");
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      const records = employees.map((e) => ({
        employeeId: e.id,
        employeeNumericId: e.employeeId || "",
        employeeName: e.name,
        date: selectedDate,
        status: attendanceMap[e.id] || "Present",
        isLeave: attendanceMap[e.id] === "Leave",
      }));

      const res = await fetch("/api/employees/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Attendance saved for ${selectedDate}.`);
      } else {
        toast.error(data.error || "Failed to save attendance.");
      }
    } catch {
      toast.error("Network error while saving attendance.");
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (e.name || "").toLowerCase().includes(q) ||
        (e.employeeId || "").toLowerCase().includes(q) ||
        (e.mobile || "").includes(q)
      );
    });
  }, [employees, searchQuery]);

  // Quick stats
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    employees.forEach((e) => {
      const st = attendanceMap[e.id] || "Present";
      if (st === "Present") present++;
      else if (st === "Absent") absent++;
      else if (st === "Half Day") halfDay++;
      else if (st === "Leave") leave++;
    });

    return { total: employees.length, present, absent, halfDay, leave };
  }, [employees, attendanceMap]);

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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Attendance Register</h1>
                <p className="text-xs text-slate-500">
                  Daily staff muster roll, present/absent logs & biometric QR scanner synchronization
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/attendance-scan"
              target="_blank"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>Launch QR Scanner</span>
            </Link>

            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="h-9 px-3 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
            >
              Mark All Present
            </button>

            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#5e2b9d] hover:bg-[#4d2282] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Spinner className="w-3.5 h-3.5 text-white" /> : "✓"}
              <span>Save Register</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Active Staff
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">{stats.total}</span>
              <span className="text-[10px] text-slate-400 font-medium">Headcount</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Present Today
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">{stats.present}</span>
              <span className="text-[10px] text-emerald-700 font-medium">On duty</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Absent / Off
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 font-mono">{stats.absent}</span>
              <span className="text-[10px] text-rose-700 font-medium">Unexcused</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Leaves & Half Days
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono">{stats.leave + stats.halfDay}</span>
              <span className="text-[10px] text-amber-700 font-medium">Approved</span>
            </div>
          </div>
        </div>

        {/* Date Selector & Search */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600">Register Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 px-3 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
          </div>

          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name or ID..."
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Attendance Register Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Designation / Salary Type</th>
                  <th className="py-3 px-4 text-center">Muster Roll Status Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading attendance muster roll...</span>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No staff members found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Add employees under Employee Directory.</p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const currentStatus = attendanceMap[emp.id] || "Present";

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                          {emp.employeeId && (
                            <div className="text-[10px] text-slate-400 font-mono">Emp #{emp.employeeId}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          📱 {emp.mobile || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize text-slate-700 font-medium">{emp.salaryType || "Monthly"}</span>
                          <span className="text-[10.5px] text-slate-400 block">{emp.city || "Head Office"}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            {(["Present", "Absent", "Half Day", "Leave"] as const).map((st) => {
                              const isSelected = currentStatus === st;
                              let activeClass = "bg-white text-slate-800 shadow-2xs";
                              if (isSelected) {
                                if (st === "Present") activeClass = "bg-emerald-600 text-white shadow-xs";
                                else if (st === "Absent") activeClass = "bg-rose-600 text-white shadow-xs";
                                else if (st === "Half Day") activeClass = "bg-amber-500 text-white shadow-xs";
                                else if (st === "Leave") activeClass = "bg-[#5e2b9d] text-white shadow-xs";
                              }

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleSetStatus(emp.id, st)}
                                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? activeClass
                                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SoftwareLayout>
  );
}
