"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import EmployeeSubNav from "@/components/EmployeeSubNav";
import { useToast } from "@/components/ToastProvider";

// ── TYPES ──────────────────────────────────────────────────────────────────

interface IdCardDesign {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textDarkColor: string;
  textLightColor: string;
  showName: boolean;
  showEmpId: boolean;
  showMobile: boolean;
  showQr: boolean;
  bgPattern: "dots" | "lines" | "none";
}

interface StoreInfo {
  name: string;
  tagline: string;
  website: string;
  phone: string;
  logoUrl: string;
}

interface Employee {
  id: string;
  employeeId?: string;
  name: string;
  avatarUrl?: string;
  qrCodeUrl?: string;
  mobile: string;
  status: string;
}

const DEFAULT_DESIGN: IdCardDesign = {
  primaryColor: "#5e2b9d",
  secondaryColor: "#7c3aed",
  accentColor: "#a78bfa",
  textDarkColor: "#1a1a2e",
  textLightColor: "#6b7280",
  showName: true,
  showEmpId: true,
  showMobile: true,
  showQr: true,
  bgPattern: "dots",
};

// Card dimensions
const CW = 240;
const CH = 430;

// ── SUBTLE BACKGROUND PATTERN ───────────────────────────────────────────────
function BgPattern({ type, color }: { type: IdCardDesign["bgPattern"]; color: string }) {
  if (type === "none") return null;

  if (type === "dots") {
    // Very subtle dot grid
    const dots: React.ReactNode[] = [];
    const spacing = 20;
    for (let x = 10; x < CW; x += spacing) {
      for (let y = 10; y < CH; y += spacing) {
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill={color} opacity={0.12} />);
      }
    }
    return <>{dots}</>;
  }

  if (type === "lines") {
    // Very subtle diagonal lines
    const lines: React.ReactNode[] = [];
    const step = 22;
    for (let i = -CH; i < CW + CH; i += step) {
      lines.push(
        <line key={i} x1={i} y1={0} x2={i + CH} y2={CH} stroke={color} strokeWidth={1} opacity={0.07} />
      );
    }
    return <>{lines}</>;
  }

  return null;
}

// ── INLINE QR PLACEHOLDER ──────────────────────────────────────────────────
function QRPlaceholder({ size, color }: { size: number; color: string }) {
  const u = size / 9;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* TL finder */}
      <rect x={0} y={0} width={u*3} height={u*3} rx={u*0.3} fill={color} />
      <rect x={u*0.5} y={u*0.5} width={u*2} height={u*2} rx={u*0.2} fill="white" />
      <rect x={u} y={u} width={u} height={u} rx={u*0.1} fill={color} />
      {/* TR finder */}
      <rect x={u*6} y={0} width={u*3} height={u*3} rx={u*0.3} fill={color} />
      <rect x={u*6.5} y={u*0.5} width={u*2} height={u*2} rx={u*0.2} fill="white" />
      <rect x={u*7} y={u} width={u} height={u} rx={u*0.1} fill={color} />
      {/* BL finder */}
      <rect x={0} y={u*6} width={u*3} height={u*3} rx={u*0.3} fill={color} />
      <rect x={u*0.5} y={u*6.5} width={u*2} height={u*2} rx={u*0.2} fill="white" />
      <rect x={u} y={u*7} width={u} height={u} rx={u*0.1} fill={color} />
      {/* Data dots */}
      {[[4,0],[5,1],[6,0],[7,2],[8,0],[4,2],[8,2],[4,4],[5,3],[6,4],[7,3],[8,4],
        [3,5],[4,6],[5,5],[6,6],[7,5],[8,6],[3,7],[5,7],[6,7],[8,7],[3,8],[4,8],[6,8],[8,8]].map(([cx, cy], i) => (
        <rect key={i} x={cx*u+u*0.1} y={cy*u+u*0.1} width={u*0.8} height={u*0.8} rx={u*0.1} fill={color} opacity={0.75} />
      ))}
    </svg>
  );
}

// ── ID CARD ────────────────────────────────────────────────────────────────
interface IdCardProps {
  employee: Employee;
  design: IdCardDesign;
  store: StoreInfo;
}

function EmployeeIdCard({ employee, design, store }: IdCardProps) {
  const { primaryColor, secondaryColor, accentColor, textDarkColor, textLightColor, showName, showEmpId, showMobile, showQr, bgPattern } = design;

  const initials = employee.name
    .split(" ").slice(0, 2)
    .map(n => n[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        width: CW,
        height: CH,
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 12px 40px rgba(94,43,157,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── TOP GRADIENT BAND (CSS, no SVG) ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 48,
        background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
        borderRadius: "14px 14px 0 0",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* ── SUBTLE BG PATTERN (CSS background-image, no SVG) ── */}
      {bgPattern === "dots" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14, pointerEvents: "none", zIndex: 0,
          backgroundImage: `radial-gradient(circle, ${primaryColor}22 1.2px, transparent 1.2px)`,
          backgroundSize: "20px 20px",
        }} />
      )}
      {bgPattern === "lines" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14, pointerEvents: "none", zIndex: 0,
          backgroundImage: `repeating-linear-gradient(135deg, ${primaryColor}11 0px, ${primaryColor}11 1px, transparent 1px, transparent 22px)`,
        }} />
      )}

      {/* ── FOOTER TINT (CSS) ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 54,
        background: `linear-gradient(to bottom, transparent, ${accentColor}12)`,
        borderRadius: "0 0 14px 14px",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* ── FOOTER DIVIDER (CSS) ── */}
      <div style={{
        position: "absolute", bottom: 52, left: 16, right: 16, height: 1,
        background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)`,
        pointerEvents: "none",
        zIndex: 1,
      }} />

      {/* ── CONTENT ── */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>


        {/* TOP HEADER BAND — logo + company name + tagline */}
        <div style={{ width: "100%", height: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 4, gap: 0 }}>
          {/* Company name on gradient */}
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt={store.name}
              style={{ height: 26, maxWidth: 140, objectFit: "contain", filter: "brightness(0) invert(1)" }}
              crossOrigin="anonymous"
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: "white", letterSpacing: "0.02em", textAlign: "center", paddingLeft: 12, paddingRight: 12, lineHeight: 1.2, maxWidth: CW - 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {store.name || "Company"}
            </span>
          )}
          {store.tagline && (
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.82)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 1 }}>
              {store.tagline}
            </span>
          )}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, width: "100%" }}>

          {/* Company logo (square badge below header band) — only if logo exists */}
          {store.logoUrl && (
            <div style={{ marginBottom: 10, width: 40, height: 40, borderRadius: 8, background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 3px 10px ${primaryColor}44` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.logoUrl} alt={store.name} style={{ width: 28, height: 28, objectFit: "contain" }} crossOrigin="anonymous" />
            </div>
          )}

          {/* EMPLOYEE PHOTO */}
          <div style={{
            width: 82,
            height: 82,
            borderRadius: "50%",
            padding: 3,
            background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
            boxShadow: `0 4px 18px ${primaryColor}40`,
            flexShrink: 0,
          }}>
            <div style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2.5px solid white",
              background: `linear-gradient(135deg, ${accentColor}30, ${secondaryColor}30)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 500,
              color: primaryColor,
            }}>
              {employee.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={employee.avatarUrl} alt={employee.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  crossOrigin="anonymous"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          {/* EMPLOYEE INFO — label : value rows */}
          <div style={{ marginTop: 14, width: "100%", paddingLeft: 20, paddingRight: 20 }}>
            {/* Divider */}
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`, marginBottom: 10 }} />

            {/* Rows */}
            {([
              showEmpId && employee.employeeId ? { label: "ID", value: employee.employeeId, mono: true } : null,
              showName ? { label: "Name", value: employee.name, mono: false } : null,
              showMobile && employee.mobile ? { label: "Mobile", value: employee.mobile, mono: false } : null,
            ] as ({ label: string; value: string; mono: boolean } | null)[]).filter(Boolean).map((row) => (
              row && (
                <div key={row.label}
                  style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: textLightColor,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    minWidth: 44,
                    textAlign: "right",
                    flexShrink: 0,
                  }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: textLightColor, flexShrink: 0 }}>:</span>
                  <span style={{
                    fontSize: row.label === "ID" ? 12 : 11,
                    fontWeight: 500,
                    color: row.label === "ID" ? primaryColor : textDarkColor,
                    fontFamily: row.mono ? "monospace" : "inherit",
                    letterSpacing: row.mono ? "0.06em" : "0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 90,
                  }}>
                    {row.value}
                  </span>
                </div>
              )
            ))}

            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`, marginTop: 4 }} />
          </div>

          {/* QR CODE — bigger for scan clarity */}
          {showQr && (
            <div style={{
              marginTop: 8,
              padding: 4,
              background: "white",
              borderRadius: 10,
              border: `1.5px solid ${accentColor}55`,
              boxShadow: `0 3px 12px ${primaryColor}18`,
              display: "inline-block",
            }}>
              {employee.qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={employee.qrCodeUrl} alt="QR"
                  style={{ width: 110, height: 110, display: "block", objectFit: "contain", imageRendering: "pixelated" }}
                  crossOrigin="anonymous"
                />
              ) : (
                <QRPlaceholder size={110} color={primaryColor} />
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ width: "100%", height: 50, paddingLeft: 16, paddingRight: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 7.5, fontWeight: 500, color: textLightColor, letterSpacing: "0.1em", textTransform: "uppercase", maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {store.tagline || "Employee Card"}
          </span>
          <span style={{ fontSize: 7.5, fontWeight: 500, color: primaryColor, letterSpacing: "0.02em", maxWidth: "42%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
            {store.website || store.phone || ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── CONTROL HELPERS ────────────────────────────────────────────────────────

function ControlSection({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200/80 rounded-[6px] overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#f8fafc] hover:bg-slate-100/80 transition-colors cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="text-[#5e2b9d]">{icon}</span>
          <span className="text-xs font-medium text-slate-800">{title}</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-3 space-y-3 bg-white">{children}</div>}
    </div>
  );
}

function HexColorInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [hex, setHex] = useState(value.replace("#", "").toUpperCase());
  useEffect(() => { setHex(value.replace("#", "").toUpperCase()); }, [value]);

  const commit = (raw: string) => {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHex(clean.toUpperCase());
    if (clean.length === 6) onChange(`#${clean}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer shrink-0">
          <div className="w-8 h-8 rounded-[5px] border-2 border-white shadow ring-1 ring-slate-200 cursor-pointer" style={{ background: value }} />
          <input type="color" value={value}
            onChange={(e) => { onChange(e.target.value); setHex(e.target.value.replace("#", "").toUpperCase()); }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </label>
        <div className="flex items-center flex-1 bg-[#f8fafc] border border-slate-200 rounded-[5px] overflow-hidden h-8">
          <span className="pl-2 text-xs text-slate-400 font-mono select-none">#</span>
          <input type="text" value={hex} onChange={(e) => commit(e.target.value)}
            maxLength={6} placeholder="5e2b9d"
            className="flex-1 h-full bg-transparent px-1 text-xs font-mono text-slate-800 focus:outline-none uppercase" />
        </div>
      </div>
    </div>
  );
}

function ToggleInput({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${value ? "bg-[#5e2b9d]" : "bg-slate-200"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function EmployeeIdCardPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"designer" | "cards">("designer");
  const [design, setDesign] = useState<IdCardDesign>(DEFAULT_DESIGN);
  const [savedDesign, setSavedDesign] = useState<IdCardDesign | null>(null);
  const [store, setStore] = useState<StoreInfo>({ name: "", tagline: "", website: "", phone: "", logoUrl: "" });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load store settings
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.success && d.settings) {
        const s = d.settings;
        setStore({ name: s.name || "", tagline: s.tagline || "", website: s.website || "", phone: s.phone || "", logoUrl: s.logoUrl || "" });
      }
    }).catch(() => {});
  }, []);

  // Load saved design
  useEffect(() => {
    (async () => {
      setLoadingDesign(true);
      try {
        const res = await fetch("/api/employees/id-card");
        const data = await res.json();
        if (data.success && data.design) {
          const merged = { ...DEFAULT_DESIGN, ...data.design };
          setDesign(merged);
          setSavedDesign(merged);
        }
      } catch { /* no design */ } finally { setLoadingDesign(false); }
    })();
  }, []);

  // Load employees
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.success) {
        const active = (data.employees || []).filter((e: Employee) => e.status !== "inactive");
        setEmployees(active);
        if (active.length > 0) setPreviewEmployee(active[0]);
      }
    } catch { toast.error("Failed to load employees."); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const updateDesign = (patch: Partial<IdCardDesign>) => setDesign(prev => ({ ...prev, ...patch }));

  const handleSaveDesign = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/employees/id-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const data = await res.json();
      if (data.success) {
        setSavedDesign({ ...design });
        toast.success("ID card design saved!");
      } else {
        toast.error(data.error || "Failed to save.");
      }
    } catch { toast.error("Network error."); }
    finally { setSaving(false); }
  };

  const doExport = async (emp: Employee): Promise<boolean> => {
    const el = cardRefs.current[emp.id];
    if (!el) return false;
    try {
      // html-to-image uses SVG foreignObject — browser renders natively.
      // Fonts, gradients, modern CSS (oklch/lab) all work without any workarounds.
      const { toPng } = await import("html-to-image");

      const dataUrl = await toPng(el, {
        pixelRatio: 3,
        cacheBust: true,
        width: CW,
        height: CH,
        style: {
          borderRadius: "14px",
          overflow: "hidden",
        },
      });

      const link = document.createElement("a");
      link.download = `ID-${emp.name.replace(/\s+/g, "-")}-${emp.employeeId || emp.id}.png`;
      link.href = dataUrl;
      link.click();
      return true;
    } catch (err) {
      console.error("Export error for", emp.name, err);
      return false;
    }
  };

  const exportCard = async (emp: Employee) => {
    const ok = await doExport(emp);
    if (!ok) toast.error(`Export failed for ${emp.name}.`);
  };

  const exportAllCards = async () => {
    if (!employees.length) return;
    setExportingAll(true);
    setExportProgress(0);
    let succeeded = 0;
    try {
      for (let i = 0; i < employees.length; i++) {
        const ok = await doExport(employees[i]);
        if (ok) succeeded++;
        setExportProgress(Math.round(((i + 1) / employees.length) * 100));
        // Small delay between downloads so browser doesn't block them
        await new Promise(r => setTimeout(r, 400));
      }
      toast.success(`${succeeded} of ${employees.length} ID card(s) exported!`);
    } catch (err) {
      console.error("Export all error:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExportingAll(false);
      setExportProgress(0);
    }
  };

  const previewEmp: Employee = previewEmployee || {
    id: "preview", employeeId: "EMP-0001",
    name: "Preview Employee",
    mobile: store.phone || "+91 98765 43210",
    status: "active",
  };

  const hasUnsaved = JSON.stringify(design) !== JSON.stringify(savedDesign);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans p-4 sm:p-5 space-y-4 max-w-full">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-[6px] p-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🪪</span>
              <h1 className="text-base font-medium text-slate-900">Employee ID Cards</h1>
              {savedDesign && <span className="text-xs font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200/60">Design Saved</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Design your ID card style, save it, and export all employees as PNG.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "designer" && (
              <button type="button" onClick={handleSaveDesign} disabled={saving || !hasUnsaved}
                className="h-[34px] px-4 bg-[#5e2b9d] hover:bg-[#4e2284] disabled:opacity-50 text-white rounded-[6px] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-xs">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving...</span></>
                  : <><svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span>{hasUnsaved ? "Save Design" : "Design Saved"}</span></>
                }
              </button>
            )}
            {activeTab === "cards" && savedDesign && employees.length > 0 && (
              <button type="button" onClick={exportAllCards} disabled={exportingAll}
                className="h-[34px] px-4 bg-[#5e2b9d] hover:bg-[#4e2284] disabled:opacity-50 text-white rounded-[6px] text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs">
                {exportingAll
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{exportProgress}% Exporting...</span></>
                  : <><svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg><span>Export All ({employees.length})</span></>
                }
              </button>
            )}
          </div>
        </div>

        <EmployeeSubNav />

        {/* TABS */}
        <div className="flex items-center gap-1 bg-[#f8fafc] border border-slate-200/80 rounded-[6px] p-1 w-fit">
          {(["designer", "cards"] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`h-[30px] px-4 rounded-[5px] text-xs font-medium transition-all cursor-pointer ${activeTab === tab ? "bg-[#5e2b9d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/70"}`}>
              {tab === "designer" ? "🎨 Designer" : "🪪 ID Cards"}
            </button>
          ))}
        </div>

        {/* ══════ DESIGNER TAB ══════ */}
        {activeTab === "designer" && (
          <div className="flex flex-col xl:flex-row gap-5 items-start">

            {/* LEFT: Card Preview */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-4">
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-6 shadow-2xs w-full flex flex-col items-center gap-5">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-xs font-medium text-slate-600">Live Card Preview</h2>
                  {hasUnsaved && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[4px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved changes
                    </span>
                  )}
                </div>

                <div style={{ filter: "drop-shadow(0 20px 48px rgba(94,43,157,0.22)) drop-shadow(0 4px 12px rgba(0,0,0,0.10))" }}>
                  <EmployeeIdCard employee={previewEmp} design={design} store={store} />
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="bg-slate-100 px-2 py-1 rounded-[4px]">240 × 400 px</span>
                  <span>•</span>
                  <span>Portrait ID Card</span>
                  <span>•</span>
                  <span className="text-[#5e2b9d]">Exports @ 3× (720 × 1200 px)</span>
                </div>
              </div>

              {/* Store info tip */}
              {(!store.tagline || !store.website) && (
                <div className="bg-blue-50 border border-blue-200/70 rounded-[6px] p-3 w-full flex items-start gap-2">
                  <span className="text-blue-500 text-sm shrink-0">ℹ️</span>
                  <p className="text-xs text-blue-800">
                    Add <span className="font-medium">Tagline</span> and <span className="font-medium">Website</span> in{" "}
                    <a href="/settings" className="underline text-[#5e2b9d] font-medium">Settings</a> to show them on the card footer.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Controls */}
            <div className="w-full xl:w-[320px] shrink-0 space-y-2">

              {/* Preview employee selector */}
              <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
                <label className="text-xs font-medium text-slate-700 block mb-2">Preview with Employee</label>
                <div className="relative">
                  <select value={previewEmployee?.id || ""}
                    onChange={e => setPreviewEmployee(employees.find(em => em.id === e.target.value) || null)}
                    className="w-full h-[34px] px-3 pr-8 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] appearance-none cursor-pointer">
                    <option value="">— Placeholder —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} {emp.employeeId ? `(${emp.employeeId})` : ""}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Colors */}
              <ControlSection title="Card Colors" icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>}>
                <HexColorInput label="Primary Color" value={design.primaryColor} onChange={v => updateDesign({ primaryColor: v })} hint="Top band & accents" />
                <HexColorInput label="Secondary Color" value={design.secondaryColor} onChange={v => updateDesign({ secondaryColor: v })} hint="Gradient end" />
                <HexColorInput label="Accent Color" value={design.accentColor} onChange={v => updateDesign({ accentColor: v })} hint="Photo ring & glow" />
                <HexColorInput label="Text Dark" value={design.textDarkColor} onChange={v => updateDesign({ textDarkColor: v })} hint="Name" />
                <HexColorInput label="Text Light" value={design.textLightColor} onChange={v => updateDesign({ textLightColor: v })} hint="Sub-labels" />
              </ControlSection>

              {/* Background pattern */}
              <ControlSection title="Background Texture" icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
                </svg>}>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "dots", label: "Dots", icon: "⚬⚬⚬" },
                    { id: "lines", label: "Lines", icon: "╱╱╱" },
                    { id: "none", label: "None", icon: "—" },
                  ] as const).map(opt => (
                    <button key={opt.id} type="button" onClick={() => updateDesign({ bgPattern: opt.id })}
                      className={`py-2 px-1 rounded-[5px] text-center border transition-all cursor-pointer ${design.bgPattern === opt.id ? "bg-[#5e2b9d]/10 border-[#5e2b9d] text-[#5e2b9d]" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      <div className="text-base mb-1">{opt.icon}</div>
                      <div className="text-[10px] font-medium">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </ControlSection>

              {/* Show/hide fields */}
              <ControlSection title="Show / Hide Fields" icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>}>
                <ToggleInput label="Employee Name" value={design.showName} onChange={v => updateDesign({ showName: v })} />
                <ToggleInput label="Employee ID" value={design.showEmpId} onChange={v => updateDesign({ showEmpId: v })} />
                <ToggleInput label="Mobile Number" value={design.showMobile} onChange={v => updateDesign({ showMobile: v })} />
                <ToggleInput label="QR Code" value={design.showQr} onChange={v => updateDesign({ showQr: v })} />
              </ControlSection>

              {/* Quick presets */}
              <ControlSection title="Color Presets" icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>} defaultOpen={false}>
                {[
                  { label: "Brand Purple", p: "#5e2b9d", s: "#7c3aed", a: "#a78bfa" },
                  { label: "Ocean Blue", p: "#1d4ed8", s: "#3b82f6", a: "#93c5fd" },
                  { label: "Forest Green", p: "#166534", s: "#16a34a", a: "#86efac" },
                  { label: "Sunset Red", p: "#9f1239", s: "#e11d48", a: "#fda4af" },
                  { label: "Dark Slate", p: "#1e293b", s: "#334155", a: "#94a3b8" },
                  { label: "Amber Gold", p: "#92400e", s: "#d97706", a: "#fcd34d" },
                ].map(pr => (
                  <button key={pr.label} type="button"
                    onClick={() => updateDesign({ primaryColor: pr.p, secondaryColor: pr.s, accentColor: pr.a })}
                    className="w-full flex items-center gap-2.5 p-2 rounded-[5px] hover:bg-slate-50 border border-slate-100 transition-colors cursor-pointer text-left">
                    <div className="flex gap-1 shrink-0">
                      <div className="w-4 h-4 rounded-full" style={{ background: pr.p }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: pr.s }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: pr.a }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{pr.label}</span>
                  </button>
                ))}
              </ControlSection>

              <button type="button" onClick={() => setDesign(DEFAULT_DESIGN)}
                className="w-full h-[34px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-[6px] text-xs font-medium transition-colors cursor-pointer">
                Reset to Defaults
              </button>
            </div>
          </div>
        )}

        {/* ══════ ID CARDS TAB ══════ */}
        {activeTab === "cards" && (
          <div>
            {exportingAll && (
              <div className="mb-4 bg-purple-50 border border-[#5e2b9d]/20 rounded-[6px] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#5e2b9d]">Exporting ID Cards...</span>
                  <span className="text-xs font-mono text-[#5e2b9d]">{exportProgress}%</span>
                </div>
                <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5e2b9d] rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                </div>
              </div>
            )}

            {!savedDesign && !loadingDesign && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-slate-200/80 rounded-[6px] shadow-2xs">
                <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center"><span className="text-2xl">🎨</span></div>
                <div className="text-center">
                  <h3 className="text-sm font-medium text-slate-800">No Design Saved Yet</h3>
                  <p className="text-xs text-slate-500 mt-1">Customize your card in <span className="font-medium text-[#5e2b9d]">Designer</span> and save it first.</p>
                </div>
                <button type="button" onClick={() => setActiveTab("designer")}
                  className="h-[34px] px-5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-[6px] text-xs font-medium cursor-pointer">
                  Go to Designer →
                </button>
              </div>
            )}

            {savedDesign && employees.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-slate-200/80 rounded-[6px] shadow-2xs">
                <span className="text-2xl">👥</span>
                <h3 className="text-sm font-medium text-slate-800">No Active Employees</h3>
                <p className="text-xs text-slate-500">Add employees from the Employee Directory.</p>
              </div>
            )}

            {savedDesign && employees.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-medium text-slate-600">{employees.length} employee ID cards</span>
                  {store.name && <span className="text-[11px] bg-purple-50 text-[#5e2b9d] border border-purple-200/60 px-2 py-0.5 rounded-[4px] font-medium">{store.name}</span>}
                </div>

                <div className="flex flex-wrap gap-6">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex flex-col items-center">
                      {/* Card + hover overlay scoped together */}
                      <div
                        className="group relative"
                        style={{ width: CW, height: CH, flexShrink: 0 }}
                      >
                        {/* Capture target */}
                        <div ref={el => { cardRefs.current[emp.id] = el; }}>
                          <EmployeeIdCard employee={emp} design={savedDesign} store={store} />
                        </div>

                        {/* Hover overlay — exactly card size, above card content */}
                        <div
                          className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(1px)", zIndex: 20 }}
                        >
                          <button
                            type="button"
                            onClick={() => exportCard(emp)}
                            className="h-[32px] px-4 bg-white hover:bg-slate-50 text-slate-900 rounded-[6px] text-xs font-medium flex items-center gap-1.5 shadow-lg cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </button>
                        </div>
                      </div>

                      {/* Label below card */}
                      <div className="mt-2 flex items-center justify-between w-full px-1" style={{ maxWidth: CW }}>
                        <span className="text-[11px] font-medium text-slate-600 truncate">{emp.name}</span>
                        {emp.employeeId && <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">{emp.employeeId}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
