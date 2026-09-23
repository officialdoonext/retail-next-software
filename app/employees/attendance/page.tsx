"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

interface Employee {
  id: string;
  name: string;
  employeeId?: string;
  mobile?: string;
  avatarUrl?: string;
  salaryType?: "monthly" | "daily";
  salaryAmount?: number;
  acceptedLeaves?: number;
}

interface AttendanceRecord {
  id?: string;
  employeeId: string;
  employeeNumericId?: string;
  employeeName: string;
  status: "Present" | "Absent" | "Half Day";
  isLeave?: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface AttendanceSettings {
  monthDivisor: 30 | 31;
  enableAttendanceBonus: boolean;
  bonusDays: number;
  sundayIsHoliday: boolean;
}

export default function AttendancePage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"attendance" | "holidays" | "salary-logic">("attendance");

  /* ──────── Tab 1: Attendance State ──────── */
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "Present" | "Absent" | "Half Day">>({});
  const [leavesOnDate, setLeavesOnDate] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [savingBulk, setSavingBulk] = useState(false);
  const [savingSingleId, setSavingSingleId] = useState<string | null>(null);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState("");

  /* ──────── Tab 2: Holidays State ──────── */
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);

  /* ──────── Tab 3: Salary Logic Settings ──────── */
  const [settings, setSettings] = useState<AttendanceSettings>({
    monthDivisor: 30,
    enableAttendanceBonus: false,
    bonusDays: 1,
    sundayIsHoliday: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const inputCls =
    "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";

  /* ──────── Load Initial Data ──────── */
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

  const loadAttendanceForDate = async (date: string) => {
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/employees/attendance?date=${date}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLeavesOnDate(data.leavesOnDate || []);

        const map: Record<string, "Present" | "Absent" | "Half Day"> = {};
        if (Array.isArray(data.attendance)) {
          data.attendance.forEach((rec: any) => {
            if (rec.employeeId) {
              map[rec.employeeId] = rec.status;
            }
          });
        }

        const onLeaveEmpIds = new Set((data.leavesOnDate || []).map((l: any) => l.employeeId));
        employees.forEach((emp) => {
          if (onLeaveEmpIds.has(emp.id)) {
            map[emp.id] = "Absent";
          } else if (!map[emp.id]) {
            map[emp.id] = "Present";
          }
        });

        setAttendanceMap(map);
      } else {
        toast.error(data.error || "Failed to load attendance.");
      }
    } catch {
      toast.error("Network error loading attendance.");
    } finally {
      setLoadingAttendance(false);
    }
  };

  const loadHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const res = await fetch("/api/employees/attendance/holidays");
      const data = await res.json();
      if (res.ok && data.success) {
        setHolidays(data.holidays || []);
      }
    } catch {
      toast.error("Failed to load holidays.");
    } finally {
      setLoadingHolidays(false);
    }
  };

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/employees/attendance/settings");
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadHolidays();
    loadSettings();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (employees.length > 0) {
      loadAttendanceForDate(selectedDate);
    }
  }, [selectedDate, employees.length]); // eslint-disable-line

  const onLeaveEmpIdMap = useMemo(() => {
    const map = new Map<string, any>();
    leavesOnDate.forEach((l) => map.set(l.employeeId, l));
    return map;
  }, [leavesOnDate]);

  /* ──────── Handlers: Tab 1 Attendance ──────── */
  const handleStatusChange = (empId: string, status: "Present" | "Absent" | "Half Day") => {
    if (onLeaveEmpIdMap.has(empId)) return;
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: status,
    }));
  };

  const handleQuickMarkAll = (status: "Present" | "Absent") => {
    setAttendanceMap((prev) => {
      const updated = { ...prev };
      employees.forEach((emp) => {
        if (!onLeaveEmpIdMap.has(emp.id)) {
          updated[emp.id] = status;
        }
      });
      return updated;
    });
  };

  const handleSaveSingle = async (emp: Employee) => {
    const isOnLeave = onLeaveEmpIdMap.has(emp.id);
    const status = isOnLeave ? "Absent" : attendanceMap[emp.id] || "Present";

    try {
      setSavingSingleId(emp.id);
      const res = await fetch("/api/employees/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records: [
            {
              employeeId: emp.id,
              employeeNumericId: emp.employeeId || "",
              employeeName: emp.name,
              status,
              isLeave: isOnLeave,
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Saved attendance for ${emp.name}`);
      } else {
        toast.error(data.error || "Failed to save attendance.");
      }
    } catch {
      toast.error("Network error while saving attendance.");
    } finally {
      setSavingSingleId(null);
    }
  };

  const handleBulkSave = async () => {
    if (employees.length === 0) return;

    try {
      setSavingBulk(true);
      const records = employees.map((emp) => {
        const isOnLeave = onLeaveEmpIdMap.has(emp.id);
        const status = isOnLeave ? "Absent" : attendanceMap[emp.id] || "Present";
        return {
          employeeId: emp.id,
          employeeNumericId: emp.employeeId || "",
          employeeName: emp.name,
          status,
          isLeave: isOnLeave,
        };
      });

      const res = await fetch("/api/employees/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Bulk attendance successfully saved for ${records.length} employees!`);
      } else {
        toast.error(data.error || "Failed to save bulk attendance.");
      }
    } catch {
      toast.error("Network error during bulk save.");
    } finally {
      setSavingBulk(false);
    }
  };

  /* ──────── Handlers: Tab 2 Holidays ──────── */
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      toast.error("Holiday Name and Date are required.");
      return;
    }

    try {
      setSavingHoliday(true);
      const res = await fetch("/api/employees/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: holidayName.trim(), date: holidayDate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Holiday added successfully!");
        setHolidays((prev) => [...prev, data.holiday].sort((a, b) => a.date.localeCompare(b.date)));
        setIsAddHolidayOpen(false);
        setHolidayName("");
      } else {
        toast.error(data.error || "Failed to add holiday.");
      }
    } catch {
      toast.error("Network error while adding holiday.");
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      setDeletingHoliday(true);
      const res = await fetch(`/api/employees/attendance/holidays?id=${holidayToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Holiday removed.");
        setHolidays((prev) => prev.filter((h) => h.id !== holidayToDelete.id));
        setHolidayToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete holiday.");
      }
    } catch {
      toast.error("Network error deleting holiday.");
    } finally {
      setDeletingHoliday(false);
    }
  };

  /* ──────── Handlers: Tab 3 Salary Logic Settings ──────── */
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await fetch("/api/employees/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Salary & attendance configuration updated!");
      } else {
        toast.error(data.error || "Failed to update configuration.");
      }
    } catch {
      toast.error("Network error saving configuration.");
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = searchEmployeeQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = (emp.name || "").toLowerCase();
      const numId = String(emp.employeeId || "").toLowerCase();
      const mob = String(emp.mobile || "").toLowerCase();
      return name.includes(q) || numId.includes(q) || mob.includes(q);
    });
  }, [employees, searchEmployeeQuery]);

  const presentCount = useMemo(() => {
    return employees.filter((e) => !onLeaveEmpIdMap.has(e.id) && attendanceMap[e.id] === "Present").length;
  }, [employees, onLeaveEmpIdMap, attendanceMap]);

  const halfDayCount = useMemo(() => {
    return employees.filter((e) => !onLeaveEmpIdMap.has(e.id) && attendanceMap[e.id] === "Half Day").length;
  }, [employees, onLeaveEmpIdMap, attendanceMap]);

  const absentCount = useMemo(() => {
    return employees.filter(
      (e) => onLeaveEmpIdMap.has(e.id) || attendanceMap[e.id] === "Absent"
    ).length;
  }, [employees, onLeaveEmpIdMap, attendanceMap]);

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
                Attendance &amp; Holidays
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {employees.length} Staff
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Mark daily attendance, manage store holidays, and configure monthly salary calculation rules.
            </p>
          </div>
        </div>

        {/* Local Tab Navigation (Attendance | Holidays | Salary Logic) */}
        <div className="flex items-center gap-1 border-b border-slate-200/80 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "attendance"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-semibold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Daily Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("holidays")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "holidays"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-semibold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Store Holidays ({holidays.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("salary-logic")}
            className={`h-[32px] px-3 text-xs rounded-t-[6px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "salary-logic"
                ? "border-[#5e2b9d] text-[#5e2b9d] font-semibold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Salary Logic &amp; Bonus</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB 1: DAILY ATTENDANCE
        ══════════════════════════════════════════════════════ */}
        {activeTab === "attendance" && (
          <div className="flex flex-col">
            {/* Control Bar: Date Selector, Quick Marks, and Bulk Save */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-[34px] px-2.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block mx-1" />

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickMarkAll("Present")}
                    className="h-[34px] px-3 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-[6px] transition-colors cursor-pointer"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickMarkAll("Absent")}
                    className="h-[34px] px-3 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-[6px] transition-colors cursor-pointer"
                  >
                    Mark All Absent
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  type="button"
                  onClick={handleBulkSave}
                  disabled={savingBulk || loadingAttendance}
                  className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>{savingBulk ? "Saving..." : "Bulk Save Attendance"}</span>
                </button>
              </div>
            </div>

            {/* Attendance Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
                <p className="text-[11px] text-slate-500 font-medium">Total Staff</p>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">{employees.length}</h4>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
                <p className="text-[11px] text-emerald-600 font-medium">Present</p>
                <h4 className="text-lg font-bold text-emerald-700 mt-0.5">{presentCount}</h4>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
                <p className="text-[11px] text-amber-600 font-medium">Half Day</p>
                <h4 className="text-lg font-bold text-amber-700 mt-0.5">{halfDayCount}</h4>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
                <p className="text-[11px] text-rose-600 font-medium">
                  Absent / Leave {onLeaveEmpIdMap.size > 0 && `(${onLeaveEmpIdMap.size} leave)`}
                </p>
                <h4 className="text-lg font-bold text-rose-700 mt-0.5">{absentCount}</h4>
              </div>
            </div>

            {/* Search within staff */}
            <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
              <div className="relative flex-1">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter staff by name or 7-digit ID..."
                  value={searchEmployeeQuery}
                  onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                Date: <strong className="text-slate-800 font-semibold">{new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</strong>
              </span>
            </div>

            {/* Attendance Table */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              {loadingAttendance ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Loading attendance data...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">No employees found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Attendance Selection</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployees.map((emp) => {
                        const leaveRecord = onLeaveEmpIdMap.get(emp.id);
                        const isOnLeave = Boolean(leaveRecord);
                        const currentStatus = isOnLeave ? "Absent" : attendanceMap[emp.id] || "Present";
                        const isSavingThis = savingSingleId === emp.id;

                        return (
                          <tr
                            key={emp.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isOnLeave ? "bg-amber-50/20" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
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
                                <div>
                                  <div className="font-semibold text-slate-900">{emp.name}</div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                    {emp.employeeId && (
                                      <span className="font-mono text-[#5e2b9d]">
                                        #{emp.employeeId}
                                      </span>
                                    )}
                                    {emp.mobile && <span>• 📱 {emp.mobile}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              {isOnLeave ? (
                                <div className="inline-flex flex-col">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                    <span>🌴</span>
                                    <span>On Leave</span>
                                  </span>
                                  <span className="text-[10px] text-amber-700 mt-0.5 truncate max-w-[140px]" title={leaveRecord?.reason}>
                                    {leaveRecord?.reason || "Approved Leave"}
                                  </span>
                                </div>
                              ) : currentStatus === "Present" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Present
                                </span>
                              ) : currentStatus === "Half Day" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  Half Day (0.5)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                  Absent
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                <label
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium cursor-pointer transition-all border ${
                                    isOnLeave
                                      ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
                                      : currentStatus === "Present"
                                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold shadow-2xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`att_${emp.id}`}
                                    disabled={isOnLeave}
                                    checked={currentStatus === "Present"}
                                    onChange={() => handleStatusChange(emp.id, "Present")}
                                    className="w-3 h-3 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Present</span>
                                </label>

                                <label
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium cursor-pointer transition-all border ${
                                    isOnLeave
                                      ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
                                      : currentStatus === "Half Day"
                                      ? "bg-amber-50 border-amber-500 text-amber-800 font-semibold shadow-2xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`att_${emp.id}`}
                                    disabled={isOnLeave}
                                    checked={currentStatus === "Half Day"}
                                    onChange={() => handleStatusChange(emp.id, "Half Day")}
                                    className="w-3 h-3 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span>Half Day</span>
                                </label>

                                <label
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium cursor-pointer transition-all border ${
                                    isOnLeave
                                      ? "bg-rose-50 border-rose-300 text-rose-700 font-semibold"
                                      : currentStatus === "Absent"
                                      ? "bg-rose-50 border-rose-500 text-rose-800 font-semibold shadow-2xs"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`att_${emp.id}`}
                                    disabled={isOnLeave}
                                    checked={currentStatus === "Absent"}
                                    onChange={() => handleStatusChange(emp.id, "Absent")}
                                    className="w-3 h-3 text-rose-600 focus:ring-rose-500"
                                  />
                                  <span>Absent</span>
                                  {isOnLeave && (
                                    <span className="text-[9.5px] px-1 py-0.2 bg-rose-200/80 rounded-[3px] text-rose-800 font-bold">
                                      Leave
                                    </span>
                                  )}
                                </label>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                disabled={isSavingThis}
                                onClick={() => handleSaveSingle(emp)}
                                className="h-[28px] px-2.5 text-xs font-medium text-slate-700 hover:text-white bg-slate-100 hover:bg-[#5e2b9d] rounded-[6px] transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isSavingThis ? "Saving..." : "Save"}
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
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: STORE HOLIDAYS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "holidays" && (
          <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Declared Store Holidays</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set public holidays and festive calendar off-days for your staff.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHolidayName("");
                  setHolidayDate(new Date().toISOString().split("T")[0]);
                  setIsAddHolidayOpen(true);
                }}
                className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Holiday</span>
              </button>
            </div>

            {/* Sunday Holiday Quick Setting Notice */}
            <div className="bg-[#5e2b9d]/5 border border-[#5e2b9d]/15 p-3 rounded-[6px] flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-base">📅</span>
                <div>
                  <p className="text-xs font-semibold text-[#5e2b9d]">
                    Sunday Weekly Off Status:{" "}
                    <strong className="font-bold">
                      {settings.sundayIsHoliday ? "Enabled as Weekly Holiday" : "Disabled (Working Day)"}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    You can toggle whether Sunday is automatically treated as a holiday in the &quot;Salary Logic &amp; Bonus&quot; tab.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("salary-logic")}
                className="text-xs font-semibold text-[#5e2b9d] hover:underline cursor-pointer"
              >
                Configure →
              </button>
            </div>

            {/* Holidays List */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              {loadingHolidays ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Loading holidays...</p>
                </div>
              ) : holidays.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] mx-auto flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">No holidays declared yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;Add Holiday&quot; above to declare festival and national off-days.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Holiday Name</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Day of Week</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {holidays.map((h) => {
                        const dateObj = new Date(h.date);
                        const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "long" });
                        return (
                          <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                              <span>🎉</span>
                              <span>{h.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {dateObj.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-slate-100 text-slate-700">
                                {dayName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setHolidayToDelete(h)}
                                className="p-1 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove holiday"
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

            {/* Add Holiday Modal */}
            {isAddHolidayOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f8fafc]">
                    <h3 className="text-sm font-semibold text-slate-900">Add Store Holiday</h3>
                    <button
                      type="button"
                      onClick={() => setIsAddHolidayOpen(false)}
                      className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleAddHoliday} className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Holiday Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Diwali, Independence Day, Eid..."
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Holiday Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddHolidayOpen(false)}
                        className="h-[34px] px-3.5 rounded-[6px] text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingHoliday}
                        className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {savingHoliday ? "Saving..." : "Save Holiday"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Holiday Confirm Modal */}
            {holidayToDelete && (
              <ConfirmModal
                isOpen={!!holidayToDelete}
                title="Remove Store Holiday"
                message={`Are you sure you want to remove '${holidayToDelete.name}' on ${holidayToDelete.date}?`}
                confirmText={deletingHoliday ? "Removing..." : "Yes, Remove"}
                cancelText="Cancel"
                onConfirm={handleDeleteHoliday}
                onClose={() => setHolidayToDelete(null)}
              />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: SALARY LOGIC & FULL ATTENDANCE BONUS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "salary-logic" && (
          <div className="max-w-2xl bg-white border border-slate-200/80 rounded-[6px] p-4 shadow-2xs">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Salary Calculation Logic</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure month divisor rates, Sunday weekly holiday status, and full attendance incentive bonuses.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 divide-y divide-slate-100">
              {/* 1. Month Divisor (30 vs 31 days) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Per-Day Salary Divisor Rate
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Determines how monthly salary is divided to arrive at the daily rate (e.g. Monthly Salary ÷ 30 or ÷ 31).
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-[6px] border text-xs cursor-pointer transition-colors ${
                      settings.monthDivisor === 30
                        ? "bg-[#5e2b9d]/5 border-[#5e2b9d] text-[#5e2b9d] font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="monthDivisor"
                      checked={settings.monthDivisor === 30}
                      onChange={() => setSettings((s) => ({ ...s, monthDivisor: 30 }))}
                      className="w-3.5 h-3.5 text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <div>
                      <span className="block font-bold">30 Days Standard</span>
                      <span className="text-[10px] text-slate-500">Monthly Salary ÷ 30</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-[6px] border text-xs cursor-pointer transition-colors ${
                      settings.monthDivisor === 31
                        ? "bg-[#5e2b9d]/5 border-[#5e2b9d] text-[#5e2b9d] font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="monthDivisor"
                      checked={settings.monthDivisor === 31}
                      onChange={() => setSettings((s) => ({ ...s, monthDivisor: 31 }))}
                      className="w-3.5 h-3.5 text-[#5e2b9d] focus:ring-[#5e2b9d]"
                    />
                    <div>
                      <span className="block font-bold">31 Days Standard</span>
                      <span className="text-[10px] text-slate-500">Monthly Salary ÷ 31</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Sunday As Holiday */}
              <div className="pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-800">
                      Consider Sundays as Weekly Holiday
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      When enabled, Sundays are automatically counted as paid weekly holidays and not penalized as absences.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sundayIsHoliday}
                      onChange={(e) => setSettings((s) => ({ ...s, sundayIsHoliday: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5e2b9d]"></div>
                  </label>
                </div>
              </div>

              {/* 3. Full Attendance Bonus */}
              <div className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-800">
                      Enable Full Attendance Bonus
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Reward employees with extra paid bonus days if they have full attendance without unexcused absences.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableAttendanceBonus}
                      onChange={(e) => setSettings((s) => ({ ...s, enableAttendanceBonus: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5e2b9d]"></div>
                  </label>
                </div>

                {settings.enableAttendanceBonus && (
                  <div className="p-2.5 bg-[#5e2b9d]/5 rounded-[6px] border border-[#5e2b9d]/15 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-[#5e2b9d] block">
                        Full Attendance Bonus Days:
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Additional days of daily salary added to payroll when eligible.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.bonusDays}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, bonusDays: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        className="w-16 h-[32px] px-2 text-xs text-center font-bold bg-white border border-[#5e2b9d]/30 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Days</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-3 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSettings || loadingSettings}
                  className="h-[34px] px-4 rounded-[6px] text-xs font-medium text-white bg-[#5e2b9d] hover:bg-[#4e2284] shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? "Saving Settings..." : "Save Salary Logic Settings"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
