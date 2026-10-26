"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";

export interface CustomerFormData {
  id?: string;
  customerCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  birthDate: string;
  hasBirthDate: boolean;
  anniversaryDate: string;
  hasAnniversary: boolean;
  cardNo: string;
  cardValidity: string;
  entryDate: string;
  pin: string;
  tin: string;
  branch: string;
  ledger: string;
  stopCredit: boolean;
  opCreditBalance: number | string;
  creditDays: number | string;
  creditLimit: number | string;
  customerGroup: string;
  classification: string;
  landline: string;
  billCycle: number | string;
  opSales: number | string;
  remarks: string;
  gstNumber: string;
  placeOfSupply: string;
  discountPercent: number | string;
  applyDiscountNonDisc: boolean;
  isInactive: boolean;
  blockTSms: boolean;
  blockPSms: boolean;
  blockWa: boolean;
  dontFollowup: boolean;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (customer: any) => void;
  initialCustomer?: CustomerFormData | null;
  existingCustomers?: any[];
  defaultBranchName?: string;
}

const INDIAN_STATES = [
  "37-Andhra Pradesh",
  "36-Telangana",
  "29-Karnataka",
  "33-Tamil Nadu",
  "27-Maharashtra",
  "07-Delhi",
  "24-Gujarat",
  "19-West Bengal",
  "32-Kerala",
  "09-Uttar Pradesh",
  "08-Rajasthan",
  "23-Madhya Pradesh",
  "03-Punjab",
  "06-Haryana",
  "21-Odisha",
  "10-Bihar",
  "18-Assam",
  "30-Goa",
  "01-Jammu and Kashmir",
  "02-Himachal Pradesh",
  "05-Uttarakhand",
  "22-Chhattisgarh",
  "20-Jharkhand",
  "97-Other Territory",
];

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

const CUSTOMER_GROUPS = [
  "Retail",
  "Wholesale",
  "VIP",
  "Corporate",
  "Regular",
  "Walk-in",
];

function generateCode(prefix = "MC"): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix.toUpperCase().slice(0, 3)}${digits}`;
}

export default function CustomerModal({
  isOpen,
  onClose,
  onSaved,
  initialCustomer,
  existingCustomers = [],
  defaultBranchName = "MADHU CREATIONS",
}: CustomerModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CustomerFormData>(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      customerCode: generateCode("MC"),
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "VIJAYAWADA",
      birthDate: today,
      hasBirthDate: false,
      anniversaryDate: today,
      hasAnniversary: false,
      cardNo: "",
      cardValidity: "2500-01-01",
      entryDate: today,
      pin: "",
      tin: "",
      branch: defaultBranchName || "MADHU CREATIONS",
      ledger: "Sundry Debtors",
      stopCredit: false,
      opCreditBalance: "0.00",
      creditDays: "0",
      creditLimit: "0.00",
      customerGroup: "Retail",
      classification: "General",
      landline: "",
      billCycle: "1",
      opSales: "0.00",
      remarks: "",
      gstNumber: "",
      placeOfSupply: "37-Andhra Pradesh",
      discountPercent: "0.00",
      applyDiscountNonDisc: false,
      isInactive: false,
      blockTSms: false,
      blockPSms: false,
      blockWa: false,
      dontFollowup: false,
    };
  });

  // Reset or fill state on edit
  useEffect(() => {
    if (initialCustomer) {
      setFormData({
        id: initialCustomer.id,
        customerCode: initialCustomer.customerCode || generateCode("MC"),
        name: initialCustomer.name || "",
        phone: initialCustomer.phone || "",
        email: initialCustomer.email || "",
        address: initialCustomer.address || "",
        city: initialCustomer.city || "VIJAYAWADA",
        birthDate: initialCustomer.birthDate || new Date().toISOString().split("T")[0],
        hasBirthDate: Boolean(initialCustomer.hasBirthDate),
        anniversaryDate: initialCustomer.anniversaryDate || new Date().toISOString().split("T")[0],
        hasAnniversary: Boolean(initialCustomer.hasAnniversary),
        cardNo: initialCustomer.cardNo || "",
        cardValidity: initialCustomer.cardValidity || "2500-01-01",
        entryDate: initialCustomer.entryDate || new Date().toISOString().split("T")[0],
        pin: initialCustomer.pin || "",
        tin: initialCustomer.tin || "",
        branch: initialCustomer.branch || defaultBranchName || "MADHU CREATIONS",
        ledger: initialCustomer.ledger || "Sundry Debtors",
        stopCredit: Boolean(initialCustomer.stopCredit),
        opCreditBalance: initialCustomer.opCreditBalance ?? "0.00",
        creditDays: initialCustomer.creditDays ?? "0",
        creditLimit: initialCustomer.creditLimit ?? "0.00",
        customerGroup: initialCustomer.customerGroup || "Retail",
        classification: initialCustomer.classification || "General",
        landline: initialCustomer.landline || "",
        billCycle: initialCustomer.billCycle ?? "1",
        opSales: initialCustomer.opSales ?? "0.00",
        remarks: initialCustomer.remarks || "",
        gstNumber: initialCustomer.gstNumber || "",
        placeOfSupply: initialCustomer.placeOfSupply || "37-Andhra Pradesh",
        discountPercent: initialCustomer.discountPercent ?? "0.00",
        applyDiscountNonDisc: Boolean(initialCustomer.applyDiscountNonDisc),
        isInactive: Boolean(initialCustomer.isInactive),
        blockTSms: Boolean(initialCustomer.blockTSms),
        blockPSms: Boolean(initialCustomer.blockPSms),
        blockWa: Boolean(initialCustomer.blockWa),
        dontFollowup: Boolean(initialCustomer.dontFollowup),
      });
    } else {
      const today = new Date().toISOString().split("T")[0];
      setFormData({
        customerCode: generateCode("MC"),
        name: "",
        phone: "",
        email: "",
        address: "",
        city: "VIJAYAWADA",
        birthDate: today,
        hasBirthDate: false,
        anniversaryDate: today,
        hasAnniversary: false,
        cardNo: "",
        cardValidity: "2500-01-01",
        entryDate: today,
        pin: "",
        tin: "",
        branch: defaultBranchName || "MADHU CREATIONS",
        ledger: "Sundry Debtors",
        stopCredit: false,
        opCreditBalance: "0.00",
        creditDays: "0",
        creditLimit: "0.00",
        customerGroup: "Retail",
        classification: "General",
        landline: "",
        billCycle: "1",
        opSales: "0.00",
        remarks: "",
        gstNumber: "",
        placeOfSupply: "37-Andhra Pradesh",
        discountPercent: "0.00",
        applyDiscountNonDisc: false,
        isInactive: false,
        blockTSms: false,
        blockPSms: false,
        blockWa: false,
        dontFollowup: false,
      });
    }
  }, [initialCustomer, defaultBranchName, isOpen]);

  // Real-time matching for "Similar Names" panel
  const similarNames = useMemo(() => {
    const qName = formData.name.trim().toLowerCase();
    const qPhone = formData.phone.trim();
    if (!qName && (!qPhone || qPhone.length < 3)) return [];

    return existingCustomers
      .filter((c: any) => {
        if (initialCustomer?.id && c.id === initialCustomer.id) return false;
        const matchName = qName.length >= 2 && c.name?.toLowerCase().includes(qName);
        const matchPhone = qPhone.length >= 3 && c.phone?.includes(qPhone);
        return matchName || matchPhone;
      })
      .slice(0, 10);
  }, [formData.name, formData.phone, existingCustomers, initialCustomer]);

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

  const handleChange = (field: keyof CustomerFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateCode = () => {
    const branchPrefix = formData.branch
      ? formData.branch.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3)
      : "MC";
    const newCode = generateCode(branchPrefix || "MC");
    setFormData((prev) => ({ ...prev, customerCode: newCode }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter Customer Name.");
      return;
    }

    const cleanPhone = formData.phone.trim().replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setSubmitting(true);
      const isEdit = Boolean(formData.id);
      const endpoint = "/api/customers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone: cleanPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save customer.");
        return;
      }

      toast.success(isEdit ? "Customer updated successfully!" : "Customer registered successfully!");
      onSaved(data.customer);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving customer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-0 md:p-3 overflow-hidden animate-in fade-in duration-150">
      <div className="w-full h-full max-w-[1240px] max-h-[96vh] bg-[#f8fafc] flex flex-col rounded-none md:rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Top Window Header (VenX/Modern Style) */}
        <div className="bg-[#5e2b9d] text-white px-4 py-2.5 flex items-center justify-between shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white">
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide">
                  {formData.id ? "Edit Customer" : "Customer Master Entry"}
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  VenX POS Ultimate
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Body: Two Clean Balanced Columns */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-sidebar-scroll bg-[#f8fafc]">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* ─── LEFT COLUMN ──────────────────────────────────────────────── */}
            <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                <span>Personal & Identity Details</span>
                <span className="text-[10px] font-normal text-slate-400">Section A</span>
              </div>

              {/* Customer Code & Generate Button */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Customer Code
                </label>
                <div className="sm:col-span-8 flex gap-2">
                  <input
                    type="text"
                    value={formData.customerCode}
                    onChange={(e) => handleChange("customerCode", e.target.value.toUpperCase())}
                    className="flex-1 h-8 px-2.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-[#5e2b9d] focus:outline-none"
                    placeholder="MC8539"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="px-2.5 h-8 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-[#5e2b9d] border border-slate-200 hover:border-purple-200 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Generate Code
                  </button>
                </div>
              </div>

              {/* Customer Name */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none"
                    placeholder="Enter customer full name"
                  />
                </div>
              </div>

              {/* BirthDate & Anniversary */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={formData.hasBirthDate}
                    onChange={(e) => handleChange("hasBirthDate", e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                  />
                  <span>BirthDate</span>
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="date"
                    disabled={!formData.hasBirthDate}
                    value={formData.birthDate}
                    onChange={(e) => handleChange("birthDate", e.target.value)}
                    className={`w-full h-8 px-2.5 text-xs border rounded focus:outline-none ${
                      formData.hasBirthDate
                        ? "bg-white border-slate-200 text-slate-800"
                        : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={formData.hasAnniversary}
                    onChange={(e) => handleChange("hasAnniversary", e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                  />
                  <span>Anniversary</span>
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="date"
                    disabled={!formData.hasAnniversary}
                    value={formData.anniversaryDate}
                    onChange={(e) => handleChange("anniversaryDate", e.target.value)}
                    className={`w-full h-8 px-2.5 text-xs border rounded focus:outline-none ${
                      formData.hasAnniversary
                        ? "bg-white border-slate-200 text-slate-800"
                        : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>

              {/* City */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  City
                </label>
                <div className="sm:col-span-8 flex gap-2">
                  <input
                    list="city-options"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value.toUpperCase())}
                    className="flex-1 h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none uppercase"
                    placeholder="VIJAYAWADA"
                  />
                  <datalist id="city-options">
                    {COMMON_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <span className="w-8 h-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0" title="AP/Telangana Hub">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* CardNo & Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  CardNo
                </label>
                <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      value={formData.cardNo}
                      onChange={(e) => handleChange("cardNo", e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                      placeholder="Card #"
                    />
                  </div>
                  <div className="sm:col-span-6 flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Validity</span>
                    <input
                      type="date"
                      value={formData.cardValidity}
                      onChange={(e) => handleChange("cardValidity", e.target.value)}
                      className="w-full h-8 px-2 text-[11px] bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Mobile <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value.replace(/\D/g, ""))}
                      className="w-full h-8 pl-10 pr-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:ring-1 focus:ring-purple-200 focus:outline-none font-mono font-medium"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700 pt-1.5">
                  Address
                </label>
                <div className="sm:col-span-8">
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none resize-none"
                    placeholder="Door no, street, locality..."
                  />
                </div>
              </div>

              {/* EntryDate & Pin */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  EntryDate
                </label>
                <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7">
                    <input
                      type="date"
                      value={formData.entryDate}
                      onChange={(e) => handleChange("entryDate", e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Pin</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.pin}
                      onChange={(e) => handleChange("pin", e.target.value.replace(/\D/g, ""))}
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                      placeholder="520001"
                    />
                  </div>
                </div>
              </div>

              {/* Email & TIN */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Email
                </label>
                <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value.toLowerCase())}
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                      placeholder="customer@email.com"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">TIN</span>
                    <input
                      type="text"
                      value={formData.tin}
                      onChange={(e) => handleChange("tin", e.target.value.toUpperCase())}
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                      placeholder="TIN No"
                    />
                  </div>
                </div>
              </div>

              {/* Branch & Ledger */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Branch
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => handleChange("branch", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-[#5e2b9d] focus:outline-none font-medium"
                    placeholder="MADHU CREATIONS"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Ledger
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    value={formData.ledger}
                    onChange={(e) => handleChange("ledger", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                    placeholder="Sundry Debtors"
                  />
                </div>
              </div>

              {/* Credit Details Box */}
              <div className="pt-2">
                <div className="p-3 bg-purple-50/40 rounded border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.stopCredit}
                        onChange={(e) => handleChange("stopCredit", e.target.checked)}
                        className="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer"
                      />
                      <span className={formData.stopCredit ? "text-rose-600 font-bold" : "text-slate-700"}>
                        Stop Credit
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Credit Management</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-[11px] w-28 shrink-0">Op Credit Balance</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.opCreditBalance}
                        onChange={(e) => handleChange("opCreditBalance", e.target.value)}
                        className="w-full h-7 px-2 text-right font-mono bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                        placeholder="₹0.00"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-[11px] w-20 shrink-0">Credit Days</span>
                      <input
                        type="number"
                        value={formData.creditDays}
                        onChange={(e) => handleChange("creditDays", e.target.value)}
                        className="w-full h-7 px-2 text-right font-mono bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <span className="text-slate-600 text-[11px] w-28 shrink-0">Credit Limit</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.creditLimit}
                        onChange={(e) => handleChange("creditLimit", e.target.value)}
                        className="w-full h-7 px-2 text-right font-mono bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-bold text-slate-800"
                        placeholder="₹0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ─── RIGHT COLUMN ─────────────────────────────────────────────── */}
            <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                <span>Classification, Taxes & Live Lookup</span>
                <span className="text-[10px] font-normal text-slate-400">Section B</span>
              </div>

              {/* Similar Names Live Panel */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Similar Names <span className="text-[10px] text-slate-400 font-normal">(Live Duplication Check)</span>
                </label>
                <div className="h-28 w-full rounded border border-slate-200 bg-slate-50/60 p-2 overflow-y-auto text-xs font-mono custom-sidebar-scroll">
                  {similarNames.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 italic text-[11px]">
                      {formData.name.trim() || formData.phone.trim()
                        ? "No similar customer names found."
                        : "Type customer name or mobile above to inspect matches."}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {similarNames.map((s: any) => (
                        <div
                          key={s.id}
                          className="px-2 py-1 bg-white rounded border border-slate-200/90 hover:border-purple-200 flex items-center justify-between text-[11px] transition-colors"
                        >
                          <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0 text-slate-500 font-mono text-[10px]">
                            <span>{s.phone}</span>
                            <span className="bg-purple-50 text-[#5e2b9d] px-1.5 py-0.5 rounded font-bold">
                              {s.customerCode}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Group */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Group
                </label>
                <div className="sm:col-span-8">
                  <select
                    value={formData.customerGroup}
                    onChange={(e) => handleChange("customerGroup", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none cursor-pointer"
                  >
                    {CUSTOMER_GROUPS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Classification
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    value={formData.classification}
                    onChange={(e) => handleChange("classification", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                    placeholder="General, Premium, Corporate"
                  />
                </div>
              </div>

              {/* LandLine */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  LandLine
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    value={formData.landline}
                    onChange={(e) => handleChange("landline", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                    placeholder="0866-245678"
                  />
                </div>
              </div>

              {/* Bill Cycle & Op Sales */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Bill Cycle
                </label>
                <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <input
                      type="number"
                      min={1}
                      value={formData.billCycle}
                      onChange={(e) => handleChange("billCycle", e.target.value)}
                      className="w-full h-8 px-2 text-center text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                    />
                  </div>
                  <div className="sm:col-span-8 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Op Sales</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.opSales}
                      onChange={(e) => handleChange("opSales", e.target.value)}
                      className="w-full h-8 px-2 text-right text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                      placeholder="₹0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Remarks
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                    placeholder="Customer notes, references, preferences"
                  />
                </div>
              </div>

              {/* GST No */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  GST No
                </label>
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstNumber}
                    onChange={(e) => handleChange("gstNumber", e.target.value.toUpperCase())}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono font-semibold"
                    placeholder="37AAAAA0000A1Z5"
                  />
                </div>
              </div>

              {/* Pl Of Supp (Place of Supply) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Pl Of Supp
                </label>
                <div className="sm:col-span-8">
                  <select
                    value={formData.placeOfSupply}
                    onChange={(e) => handleChange("placeOfSupply", e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none cursor-pointer"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Disc % & Apply Discount on Non-Disc Items */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-xs font-semibold text-slate-700">
                  Disc %
                </label>
                <div className="sm:col-span-8 flex items-center gap-3">
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={formData.discountPercent}
                      onChange={(e) => handleChange("discountPercent", e.target.value)}
                      className="w-full h-8 px-2 text-right text-xs bg-white border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <label className="text-[11.5px] font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applyDiscountNonDisc}
                      onChange={(e) => handleChange("applyDiscountNonDisc", e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#5e2b9d] rounded cursor-pointer"
                    />
                    <span>Apply Discount on Non-Disc Items</span>
                  </label>
                </div>
              </div>

              {/* Status & Notification Preference Checkboxes */}
              <div className="pt-2">
                <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Preferences & Communication Restrictions
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isInactive}
                        onChange={(e) => handleChange("isInactive", e.target.checked)}
                        className="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer"
                      />
                      <span className={formData.isInactive ? "text-rose-600 font-bold" : "text-slate-700"}>
                        Inactive
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.blockTSms}
                        onChange={(e) => handleChange("blockTSms", e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                      />
                      <span className="text-slate-700">Block T-SMS</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.blockPSms}
                        onChange={(e) => handleChange("blockPSms", e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                      />
                      <span className="text-slate-700">Block P-SMS</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.blockWa}
                        onChange={(e) => handleChange("blockWa", e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                      />
                      <span className="text-slate-700">Block WA</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={formData.dontFollowup}
                        onChange={(e) => handleChange("dontFollowup", e.target.checked)}
                        className="w-3.5 h-3.5 accent-slate-600 rounded cursor-pointer"
                      />
                      <span className="text-slate-700">Dont Followup</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

          </form>
        </div>

        {/* Bottom Action Footer Bar */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Branch: <b className="text-slate-700">{formData.branch}</b>
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline">Terminal: 01</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Green Save Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit()}
              className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Spinner className="w-3.5 h-3.5 text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save</span>
                </>
              )}
            </button>

            {/* Red Close Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
