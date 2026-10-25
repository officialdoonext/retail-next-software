"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useToast } from "@/components/ToastProvider";

export interface EmployeeFormData {
  id?: string;
  employeeId?: string;
  name: string;
  mobile: string;
  email?: string;
  city: string;
  address: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  salaryType: "monthly" | "daily";
  salaryAmount: number | string;
  acceptedLeaves?: number | string;
  emergencyRelation: string;
  emergencyName: string;
  emergencyContactNumber: string;
  avatarUrl?: string;
  qrCodeUrl?: string;
  status?: string;
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (employee: any) => void;
  initialEmployee?: EmployeeFormData | null;
}

const COMMON_CITIES = [
  "VIJAYAWADA",
  "HYDERABAD",
  "VISAKHAPATNAM",
  "GUNTUR",
  "TIRUPATI",
  "RAJAHMUNDRY",
  "NELLORE",
  "KURNOOL",
  "WARANGAL",
  "BANGALORE",
  "CHENNAI",
  "MUMBAI",
  "DELHI",
];

const EMERGENCY_RELATIONS = [
  "Father",
  "Mother",
  "Spouse",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Guardian",
  "Friend",
  "Relative",
];

export default function EmployeeModal({
  isOpen,
  onClose,
  onSaved,
  initialEmployee,
}: EmployeeModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Profile image upload state (choose locally, upload ONLY on save)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const [formData, setFormData] = useState<EmployeeFormData>({
    name: "",
    mobile: "",
    email: "",
    city: "VIJAYAWADA",
    address: "",
    latitude: "",
    longitude: "",
    salaryType: "monthly",
    salaryAmount: "",
    acceptedLeaves: 2,
    emergencyRelation: "Father",
    emergencyName: "",
    emergencyContactNumber: "",
    avatarUrl: "",
  });

  useEffect(() => {
    if (initialEmployee) {
      setFormData({
        id: initialEmployee.id,
        employeeId: initialEmployee.employeeId || "",
        name: initialEmployee.name || "",
        mobile: initialEmployee.mobile || "",
        email: initialEmployee.email || "",
        city: initialEmployee.city || "VIJAYAWADA",
        address: initialEmployee.address || "",
        latitude: initialEmployee.latitude ?? "",
        longitude: initialEmployee.longitude ?? "",
        salaryType: initialEmployee.salaryType || "monthly",
        salaryAmount: initialEmployee.salaryAmount || "",
        acceptedLeaves: initialEmployee.acceptedLeaves ?? 2,
        emergencyRelation: initialEmployee.emergencyRelation || "Father",
        emergencyName: initialEmployee.emergencyName || "",
        emergencyContactNumber: initialEmployee.emergencyContactNumber || "",
        avatarUrl: initialEmployee.avatarUrl || "",
        qrCodeUrl: initialEmployee.qrCodeUrl || "",
      });
      setPreviewUrl(initialEmployee.avatarUrl || "");
      setSelectedFile(null);
    } else {
      setFormData({
        name: "",
        mobile: "",
        email: "",
        city: "VIJAYAWADA",
        address: "",
        latitude: "",
        longitude: "",
        salaryType: "monthly",
        salaryAmount: "",
        acceptedLeaves: 2,
        emergencyRelation: "Father",
        emergencyName: "",
        emergencyContactNumber: "",
        avatarUrl: "",
      });
      setPreviewUrl("");
      setSelectedFile(null);
    }
  }, [initialEmployee, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field: keyof EmployeeFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Local image file selection (DO NOT upload immediately; only preview)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file size should not exceed 8MB.");
      return;
    }

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setFormData((prev) => ({ ...prev, avatarUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // GPS Location fetcher using browser Geolocation API
  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setFetchingGps(false);
        toast.success(`Coordinates fetched: ${lat}, ${lng}`);
      },
      (err) => {
        setFetchingGps(false);
        let msg = "Could not fetch GPS coordinates.";
        if (err.code === 1) msg = "Location permission denied. Please allow location access.";
        if (err.code === 2) msg = "Location position unavailable.";
        if (err.code === 3) msg = "Location request timed out.";
        toast.warning(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const name = formData.name.trim();
    if (!name) {
      toast.error("Please enter Employee Name.");
      return;
    }

    const cleanMobile = formData.mobile.trim().replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    const city = formData.city.trim();
    if (!city) {
      toast.error("Please enter City.");
      return;
    }

    const address = formData.address.trim();
    if (!address) {
      toast.error("Please enter Full Address.");
      return;
    }

    const salaryAmountNum = Number(formData.salaryAmount);
    if (!salaryAmountNum || salaryAmountNum <= 0) {
      toast.error(
        formData.salaryType === "monthly"
          ? "Please enter a valid Monthly Salary amount."
          : "Please enter a valid Daily Wage amount."
      );
      return;
    }

    const emgName = formData.emergencyName.trim();
    if (!emgName) {
      toast.error("Please enter Emergency Contact Name.");
      return;
    }

    const emgRelation = formData.emergencyRelation.trim();
    if (!emgRelation) {
      toast.error("Please select or enter Emergency Contact Relation.");
      return;
    }

    const cleanEmgMobile = formData.emergencyContactNumber.trim().replace(/\D/g, "");
    if (!cleanEmgMobile || cleanEmgMobile.length < 10) {
      toast.error("Please enter a valid 10-digit emergency contact mobile number.");
      return;
    }

    try {
      setSubmitting(true);

      // STEP 1: If a new photo was chosen, upload to ImageKit ONLY on Save!
      let finalAvatarUrl = formData.avatarUrl || "";
      if (selectedFile) {
        toast.info("Uploading profile picture to ImageKit...");
        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        uploadData.append("folder", "employees");

        const upRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });

        const upJson = await upRes.json();
        if (!upRes.ok || !upJson.success || !upJson.url) {
          toast.error(upJson.error || "Failed to upload profile picture to ImageKit.");
          setSubmitting(false);
          return;
        }

        finalAvatarUrl = upJson.url;
      }

      // STEP 2: Save Employee details with location and avatar to backend
      const isEdit = Boolean(formData.id);
      const endpoint = "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name,
          mobile: cleanMobile,
          city,
          address,
          latitude: formData.latitude !== "" && formData.latitude !== null ? Number(formData.latitude) : null,
          longitude: formData.longitude !== "" && formData.longitude !== null ? Number(formData.longitude) : null,
          email: formData.email?.trim().toLowerCase() || "",
          salaryType: formData.salaryType,
          salaryAmount: salaryAmountNum,
          emergencyName: emgName,
          emergencyRelation: emgRelation,
          emergencyContactNumber: cleanEmgMobile,
          avatarUrl: finalAvatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save employee.");
        return;
      }

      toast.success(
        isEdit
          ? "Employee updated successfully!"
          : "Employee registered & Attendance QR generated successfully!"
      );
      onSaved(data.employee);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving employee.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide">
                {formData.id ? "Edit Employee" : "Add New Employee"}
              </h2>
              <p className="text-[11px] text-purple-200">
                Staff profile, profile photo, GPS location, wages & attendance QR code
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 custom-sidebar-scroll text-xs">
          
          {/* Section 0: Profile Picture Chooser (Uploads ONLY on Save) */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/90 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full border-2 border-purple-200 bg-white overflow-hidden shadow-xs flex items-center justify-center relative">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Employee Avatar Preview"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="text-xs font-semibold text-slate-800 block">
                Profile Picture <span className="text-[10px] text-slate-400 font-normal">(Uploaded to ImageKit on Save)</span>
              </span>
              <p className="text-[11px] text-slate-500 mb-2">
                Choose a clear face photograph for the employee ID badge and attendance logs.
              </p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="employee-avatar-upload"
                />
                <label
                  htmlFor="employee-avatar-upload"
                  className="px-3 py-1 bg-white hover:bg-purple-50 text-slate-700 hover:text-[#5e2b9d] border border-slate-200 hover:border-purple-200 rounded font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{previewUrl ? "Change Photo" : "Choose Profile Picture"}</span>
                </label>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <span>Personal & Contact Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Employee Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="w-full h-8 pl-10 pr-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Email (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="ramesh@retailnext.in"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  list="employee-city-list"
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value.toUpperCase())}
                  placeholder="VIJAYAWADA"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none uppercase"
                />
                <datalist id="employee-city-list">
                  {COMMON_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Full Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Door No, Street Name, Landmark, Area & Pin code"
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none resize-none"
                />
              </div>

              {/* Location Details: Latitude & Longitude with Fetch Button */}
              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location Coordinates (Latitude & Longitude)
                  </span>

                  <button
                    type="button"
                    disabled={fetchingGps}
                    onClick={handleFetchCurrentLocation}
                    className="h-7 px-2.5 bg-white hover:bg-purple-50 text-[#5e2b9d] border border-purple-200 rounded font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {fetchingGps ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-[#5e2b9d]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Fetch Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude ?? ""}
                      onChange={(e) => handleChange("latitude", e.target.value)}
                      placeholder="e.g. 16.506174"
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude ?? ""}
                      onChange={(e) => handleChange("longitude", e.target.value)}
                      placeholder="e.g. 80.648015"
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {formData.latitude && formData.longitude ? (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-700 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Coordinates set ({formData.latitude}, {formData.longitude})</span>
                    <a
                      href={`https://maps.google.com/?q=${formData.latitude},${formData.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-700 underline ml-1 hover:text-purple-900"
                    >
                      View on Map ↗
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Section 2: Compensation & Wages Structure (Monthly vs Daily) */}
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center justify-between">
              <span>Salary & Wage Structure</span>
              <span className="text-[10px] font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                {formData.salaryType === "monthly" ? "Monthly Basis" : "Daily Basis"}
              </span>
            </div>

            <div className="bg-purple-50/40 p-3.5 rounded-lg border border-purple-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Compensation Plan: Daily Wages or Monthly Salary? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange("salaryType", "monthly")}
                    className={`h-9 px-3 rounded-md font-medium text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formData.salaryType === "monthly"
                        ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs font-semibold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Monthly Salary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange("salaryType", "daily")}
                    className={`h-9 px-3 rounded-md font-medium text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formData.salaryType === "daily"
                        ? "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs font-semibold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Daily Wages</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Salary / Wage Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {formData.salaryType === "monthly" ? "Monthly Salary Amount (₹)" : "Daily Wage Rate (₹)"} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.salaryAmount}
                    onChange={(e) => handleChange("salaryAmount", e.target.value)}
                    placeholder={formData.salaryType === "monthly" ? "e.g. 25000.00" : "e.g. 850.00"}
                    className="w-full h-9 pl-7 pr-3 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none font-mono font-bold text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {formData.salaryType === "monthly"
                    ? "Fixed monthly pay disbursed per payroll month."
                    : "Calculated per day worked based on attendance clock-ins."}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Emergency Contact Details */}
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center justify-between">
              <span>Emergency Contact Details</span>
              <span className="text-[10px] text-rose-500 font-medium">Critical</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
              {/* Emergency Relation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.emergencyRelation}
                  onChange={(e) => handleChange("emergencyRelation", e.target.value)}
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:outline-none cursor-pointer"
                >
                  {EMERGENCY_RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Emergency Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relation Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.emergencyName}
                  onChange={(e) => handleChange("emergencyName", e.target.value)}
                  placeholder="e.g. Suresh Kumar"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none"
                />
              </div>

              {/* Emergency Mobile */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Mobile <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.emergencyContactNumber}
                  onChange={(e) => handleChange("emergencyContactNumber", e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Auto-Generated Attendance QR Info */}
          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white border border-purple-200 flex items-center justify-center text-[#5e2b9d] shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="text-[11px] text-purple-900 leading-tight">
              <span className="font-bold">Attendance QR Code:</span> On clicking Save, a PNG QR code containing <code className="bg-white px-1 py-0.5 rounded font-mono text-[#5e2b9d] border border-purple-200">businessid:employeeid</code> will be generated, uploaded to ImageKit, and saved for contactless attendance clock-ins.
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Fields marked with <span className="text-rose-500 font-bold">*</span> are mandatory
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-8 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit()}
              className="h-8 px-5 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Saving & Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Employee</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
