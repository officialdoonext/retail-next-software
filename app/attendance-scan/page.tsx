"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import { useToast } from "@/components/ToastProvider";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

interface Employee {
  id: string;
  name: string;
  employeeId?: string;
  mobile?: string;
  avatarUrl?: string;
  status?: string;
  salaryType?: "monthly" | "daily";
}

interface ScanLogItem {
  id: string;
  empId: string;
  empNumericId: string;
  empName: string;
  time: string;
  status: "ok" | "error";
  msg: string;
  avatarUrl?: string;
}

function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // audio context might be blocked if user has not interacted
  }
}

export default function AttendanceScanPage() {
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Record<string, "Present" | "Absent" | "Half Day">>({});
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);
  const [manualIdInput, setManualIdInput] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchLogQuery, setSearchLogQuery] = useState("");

  // Camera state & refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number>(0);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [savingScan, setSavingScan] = useState(false);
  const [lastDetectedName, setLastDetectedName] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  // 1. Fetch employees and today's attendance
  useEffect(() => {
    async function initData() {
      setLoadingEmployees(true);
      try {
        const [empRes, attRes] = await Promise.all([
          fetch("/api/employees"),
          fetch(`/api/employees/attendance?date=${todayStr}`),
        ]);

        let loadedEmps: Employee[] = [];
        if (empRes.ok) {
          const empData = await empRes.json();
          if (empData.success && Array.isArray(empData.employees)) {
            loadedEmps = empData.employees;
            setEmployees(empData.employees);
          }
        }

        if (attRes.ok) {
          const attData = await attRes.json();
          if (attData.success && Array.isArray(attData.attendance)) {
            const map: Record<string, "Present" | "Absent" | "Half Day"> = {};
            const initialLogs: ScanLogItem[] = [];

            attData.attendance.forEach((rec: any) => {
              map[rec.employeeId] = rec.status;
              if (rec.status === "Present") {
                const matchedEmp = loadedEmps.find((e) => e.id === rec.employeeId);
                initialLogs.push({
                  id: rec.id || `${rec.employeeId}-${Date.now()}`,
                  empId: rec.employeeId,
                  empNumericId: rec.employeeNumericId || matchedEmp?.employeeId || "",
                  empName: rec.employeeName || matchedEmp?.name || "Employee",
                  time: rec.updatedAt ? new Date(rec.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Today",
                  status: "ok",
                  msg: "Present",
                  avatarUrl: matchedEmp?.avatarUrl,
                });
              }
            });

            setTodayAttendanceMap(map);
            setScanLogs(initialLogs);
          }
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      } finally {
        setLoadingEmployees(false);
      }
    }

    initData();
  }, [todayStr]);

  // 2. Camera Controls
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(scanLoopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user" = facingMode) => {
    setCameraError("");
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied. Please allow camera permissions in your browser address bar.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // 3. Mark attendance function
  const markEmployeeAttendance = useCallback(
    async (emp: Employee) => {
      const timeStr = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setSavingScan(true);
      try {
        const res = await fetch("/api/employees/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayStr,
            records: [
              {
                employeeId: emp.id,
                employeeNumericId: emp.employeeId || "",
                employeeName: emp.name,
                status: "Present",
                isLeave: false,
              },
            ],
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (soundEnabled) playScanBeep();
          setLastDetectedName(emp.name);
          setTimeout(() => setLastDetectedName(null), 3500);

          setScanLogs((prev) => [
            {
              id: `${emp.id}-${Date.now()}`,
              empId: emp.id,
              empNumericId: emp.employeeId || "",
              empName: emp.name,
              time: timeStr,
              status: "ok",
              msg: "Marked Present ✓",
              avatarUrl: emp.avatarUrl,
            },
            ...prev,
          ]);

          setTodayAttendanceMap((prev) => ({ ...prev, [emp.id]: "Present" }));
          toast.success(`✅ ${emp.name} marked Present`);
        } else {
          setScanLogs((prev) => [
            {
              id: `err-${Date.now()}`,
              empId: emp.id,
              empNumericId: emp.employeeId || "",
              empName: emp.name,
              time: timeStr,
              status: "error",
              msg: data.error || "Failed to save attendance",
            },
            ...prev,
          ]);
          toast.error(data.error || "Could not save attendance");
        }
      } catch {
        setScanLogs((prev) => [
          {
            id: `net-err-${Date.now()}`,
            empId: emp.id,
            empNumericId: emp.employeeId || "",
            empName: emp.name,
            time: timeStr,
            status: "error",
            msg: "Network connection error",
          },
          ...prev,
        ]);
        toast.error("Network connection error");
      } finally {
        setSavingScan(false);
      }
    },
    [todayStr, soundEnabled, toast]
  );

  // 4. Handle QR detected from video stream
  const handleQrDetected = useCallback(
    async (qrRaw: string) => {
      const now = Date.now();
      // Debounce: same QR within 4 seconds = skip
      if (qrRaw === lastScannedRef.current && now - lastScanTimeRef.current < 4000) return;
      lastScannedRef.current = qrRaw;
      lastScanTimeRef.current = now;

      const timeStr = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Format could be: "storeId/employeeNumericId" or just "employeeNumericId"
      const parts = qrRaw.trim().split("/");
      const scannedNumericId = parts[parts.length - 1]?.trim();

      if (!scannedNumericId) {
        setScanLogs((prev) => [
          {
            id: `err-${Date.now()}`,
            empId: "",
            empNumericId: qrRaw,
            empName: "Unknown QR Code",
            time: timeStr,
            status: "error",
            msg: "Invalid QR format",
          },
          ...prev,
        ]);
        return;
      }

      // Find employee by numeric employeeId or document id
      const matched = employees.find(
        (e) =>
          String(e.employeeId || "").trim().toLowerCase() === scannedNumericId.toLowerCase() ||
          String(e.id).trim().toLowerCase() === scannedNumericId.toLowerCase()
      );

      if (!matched) {
        setScanLogs((prev) => [
          {
            id: `err-${Date.now()}`,
            empId: scannedNumericId,
            empNumericId: scannedNumericId,
            empName: `ID: ${scannedNumericId}`,
            time: timeStr,
            status: "error",
            msg: `No employee found with ID "${scannedNumericId}"`,
          },
          ...prev,
        ]);
        toast.error(`No employee registered with ID "${scannedNumericId}"`);
        return;
      }

      await markEmployeeAttendance(matched);
    },
    [employees, markEmployeeAttendance, toast]
  );

  // 5. Scan loop
  const runScanLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      scanLoopRef.current = requestAnimationFrame(runScanLoop);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const jsQR = (await import("jsqr")).default;
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code?.data) {
      await handleQrDetected(code.data);
    }

    scanLoopRef.current = requestAnimationFrame(runScanLoop);
  }, [handleQrDetected]);

  useEffect(() => {
    if (cameraActive) {
      scanLoopRef.current = requestAnimationFrame(runScanLoop);
    }
    return () => cancelAnimationFrame(scanLoopRef.current);
  }, [cameraActive, runScanLoop]);

  // 6. Manual ID submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualIdInput.trim();
    if (!query) {
      toast.error("Please enter an Employee ID or Name");
      return;
    }

    const matched = employees.find(
      (e) =>
        String(e.employeeId || "").trim().toLowerCase() === query.toLowerCase() ||
        e.name.toLowerCase().includes(query.toLowerCase())
    );

    if (!matched) {
      toast.error(`Employee not found for "${query}"`);
      return;
    }

    setSavingManual(true);
    await markEmployeeAttendance(matched);
    setSavingManual(false);
    setManualIdInput("");
  };

  // Stats calculation
  const presentCount = useMemo(() => {
    return Object.values(todayAttendanceMap).filter((s) => s === "Present").length;
  }, [todayAttendanceMap]);

  const filteredLogs = useMemo(() => {
    const q = searchLogQuery.trim().toLowerCase();
    if (!q) return scanLogs;
    return scanLogs.filter(
      (l) =>
        l.empName.toLowerCase().includes(q) ||
        l.empNumericId.toLowerCase().includes(q) ||
        l.msg.toLowerCase().includes(q)
    );
  }, [scanLogs, searchLogQuery]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Top HR Sub-Nav */}
        <EmployeeSubNav />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Scan Attendance
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                QR Terminal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Scan employee ID card QR codes to automatically mark attendance <strong>Present</strong> for today ({todayFormatted}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/employees/attendance"
              className="h-[34px] max-h-[34px] px-3 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-[6px] flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 stroke-[2] text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Full Attendance Register</span>
            </Link>
          </div>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Today&apos;s Date</div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5">{todayFormatted}</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Present Today</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-semibold text-emerald-600">{presentCount}</span>
              <span className="text-[11px] text-slate-400">/ {employees.length} Staff</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Attendance Rate</div>
            <div className="text-lg font-semibold text-[#5e2b9d] mt-0.5">
              {employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0}%
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Scanner Audio</div>
              <div className="text-xs font-medium text-slate-700 mt-0.5">{soundEnabled ? "Beep On Scan" : "Muted"}</div>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Beep Sound"
              className={`w-8 h-8 rounded-[6px] flex items-center justify-center cursor-pointer transition-colors ${
                soundEnabled ? "bg-[#5e2b9d]/10 text-[#5e2b9d]" : "bg-slate-100 text-slate-400"
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {soundEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Camera Scanner Console (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-[#f8fafc]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                  <span className="text-xs font-medium text-slate-800">QR Camera Viewport</span>
                </div>

                <div className="flex items-center gap-2">
                  {cameraActive && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 text-[10.5px] font-medium border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Feed
                    </span>
                  )}
                  {savingScan && (
                    <span className="flex items-center gap-1 text-[10.5px] font-medium text-[#5e2b9d] animate-pulse">
                      Recording…
                    </span>
                  )}
                </div>
              </div>

              {/* Viewport Box */}
              <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden" style={{ minHeight: "360px", maxHeight: "440px" }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ display: cameraActive ? "block" : "none", maxHeight: "440px" }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle / Target Scanner Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-52 h-52 sm:w-60 sm:h-60">
                      {/* Corner marks */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#5e2b9d] rounded-tl-[6px]" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#5e2b9d] rounded-tr-[6px]" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#5e2b9d] rounded-bl-[6px]" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#5e2b9d] rounded-br-[6px]" />

                      {/* Moving laser scan line */}
                      <div
                        className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#8b5cf6] to-transparent shadow-[0_0_8px_#8b5cf6] animate-bounce"
                        style={{ top: "48%" }}
                      />

                      <div className="absolute bottom-2 inset-x-0 text-center">
                        <span className="bg-black/60 text-white/90 text-[10px] font-medium px-2 py-0.5 rounded-[4px] backdrop-blur-xs">
                          Align QR within frame
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instant Success Flash Toast inside Viewport */}
                {lastDetectedName && (
                  <div className="absolute top-4 inset-x-4 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-emerald-600 text-white px-4 py-2 rounded-[6px] shadow-lg flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                      <div className="text-xs font-medium">
                        {lastDetectedName} marked <strong>Present</strong>!
                      </div>
                    </div>
                  </div>
                )}

                {/* Camera Inactive Placeholder */}
                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/70 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    {cameraError ? (
                      <div className="max-w-sm">
                        <p className="text-xs font-medium text-rose-400">{cameraError}</p>
                        <p className="text-[11px] text-white/50 mt-1">
                          Click browser site settings and allow camera access for this page.
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-xs">
                        <p className="text-xs font-medium text-white/80">Camera is currently stopped</p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          Click &quot;Start Camera Scanner&quot; to begin scanning staff QR codes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Viewport Control Bar */}
              <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="h-[36px] px-5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                    >
                      <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Start Camera Scanner
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="h-[36px] px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Stop Camera
                    </button>
                  )}

                  {/* Switch Front/Back camera */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextFacing = facingMode === "environment" ? "user" : "environment";
                      setFacingMode(nextFacing);
                      if (cameraActive) startCamera(nextFacing);
                    }}
                    title="Flip Camera (Front / Back)"
                    className="h-[36px] px-3 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-[6px] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2] text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{facingMode === "environment" ? "Rear Cam" : "Front Cam"}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500">
                  {employees.length} Employees Loaded
                </div>
              </div>
            </div>

            {/* Manual Fallback Card */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-slate-800">Manual ID Card Number Entry</span>
                <span className="text-[10.5px] text-slate-400">(Fallback if QR code is damaged)</span>
              </div>
              <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter Employee ID (e.g. 101 or Rahul)"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  className="flex-1 h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                />
                <button
                  type="submit"
                  disabled={savingManual || !manualIdInput.trim()}
                  className="h-[34px] max-h-[34px] px-4 bg-[#5e2b9d] hover:bg-[#4e2284] disabled:opacity-50 text-white text-xs font-medium rounded-[6px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                >
                  {savingManual ? "Saving…" : "Mark Present"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Live Feed & Scanned Register (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white border border-slate-200/80 rounded-[6px] shadow-2xs overflow-hidden flex flex-col h-full min-h-[480px]">
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-[#f8fafc]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">Today&apos;s Live Attendance Feed</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-medium px-1.5 py-0.2 rounded">
                    {presentCount} Present
                  </span>
                </div>

                {scanLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScanLogs([])}
                    className="text-[10.5px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {/* Search Log Bar */}
              <div className="p-2 border-b border-slate-100 bg-white">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search scanned staff name or ID…"
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="w-full h-[30px] pl-7 pr-3 bg-[#f8fafc] border border-slate-200/80 rounded-[4px] text-[11.5px] text-slate-800 focus:bg-white focus:outline-none focus:border-[#5e2b9d]"
                  />
                  <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Log List */}
              <div className="flex-1 overflow-y-auto max-h-[480px]">
                {loadingEmployees ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading staff data…</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                      <svg className="w-6 h-6 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-600">No Scans Recorded Yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                      Start the camera on the left or type an ID above to mark attendance for today.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => {
                      const isOk = log.status === "ok";
                      const letter = getFirstLetter(log.empName);
                      const letterColor = getFirstLetterColor(letter);

                      return (
                        <div
                          key={log.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                            isOk ? "hover:bg-emerald-50/20" : "hover:bg-rose-50/20"
                          }`}
                        >
                          {/* Avatar or status icon */}
                          <div className="relative shrink-0">
                            {log.avatarUrl ? (
                              <img
                                src={log.avatarUrl}
                                alt={log.empName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${letterColor}`}
                              >
                                {letter}
                              </div>
                            )}

                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white ${
                                isOk ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            >
                              {isOk ? "✓" : "✕"}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-slate-900 truncate">
                                {log.empName}
                              </span>
                              {log.empNumericId && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{log.empNumericId}
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-[11px] ${
                                isOk ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {log.msg}
                            </div>
                          </div>

                          {/* Timestamp */}
                          <div className="text-[10.5px] font-mono text-slate-400 shrink-0">
                            {log.time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Footer Info */}
              <div className="p-2.5 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Total records today: <strong>{presentCount}</strong>
                </span>
                <Link
                  href="/employees/attendance"
                  className="text-[#5e2b9d] hover:text-[#4e2284] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Attendance Register</span>
                  <svg className="w-3 h-3 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SoftwareLayout>
  );
}
