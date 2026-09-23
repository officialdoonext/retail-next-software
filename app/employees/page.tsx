"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface Employee {
  id: string;
  name: string;
  mobile: string;
  city: string;
  address: string;
  email?: string;
  salaryType: "monthly" | "daily";
  salaryAmount: number;
  emergencyContactNumber: string;
  emergencyRelation: string;
  emergencyName: string;
  status: string;
  createdAt: number;
}

const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function EmployeesPage() {
  const toast = useToast();

  /* ─── data ─── */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* ─── modal ─── */
  const [modal, setModal] = useState<"closed" | "add" | "edit" | "view">("closed");
  const [activeEmp, setActiveEmp] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ─── form fields ─── */
  const [fName, setFName] = useState("");
  const [fMobile, setFMobile] = useState("");
  const [fCity, setFCity] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fSalaryType, setFSalaryType] = useState<"monthly" | "daily">("monthly");
  const [fSalaryAmount, setFSalaryAmount] = useState("");
  const [fEcNumber, setFEcNumber] = useState("");
  const [fEcRelation, setFEcRelation] = useState("Spouse");
  const [fEcName, setFEcName] = useState("");

  /* ─── load ─── */
  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);
      } else {
        toast.error(data.error || "Failed to fetch employees.");
      }
    } catch {
      toast.error("Network error loading employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmployees(); }, []); // eslint-disable-line

  /* ─── filtered ─── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.mobile.includes(q) ||
        e.city.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  /* ─── modal helpers ─── */
  const resetForm = () => {
    setFName(""); setFMobile(""); setFCity(""); setFAddress(""); setFEmail("");
    setFSalaryType("monthly"); setFSalaryAmount("");
    setFEcNumber(""); setFEcRelation("Spouse"); setFEcName("");
    setModalError("");
  };

  const openAdd = () => { resetForm(); setActiveEmp(null); setModal("add"); };

  const openEdit = (e: Employee) => {
    resetForm();
    setActiveEmp(e);
    setFName(e.name || "");
    setFMobile(e.mobile || "");
    setFCity(e.city || "");
    setFAddress(e.address || "");
    setFEmail(e.email || "");
    setFSalaryType(e.salaryType || "monthly");
    setFSalaryAmount(e.salaryAmount !== undefined && e.salaryAmount !== null ? String(e.salaryAmount) : "");
    setFEcNumber(e.emergencyContactNumber || "");
    setFEcRelation(e.emergencyRelation || "Spouse");
    setFEcName(e.emergencyName || "");
    setModal("edit");
  };

  const openView = (e: Employee) => { setActiveEmp(e); setModal("view"); };

  const closeModal = () => {
    if (submitting) return;
    setModal("closed"); setActiveEmp(null); resetForm();
  };

  /* ─── save ─── */
  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();

    const cleanName = fName.trim();
    const cleanMobile = fMobile.replace(/\D/g, "");
    const cleanCity = fCity.trim();
    const cleanAddress = fAddress.trim();
    const cleanAmount = Number(fSalaryAmount);
    const cleanEcNumber = fEcNumber.replace(/\D/g, "");
    const cleanEcName = fEcName.trim();
    const cleanEcRelation = fEcRelation.trim();

    if (!cleanName) { setModalError("Employee name is required."); return; }
    if (!cleanMobile || cleanMobile.length < 10) { setModalError("Please enter a valid 10-digit mobile number."); return; }
    if (!cleanCity) { setModalError("City is required."); return; }
    if (!cleanAddress) { setModalError("Full address is required."); return; }
    if (!cleanAmount || cleanAmount <= 0) { setModalError("Please enter a valid salary / wage amount."); return; }
    if (!cleanEcNumber || cleanEcNumber.length < 10) { setModalError("Emergency contact must be a valid 10-digit number."); return; }
    if (!cleanEcRelation) { setModalError("Emergency contact relation is required."); return; }
    if (!cleanEcName) { setModalError("Emergency contact name is required."); return; }

    setSubmitting(true); setModalError("");

    try {
      const payload: Record<string, any> = {
        name: cleanName, mobile: cleanMobile, city: cleanCity, address: cleanAddress,
        email: fEmail.trim(), salaryType: fSalaryType, salaryAmount: cleanAmount,
        emergencyContactNumber: cleanEcNumber, emergencyRelation: cleanEcRelation, emergencyName: cleanEcName,
      };
      if (modal === "edit" && activeEmp) payload.id = activeEmp.id;

      const res = await fetch("/api/employees", {
        method: modal === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || "Failed to save employee.";
        setModalError(err); toast.error(err);
      } else {
        closeModal();
        toast.success(modal === "edit" ? "Employee updated!" : "Employee added!");
        loadEmployees();
      }
    } catch {
      const err = "Network error. Please try again.";
      setModalError(err); toast.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── delete ─── */
  const handleConfirmDelete = async () => {
    if (!empToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees?id=${empToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to delete employee.");
      } else {
        toast.success("Employee removed."); setEmpToDelete(null); loadEmployees();
      }
    } catch { toast.error("Network error."); }
    finally { setDeleting(false); }
  };

  const inputCls = "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";
  const isFormModal = modal === "add" || modal === "edit";

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">Employees</h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {employees.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage your store employees, salary details, and emergency contacts.
            </p>
          </div>
          <button type="button" onClick={openAdd}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto">
            <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        </div>

        {/* ── Search ── */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={searchQuery || ""} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, mobile, city, or email..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]" />
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading employees...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery ? "No matching employees found" : "No employees added yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {searchQuery ? "Try adjusting your search criteria." : "Add your store employees with their details, salary, and emergency contacts."}
            </p>
            {!searchQuery && (
              <button type="button" onClick={openAdd}
                className="h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer">
                + Add First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Employee</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Salary</th>
                  <th className="py-2.5 px-3">Emergency Contact</th>
                  <th className="py-2.5 px-3">Added On</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200/80 text-blue-600 font-medium text-xs flex items-center justify-center flex-shrink-0">
                          {getInitials(e.name)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block leading-tight">{e.name}</span>
                          {e.email && <span className="text-[10.5px] text-slate-400 block">{e.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 text-[11.5px]">{e.mobile}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">{e.city}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="font-semibold text-slate-900">{formatCurrency(e.salaryAmount)}</span>
                        <span className={`ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] ${e.salaryType === "monthly" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          {e.salaryType === "monthly" ? "Monthly" : "Daily"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="font-medium text-slate-800 block leading-tight">{e.emergencyName}</span>
                        <span className="text-[10.5px] text-slate-400 font-mono">{e.emergencyContactNumber}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({e.emergencyRelation})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openView(e)} title="View"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-center cursor-pointer">
                          <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => openEdit(e)} title="Edit"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-[#5e2b9d] hover:border-[#5e2b9d] hover:bg-purple-50 transition-colors flex items-center justify-center cursor-pointer">
                          <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => setEmpToDelete(e)} title="Delete"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer">
                          <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════ ADD / EDIT MODAL ══════════ */}
        {isFormModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[8px] border border-slate-200/80 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="h-[52px] bg-[#f8fafc] border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-slate-900 leading-tight">
                      {modal === "edit" ? "Edit Employee" : "Add New Employee"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">Fill in all required details below.</p>
                  </div>
                </div>
                <button type="button" onClick={closeModal} disabled={submitting}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer disabled:opacity-50">
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Body */}
              <form onSubmit={handleSave} className="overflow-y-auto flex-1">
                <div className="p-5 space-y-5">
                  {modalError && (
                    <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {modalError}
                    </div>
                  )}

                  {/* ── Section 1: Personal Info ── */}
                  <div>
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[#5e2b9d] text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">1</span>
                      Personal Information
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Name */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Employee Name <span className="text-rose-500">*</span>
                        </label>
                        <input type="text" value={fName || ""} onChange={(e) => setFName(e.target.value)}
                          placeholder="e.g. Suresh Kumar" required className={inputCls} />
                      </div>
                      {/* Mobile */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input type="tel" value={fMobile || ""}
                          onChange={(e) => setFMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210" maxLength={10} required className={`${inputCls} font-mono`} />
                      </div>
                      {/* City */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input type="text" value={fCity || ""} onChange={(e) => setFCity(e.target.value)}
                          placeholder="e.g. Hyderabad" required className={inputCls} />
                      </div>
                      {/* Email */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Email <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input type="email" value={fEmail || ""} onChange={(e) => setFEmail(e.target.value)}
                          placeholder="employee@email.com" className={inputCls} />
                      </div>
                      {/* Address */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Full Address <span className="text-rose-500">*</span>
                        </label>
                        <textarea value={fAddress || ""} onChange={(e) => setFAddress(e.target.value)}
                          placeholder="House / Flat No., Street, Area, City, Pincode"
                          rows={2} required
                          className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none" />
                      </div>
                    </div>
                  </div>

                  {/* ── Section 2: Salary ── */}
                  <div>
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[#5e2b9d] text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">2</span>
                      Salary Details
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Salary Type Toggle */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Salary Type <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFSalaryType("monthly")}
                            className={`flex-1 h-[34px] rounded-[6px] border-2 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              fSalaryType === "monthly"
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Monthly Salary
                          </button>
                          <button
                            type="button"
                            onClick={() => setFSalaryType("daily")}
                            className={`flex-1 h-[34px] rounded-[6px] border-2 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              fSalaryType === "daily"
                                ? "border-amber-500 bg-amber-50 text-amber-700"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                            </svg>
                            Daily Wages
                          </button>
                        </div>
                      </div>
                      {/* Amount */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          {fSalaryType === "monthly" ? "Monthly Salary (₹)" : "Daily Wages (₹)"}
                          <span className="text-rose-500"> *</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">₹</span>
                          <input type="number" value={fSalaryAmount || ""}
                            onChange={(e) => setFSalaryAmount(e.target.value)}
                            placeholder={fSalaryType === "monthly" ? "e.g. 18000" : "e.g. 650"}
                            min="1" required
                            className={`${inputCls} pl-7 font-mono`} />
                        </div>
                        <p className="text-[10.5px] text-slate-400">
                          {fSalaryType === "monthly" ? "Amount paid per month." : "Amount paid per working day."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Section 3: Emergency Contact ── */}
                  <div>
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">!</span>
                      Emergency Contact
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* EC Name */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Contact Name <span className="text-rose-500">*</span>
                        </label>
                        <input type="text" value={fEcName || ""} onChange={(e) => setFEcName(e.target.value)}
                          placeholder="e.g. Priya Kumar" required className={inputCls} />
                      </div>
                      {/* Relation */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Relation <span className="text-rose-500">*</span>
                        </label>
                        <select value={fEcRelation || "Spouse"} onChange={(e) => setFEcRelation(e.target.value)}
                          className={inputCls}>
                          {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      {/* EC Mobile */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Contact Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input type="tel" value={fEcNumber || ""}
                          onChange={(e) => setFEcNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210" maxLength={10} required className={`${inputCls} font-mono`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-white sticky bottom-0">
                  <button type="button" onClick={closeModal} disabled={submitting}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50">
                    {submitting ? (
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving...</span></>
                    ) : (
                      <><svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      <span>{modal === "edit" ? "Update Employee" : "Save Employee"}</span></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════ VIEW MODAL ══════════ */}
        {modal === "view" && activeEmp && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[8px] border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="h-[52px] bg-[#f8fafc] border-b border-slate-200 px-5 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-900">Employee Details</h2>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[75vh]">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-200 text-blue-600 font-semibold text-xl flex items-center justify-center mb-2">
                    {getInitials(activeEmp.name)}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{activeEmp.name}</h3>
                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] mt-1 ${activeEmp.salaryType === "monthly" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {activeEmp.salaryType === "monthly" ? "Monthly Employee" : "Daily Wage Worker"}
                  </span>
                </div>

                {/* Personal */}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Personal Info</p>
                <div className="space-y-2 mb-4">
                  {[
                    ["Mobile", activeEmp.mobile],
                    ["City", activeEmp.city],
                    ["Email", activeEmp.email || "—"],
                    ["Address", activeEmp.address],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-start justify-between py-1.5 border-b border-slate-100 gap-4">
                      <span className="text-xs text-slate-500 font-medium flex-shrink-0">{label}</span>
                      <span className="text-xs text-slate-800 text-right">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Salary */}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Salary</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Type</span>
                    <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] ${activeEmp.salaryType === "monthly" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {activeEmp.salaryType === "monthly" ? "Monthly" : "Daily"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">
                      {activeEmp.salaryType === "monthly" ? "Monthly Salary" : "Daily Wages"}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(activeEmp.salaryAmount)}</span>
                  </div>
                </div>

                {/* Emergency */}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Emergency Contact</p>
                <div className="space-y-2 mb-5">
                  {[
                    ["Name", activeEmp.emergencyName],
                    ["Relation", activeEmp.emergencyRelation],
                    ["Mobile", activeEmp.emergencyContactNumber],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">{label}</span>
                      <span className="text-xs text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { closeModal(); openEdit(activeEmp); }}
                    className="flex-1 h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Edit
                  </button>
                  <button type="button" onClick={() => { closeModal(); setEmpToDelete(activeEmp); }}
                    className="flex-1 h-[34px] rounded-[6px] border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        <ConfirmModal
          isOpen={empToDelete !== null}
          title="Delete Employee"
          message={`Are you sure you want to remove "${empToDelete?.name}" (${empToDelete?.mobile}) from your employees? This cannot be undone.`}
          confirmText="Delete Employee"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onClose={() => setEmpToDelete(null)}
        />
      </div>
    </SoftwareLayout>
  );
}
