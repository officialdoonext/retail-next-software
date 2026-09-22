"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface StaffMember {
  id: string;
  name: string;
  mobile: string;
  role: string;
  status: string;
  createdAt: number;
  mpin?: string; // only available when editing / viewing
}

const ROLES = ["Manager", "Cashier", "Staff", "Supervisor", "Accountant"];

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    Manager: "bg-purple-100 text-purple-700",
    Cashier: "bg-blue-100 text-blue-700",
    Supervisor: "bg-amber-100 text-amber-700",
    Accountant: "bg-teal-100 text-teal-700",
    Staff: "bg-slate-100 text-slate-600",
  };
  const cls = map[role] ?? "bg-slate-100 text-slate-600";
  return (
    <span
      className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] ${cls}`}
    >
      {role}
    </span>
  );
}

export default function EmployeesPage() {
  const toast = useToast();

  /* ─── data state ─── */
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  /* ─── modal state ─── */
  const [modal, setModal] = useState<"closed" | "add" | "edit" | "view">("closed");
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ─── form fields ─── */
  const [fName, setFName] = useState("");
  const [fMobile, setFMobile] = useState("");
  const [fMpin, setFMpin] = useState("");
  const [fMpinConfirm, setFMpinConfirm] = useState("");
  const [fRole, setFRole] = useState("Staff");
  const [showMpin, setShowMpin] = useState(false);
  const [showMpinConfirm, setShowMpinConfirm] = useState(false);

  /* ─── load staff ─── */
  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.staff)) {
        setStaff(data.staff);
      } else {
        toast.error(data.error || "Failed to fetch staff.");
      }
    } catch {
      toast.error("Network error loading staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── filtered list ─── */
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return staff.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        s.role.toLowerCase().includes(q);
      const matchRole = roleFilter === "ALL" || s.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [staff, searchQuery, roleFilter]);

  /* ─── modal helpers ─── */
  const resetForm = () => {
    setFName("");
    setFMobile("");
    setFMpin("");
    setFMpinConfirm("");
    setFRole("Staff");
    setShowMpin(false);
    setShowMpinConfirm(false);
    setModalError("");
  };

  const openAdd = () => {
    resetForm();
    setActiveStaff(null);
    setModal("add");
  };

  const openEdit = (s: StaffMember) => {
    resetForm();
    setActiveStaff(s);
    setFName(s.name);
    setFMobile(s.mobile);
    setFRole(s.role);
    setFMpin(""); // always reset MPIN on edit
    setFMpinConfirm("");
    setModal("edit");
  };

  const openView = (s: StaffMember) => {
    setActiveStaff(s);
    setModal("view");
  };

  const closeModal = () => {
    if (submitting) return;
    setModal("closed");
    setActiveStaff(null);
    resetForm();
  };

  /* ─── save (add / edit) ─── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = fName.trim();
    const cleanMobile = fMobile.trim().replace(/\D/g, "");
    const cleanMpin = fMpin.trim();
    const cleanMpinConfirm = fMpinConfirm.trim();

    if (!cleanName) {
      setModalError("Staff name is required.");
      return;
    }
    if (!cleanMobile || cleanMobile.length < 10) {
      setModalError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!cleanMpin || cleanMpin.length < 4) {
      setModalError("MPIN must be at least 4 digits.");
      return;
    }
    if (!/^\d+$/.test(cleanMpin)) {
      setModalError("MPIN must contain digits only.");
      return;
    }
    if (cleanMpin !== cleanMpinConfirm) {
      setModalError("MPIN and Confirm MPIN do not match.");
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const payload: Record<string, string> = {
        name: cleanName,
        mobile: cleanMobile,
        mpin: cleanMpin,
        role: fRole,
      };
      if (modal === "edit" && activeStaff) payload.id = activeStaff.id;

      const res = await fetch("/api/staff", {
        method: modal === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || "Failed to save staff member.";
        setModalError(err);
        toast.error(err);
      } else {
        closeModal();
        toast.success(
          modal === "edit"
            ? "Staff member updated successfully!"
            : "Staff member added successfully!"
        );
        loadStaff();
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
    if (!staffToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff?id=${staffToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to delete staff member.");
      } else {
        toast.success("Staff member removed.");
        setStaffToDelete(null);
        loadStaff();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  /* ─── shared input class ─── */
  const inputCls =
    "w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]";

  const isFormModal = modal === "add" || modal === "edit";

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Staff
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {staff.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage your store staff, roles, and MPIN access credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <svg
              className="w-3.5 h-3.5 stroke-[2.2]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Staff</span>
          </button>
        </div>

        {/* ── Search & Filter ── */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, mobile number, or role..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-[34px] max-h-[34px] w-full sm:w-40 bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-normal">
              Loading staff members...
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 stroke-[1.8]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery || roleFilter !== "ALL"
                ? "No matching staff found"
                : "No staff added yet"}
            </h3>
            <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mb-4">
              {searchQuery || roleFilter !== "ALL"
                ? "Try adjusting your search or clearing filters."
                : "Add your store staff with their name, mobile number, and MPIN to manage access."}
            </p>
            {!searchQuery && roleFilter === "ALL" && (
              <button
                type="button"
                onClick={openAdd}
                className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                + Add First Staff Member
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Staff Member</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Added On</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Name + Avatar */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200/80 text-[#5e2b9d] font-medium text-xs flex items-center justify-center flex-shrink-0">
                          {getInitials(s.name)}
                        </div>
                        <span className="font-medium text-slate-900">
                          {s.name}
                        </span>
                      </div>
                    </td>

                    {/* Mobile */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11.5px]">
                        <svg
                          className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                          />
                        </svg>
                        {s.mobile}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-3">
                      <RoleBadge role={s.role} />
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] ${
                          s.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] font-normal">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View */}
                        <button
                          type="button"
                          onClick={() => openView(s)}
                          title="View Staff"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-[1.8]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          title="Edit Staff"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-[#5e2b9d] hover:border-[#5e2b9d] hover:bg-purple-50 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-[1.8]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setStaffToDelete(s)}
                          title="Delete Staff"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-[1.8]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
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

        {/* ══════════════════════════════════════════
            ADD / EDIT MODAL
        ══════════════════════════════════════════ */}
        {isFormModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[8px] border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="h-[52px] bg-[#f8fafc] border-b border-slate-200 px-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg
                      className="w-4 h-4 stroke-[2]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-slate-900 leading-tight">
                      {modal === "edit" ? "Edit Staff Member" : "Add New Staff"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Fill in the details and save.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer disabled:opacity-50"
                >
                  <svg
                    className="w-4 h-4 stroke-[2]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-5 space-y-3.5">
                {modalError && (
                  <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {modalError}
                  </div>
                )}

                {/* Staff Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Staff Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="e.g. Ravi Kumar"
                    required
                    className={inputCls}
                  />
                </div>

                {/* Mobile */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={fMobile}
                    onChange={(e) =>
                      setFMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="9876543210"
                    maxLength={10}
                    required
                    className={`${inputCls} font-mono`}
                  />
                  <p className="text-[10.5px] text-slate-400 font-normal">
                    10-digit mobile number.
                  </p>
                </div>

                {/* Role */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={fRole}
                    onChange={(e) => setFRole(e.target.value)}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MPIN */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    MPIN{" "}
                    <span className="text-rose-500">*</span>
                    <span className="text-slate-400 font-normal ml-1">
                      (4–6 digits)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showMpin ? "text" : "password"}
                      value={fMpin}
                      onChange={(e) =>
                        setFMpin(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="••••"
                      maxLength={6}
                      required
                      inputMode="numeric"
                      className={`${inputCls} font-mono pr-9`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowMpin(!showMpin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showMpin ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm MPIN */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Confirm MPIN <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showMpinConfirm ? "text" : "password"}
                      value={fMpinConfirm}
                      onChange={(e) =>
                        setFMpinConfirm(
                          e.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      placeholder="••••"
                      maxLength={6}
                      required
                      inputMode="numeric"
                      className={`${inputCls} font-mono pr-9 ${
                        fMpinConfirm && fMpin !== fMpinConfirm
                          ? "border-rose-300 ring-1 ring-rose-300"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowMpinConfirm(!showMpinConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showMpinConfirm ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fMpinConfirm && fMpin !== fMpinConfirm && (
                    <p className="text-[10.5px] text-rose-500 font-medium">
                      MPIN does not match.
                    </p>
                  )}
                  {fMpinConfirm && fMpin === fMpinConfirm && fMpin.length >= 4 && (
                    <p className="text-[10.5px] text-green-600 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      MPIN matched
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5 stroke-[2]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        <span>
                          {modal === "edit" ? "Update Staff" : "Save Staff"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            VIEW MODAL
        ══════════════════════════════════════════ */}
        {modal === "view" && activeStaff && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[8px] border border-slate-200/80 shadow-2xl w-full max-w-sm overflow-hidden">
              {/* Header */}
              <div className="h-[52px] bg-[#f8fafc] border-b border-slate-200 px-5 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-900">
                  Staff Details
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 stroke-[2]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-5">
                {/* Avatar + Name */}
                <div className="flex flex-col items-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-purple-100 border-2 border-purple-200 text-[#5e2b9d] font-semibold text-xl flex items-center justify-center mb-2">
                    {getInitials(activeStaff.name)}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {activeStaff.name}
                  </h3>
                  <RoleBadge role={activeStaff.role} />
                </div>

                {/* Details grid */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">
                      Mobile Number
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-800">
                      {activeStaff.mobile}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">
                      Status
                    </span>
                    <span
                      className={`text-[10.5px] font-medium px-2 py-0.5 rounded-[4px] ${
                        activeStaff.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {activeStaff.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">
                      MPIN
                    </span>
                    <span className="text-xs font-mono text-slate-400 tracking-widest">
                      ••••
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-500 font-medium">
                      Added On
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(activeStaff.createdAt).toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "short", year: "numeric" }
                      )}
                    </span>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      openEdit(activeStaff);
                    }}
                    className="flex-1 h-[34px] rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5 stroke-[1.8]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      setStaffToDelete(activeStaff);
                    }}
                    className="flex-1 h-[34px] rounded-[6px] border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5 stroke-[1.8]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ── */}
        <ConfirmModal
          isOpen={staffToDelete !== null}
          title="Delete Staff Member"
          message={`Are you sure you want to remove "${staffToDelete?.name}" (${staffToDelete?.mobile}) from your store staff? This action cannot be undone.`}
          confirmText="Delete Staff"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onClose={() => setStaffToDelete(null)}
        />
      </div>
    </SoftwareLayout>
  );
}
