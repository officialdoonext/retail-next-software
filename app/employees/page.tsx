"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { compressClientImage } from "@/lib/imageCompression";
import BulkUploadEmployeeModal, { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";
import EmployeeSubNav from "@/components/EmployeeSubNav";

interface Employee {
  id: string;
  storeId?: string;
  employeeId?: string; // 7-digit numeric string
  name: string;
  avatarUrl?: string; // Profile picture URL from ImageKit
  qrCodeUrl?: string; // StoreID/EmployeeID QR code URL from ImageKit
  mobile: string;
  city: string;
  address: string;
  email?: string;
  salaryType: "monthly" | "daily";
  salaryAmount: number;
  acceptedLeaves?: number;
  emergencyContactNumber: string;
  emergencyRelation: string;
  emergencyName: string;
  status: string;
  createdAt: number;
}

const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function EmployeesPage() {
  const toast = useToast();

  /* ─── data ─── */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* ─── modal states ─── */
  const [modal, setModal] = useState<"closed" | "add" | "edit" | "view">("closed");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [activeEmp, setActiveEmp] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [qrModalEmp, setQrModalEmp] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ─── form fields ─── */
  const [fAvatarFile, setFAvatarFile] = useState<File | null>(null);
  const [fAvatarPreview, setFAvatarPreview] = useState<string>("");
  const [fEmployeeId, setFEmployeeId] = useState<string>("");
  const [fName, setFName] = useState("");
  const [fMobile, setFMobile] = useState("");
  const [fCity, setFCity] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fSalaryType, setFSalaryType] = useState<"monthly" | "daily">("monthly");
  const [fSalaryAmount, setFSalaryAmount] = useState("");
  const [fAcceptedLeaves, setFAcceptedLeaves] = useState("0");
  const [fEcNumber, setFEcNumber] = useState("");
  const [fEcRelation, setFEcRelation] = useState("Spouse");
  const [fEcName, setFEcName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── load employees ─── */
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

  useEffect(() => {
    loadEmployees();
  }, []); // eslint-disable-line

  /* ─── generate unique 7-digit ID ─── */
  const generateRandom7Digit = () => {
    const existing = new Set(employees.map((e) => String(e.employeeId || "")));
    let candidate = 1000001;
    while (existing.has(String(candidate))) {
      candidate++;
    }
    return String(candidate);
  };

  /* ─── filtered employees ─── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.mobile.includes(q) ||
        (e.employeeId && e.employeeId.includes(q)) ||
        e.city.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  /* ─── modal helpers ─── */
  const resetForm = () => {
    setFAvatarFile(null);
    setFAvatarPreview("");
    setFEmployeeId("");
    setFName("");
    setFMobile("");
    setFCity("");
    setFAddress("");
    setFEmail("");
    setFSalaryType("monthly");
    setFSalaryAmount("");
    setFAcceptedLeaves("0");
    setFEcNumber("");
    setFEcRelation("Spouse");
    setFEcName("");
    setModalError("");
  };

  const openAdd = () => {
    resetForm();
    setActiveEmp(null);
    setFEmployeeId(generateRandom7Digit());
    setModal("add");
  };

  const openEdit = (e: Employee) => {
    resetForm();
    setActiveEmp(e);
    setFAvatarPreview(e.avatarUrl || "");
    setFEmployeeId(e.employeeId || "");
    setFName(e.name || "");
    setFMobile(e.mobile || "");
    setFCity(e.city || "");
    setFAddress(e.address || "");
    setFEmail(e.email || "");
    setFSalaryType(e.salaryType || "monthly");
    setFSalaryAmount(e.salaryAmount !== undefined && e.salaryAmount !== null ? String(e.salaryAmount) : "");
    setFAcceptedLeaves(String(e.acceptedLeaves ?? 0));
    setFEcNumber(e.emergencyContactNumber || "");
    setFEcRelation(e.emergencyRelation || "Spouse");
    setFEcName(e.emergencyName || "");
    setModal("edit");
  };

  const openView = (e: Employee) => {
    setActiveEmp(e);
    setModal("view");
  };

  const closeModal = () => {
    if (submitting) return;
    setModal("closed");
    setActiveEmp(null);
    resetForm();
  };

  /* ─── avatar handling ─── */
  const handleAvatarChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }

    setFAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFAvatarPreview(previewUrl);
  };

  const removeAvatar = () => {
    setFAvatarFile(null);
    setFAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── save employee ─── */
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
    const cleanEmpId = fEmployeeId.trim();

    if (!cleanEmpId || !/^\d{7}$/.test(cleanEmpId)) {
      setModalError("Employee ID must be a unique 7-digit numeric value (e.g. 1000001).");
      return;
    }
    if (!cleanName) { setModalError("Employee name is required."); return; }
    if (!cleanMobile || cleanMobile.length < 10) { setModalError("Please enter a valid 10-digit mobile number."); return; }
    if (!cleanCity) { setModalError("City is required."); return; }
    if (!cleanAddress) { setModalError("Full address is required."); return; }
    if (!cleanAmount || cleanAmount <= 0) { setModalError("Please enter a valid salary / wage amount."); return; }
    if (!cleanEcNumber || cleanEcNumber.length < 10) { setModalError("Emergency contact must be a valid 10-digit number."); return; }
    if (!cleanEcRelation) { setModalError("Emergency contact relation is required."); return; }
    if (!cleanEcName) { setModalError("Emergency contact name is required."); return; }

    setSubmitting(true);
    setModalError("");

    try {
      let finalAvatarUrl = activeEmp?.avatarUrl || "";

      // If a new avatar file was chosen: compress to <= 60KB and upload to ImageKit
      if (fAvatarFile) {
        try {
          const compressed = await compressClientImage(fAvatarFile, 60 * 1024);
          const uploadData = new FormData();
          uploadData.append("file", compressed);
          uploadData.append("folder", "employees/avatars");

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          });

          const uploadJson = await uploadRes.json();
          if (uploadRes.ok && uploadJson.success && uploadJson.url) {
            finalAvatarUrl = uploadJson.url;
          } else {
            throw new Error(uploadJson.error || "Failed to upload employee photo to ImageKit.");
          }
        } catch (uploadErr: any) {
          console.error("Avatar upload error:", uploadErr);
          setModalError(uploadErr.message || "Failed to upload employee photo.");
          setSubmitting(false);
          return;
        }
      } else if (!fAvatarPreview && modal === "edit") {
        finalAvatarUrl = "";
      }

      const payload: Record<string, any> = {
        name: cleanName,
        mobile: cleanMobile,
        city: cleanCity,
        address: cleanAddress,
        email: fEmail.trim(),
        employeeId: cleanEmpId,
        avatarUrl: finalAvatarUrl,
        salaryType: fSalaryType,
        salaryAmount: cleanAmount,
        acceptedLeaves: Math.max(0, parseInt(fAcceptedLeaves, 10) || 0),
        emergencyContactNumber: cleanEcNumber,
        emergencyRelation: cleanEcRelation,
        emergencyName: cleanEcName,
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
        setModalError(err);
        toast.error(err);
      } else {
        closeModal();
        toast.success(
          modal === "edit"
            ? "Employee updated successfully!"
            : "Employee added with QR code & ImageKit photo!"
        );
        loadEmployees();
      }
    } catch {
      const err = "Network error. Please try again.";
      setModalError(err);
      toast.error(err);
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
        toast.success("Employee removed.");
        setEmpToDelete(null);
        loadEmployees();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleting(false);
    }
  };

  /* ─── download QR code ─── */
  const handleDownloadQr = async (emp: Employee) => {
    if (!emp.qrCodeUrl) {
      toast.error("QR Code URL not found for this employee.");
      return;
    }
    try {
      const response = await fetch(emp.qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `QR_${emp.name.replace(/\s+/g, "_")}_${emp.employeeId || "emp"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("QR Code downloaded!");
    } catch (err) {
      console.error("QR download error:", err);
      window.open(emp.qrCodeUrl, "_blank");
    }
  };

  const inputCls =
    "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";
  const isFormModal = modal === "add" || modal === "edit";

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        <EmployeeSubNav />

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
              Manage store employees, profile photos, 7-digit numeric IDs, ImageKit QR codes, and salary.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="h-[34px] max-h-[34px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs px-3 rounded-[6px] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2] text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Bulk Upload
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </button>
          </div>
        </div>

        {/* ── Search ── */}
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
              value={searchQuery || ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, 7-digit ID, mobile, city, or email..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
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
              {searchQuery ? "Try adjusting your search criteria." : "Add your store employees or bulk upload 50 sample employees from Excel."}
            </p>
            {!searchQuery && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  className="h-[34px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Bulk Upload Excel
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  + Add First Employee
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Employee</th>
                  <th className="py-2.5 px-3">Emp ID</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Salary</th>
                  <th className="py-2.5 px-3">Leaves</th>
                  <th className="py-2.5 px-3">QR Code</th>
                  <th className="py-2.5 px-3">Emergency Contact</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => {
                  const firstLetter = getFirstLetter(e.name);
                  const colorCls = getFirstLetterColor(firstLetter);

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          {e.avatarUrl ? (
                            <img
                              src={e.avatarUrl}
                              alt={e.name}
                              className="w-8 h-8 rounded-full object-cover border border-purple-200 shadow-2xs flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                              {firstLetter}
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-slate-900 block leading-tight">{e.name}</span>
                            {e.email && <span className="text-[10.5px] text-slate-400 block">{e.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] font-semibold bg-purple-50 text-[#5e2b9d] border border-purple-200/60 px-2 py-0.5 rounded-[4px] inline-block tracking-wider">
                          {e.employeeId || "—"}
                        </span>
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
                        <span className="bg-slate-100 text-slate-700 text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] font-mono">
                          {e.acceptedLeaves ?? 0} {e.acceptedLeaves === 1 ? "day" : "days"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {e.qrCodeUrl ? (
                          <button
                            type="button"
                            onClick={() => setQrModalEmp(e)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-slate-100 hover:bg-[#5e2b9d]/10 hover:text-[#5e2b9d] text-slate-700 text-[10.5px] font-medium transition-colors cursor-pointer border border-slate-200"
                            title="View / Download QR Code"
                          >
                            <svg className="w-3.5 h-3.5 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span>QR Code</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>
                          <span className="font-medium text-slate-800 block leading-tight">{e.emergencyName}</span>
                          <span className="text-[10.5px] text-slate-400 font-mono">{e.emergencyContactNumber}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({e.emergencyRelation})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openView(e)}
                            title="View Details"
                            className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            title="Edit"
                            className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-[#5e2b9d] hover:border-[#5e2b9d] hover:bg-purple-50 transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmpToDelete(e)}
                            title="Delete"
                            className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                    <p className="text-[11px] text-slate-500 font-normal">Profile picture uploaded to ImageKit (&le;60KB) &amp; auto QR code.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer disabled:opacity-50"
                >
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

                  {/* ── SECTION 1 (FIRST): Employee Profile Picture & 7-Digit ID ── */}
                  <div className="p-3.5 rounded-[8px] bg-gradient-to-r from-purple-50/70 via-slate-50 to-indigo-50/50 border border-purple-100">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Avatar Round Preview */}
                      <div className="relative group flex-shrink-0">
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#5e2b9d]/40 group-hover:border-[#5e2b9d] overflow-hidden bg-white flex items-center justify-center shadow-xs transition-colors">
                          {fAvatarPreview ? (
                            <img
                              src={fAvatarPreview}
                              alt="Employee Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <svg className="w-7 h-7 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              <span className="text-[9px] font-medium text-slate-500 mt-0.5">Photo</span>
                            </div>
                          )}
                        </div>
                        <label
                          htmlFor="avatar-file-input"
                          className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#5e2b9d] text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-[#4e2284] transition-colors"
                          title="Choose Photo"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </label>
                        <input
                          id="avatar-file-input"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>

                      {/* Photo details & 7-digit ID */}
                      <div className="flex-1 w-full space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <label className="block text-xs font-semibold text-slate-900">
                              Employee Profile Picture <span className="text-slate-400 font-normal">(ImageKit Hosted)</span>
                            </label>
                            <p className="text-[11px] text-slate-500">
                              Upload JPG, PNG or WebP. Auto-compressed to &le; 60KB without losing quality.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="avatar-file-input"
                              className="text-[11px] text-[#5e2b9d] hover:text-[#4e2284] font-medium cursor-pointer"
                            >
                              {fAvatarPreview ? "Change Photo" : "Upload Photo"}
                            </label>
                            {fAvatarPreview && (
                              <button
                                type="button"
                                onClick={removeAvatar}
                                className="text-[11px] text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 7-digit unique numeric Employee ID */}
                        <div className="pt-2 border-t border-purple-100/90 flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                              Employee ID (7-Digit Unique Numeric) <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={fEmployeeId || ""}
                                onChange={(e) => {
                                  const num = e.target.value.replace(/\D/g, "").slice(0, 7);
                                  setFEmployeeId(num);
                                }}
                                placeholder="1000001"
                                maxLength={7}
                                required
                                className="h-[32px] px-3 font-mono font-bold text-xs tracking-wider bg-white border border-slate-300 rounded-[6px] text-[#5e2b9d] w-36 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                              />
                              {modal === "add" && (
                                <button
                                  type="button"
                                  onClick={() => setFEmployeeId(generateRandom7Digit())}
                                  title="Generate new unique 7-digit ID"
                                  className="h-[32px] px-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Generate</span>
                                </button>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">
                                {fEmployeeId.length === 7 ? "✓ Valid 7 Digits" : `${7 - fEmployeeId.length} digits required`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Section 2: Personal Info ── */}
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
                        <input
                          type="text"
                          value={fName || ""}
                          onChange={(e) => setFName(e.target.value)}
                          placeholder="e.g. Suresh Kumar"
                          required
                          className={inputCls}
                        />
                      </div>
                      {/* Mobile */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={fMobile || ""}
                          onChange={(e) => setFMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210"
                          maxLength={10}
                          required
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      {/* City */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fCity || ""}
                          onChange={(e) => setFCity(e.target.value)}
                          placeholder="e.g. Hyderabad"
                          required
                          className={inputCls}
                        />
                      </div>
                      {/* Email */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Email <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          value={fEmail || ""}
                          onChange={(e) => setFEmail(e.target.value)}
                          placeholder="employee@email.com"
                          className={inputCls}
                        />
                      </div>
                      {/* Address */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Full Address <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={fAddress || ""}
                          onChange={(e) => setFAddress(e.target.value)}
                          placeholder="House / Flat No., Street, Area, City, Pincode"
                          rows={2}
                          required
                          className="w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Section 3: Salary ── */}
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
                          <input
                            type="number"
                            value={fSalaryAmount || ""}
                            onChange={(e) => setFSalaryAmount(e.target.value)}
                            placeholder={fSalaryType === "monthly" ? "e.g. 18000" : "e.g. 650"}
                            min="1"
                            required
                            className={`${inputCls} pl-7 font-mono`}
                          />
                        </div>
                        <p className="text-[10.5px] text-slate-400">
                          {fSalaryType === "monthly" ? "Amount paid per month." : "Amount paid per working day."}
                        </p>
                      </div>

                      {/* Accepted Leaves */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Accepted Leaves <span className="text-slate-400 font-normal">(per month, 0 if none)</span>
                        </label>
                        <input
                          type="number"
                          value={fAcceptedLeaves}
                          onChange={(e) => setFAcceptedLeaves(e.target.value)}
                          placeholder="0"
                          min="0"
                          className={`${inputCls} font-mono`}
                        />
                        <p className="text-[10.5px] text-slate-400">
                          Allowed leaves count per month without loss of pay or bonus penalty. Default is 0.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Section 4: Emergency Contact ── */}
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
                        <input
                          type="text"
                          value={fEcName || ""}
                          onChange={(e) => setFEcName(e.target.value)}
                          placeholder="e.g. Priya Kumar"
                          required
                          className={inputCls}
                        />
                      </div>
                      {/* Relation */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Relation <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={fEcRelation || "Spouse"}
                          onChange={(e) => setFEcRelation(e.target.value)}
                          className={inputCls}
                        >
                          {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      {/* EC Mobile */}
                      <div className="space-y-1 col-span-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Contact Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={fEcNumber || ""}
                          onChange={(e) => setFEcNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210"
                          maxLength={10}
                          required
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-white sticky bottom-0">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Uploading &amp; Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>{modal === "edit" ? "Update Employee" : "Save Employee"}</span>
                      </>
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
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[75vh]">
                {/* Avatar & ID */}
                <div className="flex flex-col items-center mb-5">
                  {activeEmp.avatarUrl ? (
                    <img
                      src={activeEmp.avatarUrl}
                      alt={activeEmp.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#5e2b9d]/30 shadow-md mb-2"
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-full border-2 text-2xl font-bold flex items-center justify-center mb-2 shadow-sm ${getFirstLetterColor(getFirstLetter(activeEmp.name))}`}>
                      {getFirstLetter(activeEmp.name)}
                    </div>
                  )}
                  <h3 className="text-base font-semibold text-slate-900">{activeEmp.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-purple-50 text-[#5e2b9d] border border-purple-200/70">
                      ID: {activeEmp.employeeId || "—"}
                    </span>
                    <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] ${activeEmp.salaryType === "monthly" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {activeEmp.salaryType === "monthly" ? "Monthly" : "Daily"}
                    </span>
                  </div>
                </div>

                {/* QR Code Section */}
                {activeEmp.qrCodeUrl && (
                  <div className="p-3.5 mb-4 rounded-[8px] bg-slate-50 border border-slate-200 text-center flex flex-col items-center">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Employee QR Code (ImageKit Hosted)</p>
                    <div className="p-2 bg-white rounded-[6px] border border-slate-200 shadow-2xs mb-2">
                      <img
                        src={activeEmp.qrCodeUrl}
                        alt="Employee QR Code"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-mono mb-2">
                      {activeEmp.storeId || "STORE"}/{activeEmp.employeeId || "EMP"}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadQr(activeEmp)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-[5px] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download QR Code
                    </button>
                  </div>
                )}

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
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Accepted Leaves</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {activeEmp.acceptedLeaves ?? 0} days / month
                    </span>
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
                  <button
                    type="button"
                    onClick={() => { closeModal(); openEdit(activeEmp); }}
                    className="flex-1 h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { closeModal(); setEmpToDelete(activeEmp); }}
                    className="flex-1 h-[34px] rounded-[6px] border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
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

        {/* ══════════ QR CODE QUICK MODAL ══════════ */}
        {qrModalEmp && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[8px] border border-slate-200/80 shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="h-[48px] bg-[#f8fafc] border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-slate-900">Employee QR Code</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalEmp(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-3">
                  {qrModalEmp.avatarUrl ? (
                    <img
                      src={qrModalEmp.avatarUrl}
                      alt={qrModalEmp.name}
                      className="w-9 h-9 rounded-full object-cover border border-purple-200 shadow-2xs"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center border ${getFirstLetterColor(getFirstLetter(qrModalEmp.name))}`}>
                      {getFirstLetter(qrModalEmp.name)}
                    </div>
                  )}
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">{qrModalEmp.name}</h4>
                    <span className="font-mono text-[11px] font-bold text-[#5e2b9d]">
                      ID: {qrModalEmp.employeeId || "—"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-[8px] shadow-xs mb-3">
                  {qrModalEmp.qrCodeUrl ? (
                    <img
                      src={qrModalEmp.qrCodeUrl}
                      alt={`QR Code for ${qrModalEmp.name}`}
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                      No QR code generated yet.
                    </div>
                  )}
                </div>

                <div className="w-full bg-slate-50 border border-slate-100 rounded-[6px] py-1.5 px-3 mb-4">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">QR Code Data</p>
                  <p className="text-xs font-mono text-slate-800 break-all font-medium">
                    {qrModalEmp.storeId || "STORE"}/{qrModalEmp.employeeId || "—"}
                  </p>
                </div>

                <div className="w-full flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadQr(qrModalEmp)}
                    className="flex-1 h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrModalEmp(null)}
                    className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ BULK UPLOAD MODAL ══════════ */}
        <BulkUploadEmployeeModal
          isOpen={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={loadEmployees}
        />

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
