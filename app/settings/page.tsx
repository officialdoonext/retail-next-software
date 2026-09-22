"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";

interface StoreSettings {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  businessType: string;
  code?: string;
  license?: string;
  logoUrl: string;

  // GST Configuration
  enableGst: boolean;
  gstNumber: string;
  isPriceInclusiveGst: boolean;
  cgstPercent: number;
  sgstPercent: number;
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Chandigarh",
  "Puducherry",
];

const GST_PRESETS = [
  { label: "0% GST", cgst: 0, sgst: 0, desc: "Exempted / Zero Tax" },
  { label: "5% GST", cgst: 2.5, sgst: 2.5, desc: "Essential items" },
  { label: "12% GST", cgst: 6, sgst: 6, desc: "Processed foods / items" },
  { label: "18% GST", cgst: 9, sgst: 9, desc: "Standard goods / services" },
  { label: "28% GST", cgst: 14, sgst: 14, desc: "Luxury / Automotive items" },
];

export default function SettingsPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [businessType, setBusinessType] = useState("Supermarket / Grocery");
  const [code, setCode] = useState("");
  const [license, setLicense] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // GST State
  const [enableGst, setEnableGst] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [isPriceInclusiveGst, setIsPriceInclusiveGst] = useState(true);
  const [cgstPercent, setCgstPercent] = useState<number | "">(9);
  const [sgstPercent, setSgstPercent] = useState<number | "">(9);

  // Original snapshot for reset
  const [initialData, setInitialData] = useState<StoreSettings | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();

        if (res.ok && data.success && data.settings) {
          const s = data.settings;
          setName(s.name || "");
          setPhone(s.phone || "");
          setEmail(s.email || "");
          setAddress(s.address || "");
          setCity(s.city || "");
          setState(s.state || "");
          setPincode(s.pincode || "");
          setBusinessType(s.businessType || "Supermarket / Grocery");
          setCode(s.code || "");
          setLicense(s.license || "");
          setLogoUrl(s.logoUrl || "");

          setEnableGst(Boolean(s.enableGst));
          setGstNumber(s.gstNumber || "");
          setIsPriceInclusiveGst(Boolean(s.isPriceInclusiveGst));
          setCgstPercent(typeof s.cgstPercent === "number" ? s.cgstPercent : 9);
          setSgstPercent(typeof s.sgstPercent === "number" ? s.sgstPercent : 9);

          setInitialData(s);
        } else {
          toast.error(data.error || "Failed to load store settings.");
        }
      } catch {
        toast.error("Network error while loading settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [toast]);

  // Handle Logo Upload to ImageKit
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (under 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size should be less than 5MB.");
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "branding");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to upload logo to ImageKit.");
      } else {
        setLogoUrl(data.url);
        toast.success("Business logo uploaded to ImageKit successfully!");
      }
    } catch {
      toast.error("Network error while uploading logo to ImageKit.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Revert changes to initial state
  const handleReset = () => {
    if (!initialData) return;
    setName(initialData.name || "");
    setPhone(initialData.phone || "");
    setEmail(initialData.email || "");
    setAddress(initialData.address || "");
    setCity(initialData.city || "");
    setState(initialData.state || "");
    setPincode(initialData.pincode || "");
    setBusinessType(initialData.businessType || "Supermarket / Grocery");
    setLicense(initialData.license || "");
    setLogoUrl(initialData.logoUrl || "");
    setEnableGst(Boolean(initialData.enableGst));
    setGstNumber(initialData.gstNumber || "");
    setIsPriceInclusiveGst(Boolean(initialData.isPriceInclusiveGst));
    setCgstPercent(initialData.cgstPercent ?? 9);
    setSgstPercent(initialData.sgstPercent ?? 9);
    toast.info("Changes have been reset.");
  };

  // Save Settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Business / Store Name is required.");
      return;
    }

    if (enableGst) {
      const cleanGst = gstNumber.trim();
      if (!cleanGst) {
        toast.error("GST Number is required when GST is enabled.");
        return;
      }

      if (cleanGst.length < 10) {
        toast.warning("GSTIN is typically a 15-character alphanumeric number.");
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        businessType: businessType.trim(),
        license: license.trim(),
        logoUrl: logoUrl.trim(),

        enableGst,
        gstNumber: gstNumber.trim().toUpperCase(),
        isPriceInclusiveGst: enableGst ? isPriceInclusiveGst : false,
        cgstPercent: enableGst ? Number(cgstPercent) || 0 : 0,
        sgstPercent: enableGst ? Number(sgstPercent) || 0 : 0,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update settings.");
      } else {
        toast.success("Settings saved successfully!");
        setInitialData({ ...payload, code });
      }
    } catch {
      toast.error("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const totalGstPercent =
    enableGst ? (Number(cgstPercent) || 0) + (Number(sgstPercent) || 0) : 0;

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Dedicated Page Header with Compact Spacing like Categories */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Store Settings
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {code || "Active Store"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage your business profile, official GST details, tax percentages, and store branding.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="h-[34px] max-h-[34px] px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-normal">Loading store settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* 1. BUSINESS DETAILS & BRANDING */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-[#f8fafc] border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.651V9.35m0 0a3.001 3.001 0 003.75-.614A2.993 2.993 0 009 9.35c.83 0 1.61-.336 2.18-.89a3 3 0 004.64 0c.57.554 1.35.89 2.18.89 1.178 0 2.21-.684 2.72-1.688m-17.04 1.077L12 3l8.72 6.427" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xs font-medium text-slate-900">
                      Business Details & Store Branding
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Information displayed on checkout receipts, invoices, and customer communications.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Store Logo Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 rounded-[6px] border border-slate-200 bg-[#f8fafc] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt="Store Logo"
                          width={64}
                          height={64}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <svg className="w-6 h-6 mx-auto stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-[9px] block text-slate-400 font-normal">No Logo</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="h-[34px] max-h-[34px] px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-[6px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                        >
                          {uploadingLogo ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-slate-500 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                              </svg>
                              <span>{logoUrl ? "Change Logo" : "Upload Store Logo"}</span>
                            </>
                          )}
                        </button>

                        {logoUrl && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-[4px]">
                              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>ImageKit Hosted</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setLogoUrl("")}
                              className="h-[34px] max-h-[34px] px-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-normal">
                        PNG, JPG, or SVG. Uploaded directly to ImageKit cloud and saved to your store.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Business Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Business / Store Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Retail Next Supermart"
                      required
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* Business Type */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Business Type / Industry
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
                    >
                      <option value="Supermarket / Grocery">Supermarket / Grocery</option>
                      <option value="Apparel / Fashion">Apparel / Fashion</option>
                      <option value="Electronics & Appliances">Electronics & Appliances</option>
                      <option value="Pharmacy / Healthcare">Pharmacy / Healthcare</option>
                      <option value="Bakery / Cafe">Bakery / Cafe</option>
                      <option value="Departmental Store">Departmental Store</option>
                      <option value="General Retail">General Retail</option>
                    </select>
                  </div>

                  {/* Store Phone */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* Business Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@store.com"
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* Business License */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Trade License / Registration No.
                    </label>
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="e.g. RET-TS-2024-8841"
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* Store Code (Readonly) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Store Unique Code
                    </label>
                    <input
                      type="text"
                      value={code}
                      disabled
                      className="w-full h-[34px] max-h-[34px] px-3 bg-slate-100 border border-slate-200 rounded-[6px] text-xs font-mono font-medium text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  {/* Full Address */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Store Address / Location
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Shop No. 12, Ground Floor, Central Mall, Commercial Street"
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* City */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Hyderabad"
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>

                  {/* State */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      State / UT
                    </label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* PIN Code */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="500001"
                      maxLength={6}
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. GST & TAX DETAILS */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-[#f8fafc] border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xs font-medium text-slate-900">
                      GST & Tax Configuration
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Configure Goods and Services Tax (GST), tax percentages, and price inclusiveness.
                    </p>
                  </div>
                </div>

                {/* Enable GST Toggle */}
                <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-[6px] px-3 py-1 shadow-2xs">
                  <span className="text-xs font-medium text-slate-800">
                    Enable GST
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableGst(!enableGst)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      enableGst ? "bg-[#5e2b9d]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        enableGst ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {!enableGst ? (
                  <div className="p-6 text-center bg-[#f8fafc] border border-dashed border-slate-200 rounded-[6px]">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                      <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-medium text-slate-800 mb-0.5">
                      GST Billing is Currently Disabled
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal max-w-md mx-auto mb-3">
                      Turn on the &quot;Enable GST&quot; toggle switch above to enter your GST Number, choose whether product prices include GST, and set your CGST & SGST percentage rates.
                    </p>
                    <button
                      type="button"
                      onClick={() => setEnableGst(true)}
                      className="h-[34px] max-h-[34px] px-3.5 bg-white hover:bg-purple-50 text-[#5e2b9d] border border-[#5e2b9d]/40 text-xs font-medium rounded-[6px] transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>Enable GST Configuration</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* GSTIN and Price Inclusiveness */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* GST Number */}
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700">
                          GST Identification Number (GSTIN) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                            placeholder="e.g. 36AABCU9603R1ZM"
                            maxLength={15}
                            required={enableGst}
                            className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-mono font-medium tracking-wide text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] uppercase"
                          />
                        </div>
                        <p className="text-[10.5px] text-slate-400 font-normal">
                          15-digit alphanumeric GSTIN. Printed on tax invoices & receipts.
                        </p>
                      </div>

                      {/* Inclusive vs Exclusive Price Selection */}
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700">
                          GST Price Treatment (Inclusive or Exclusive)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setIsPriceInclusiveGst(true)}
                            className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isPriceInclusiveGst
                                ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] shadow-2xs font-medium"
                                : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isPriceInclusiveGst ? "bg-[#5e2b9d]" : "border border-slate-400"}`} />
                            <span>Inclusive in Prices</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsPriceInclusiveGst(false)}
                            className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              !isPriceInclusiveGst
                                ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] shadow-2xs font-medium"
                                : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${!isPriceInclusiveGst ? "bg-[#5e2b9d]" : "border border-slate-400"}`} />
                            <span>Exclusive of Prices</span>
                          </button>
                        </div>
                        <p className="text-[10.5px] text-slate-400 font-normal">
                          {isPriceInclusiveGst
                            ? "Product prices already include GST. Tax is extracted during billing."
                            : "Product prices are net. GST is added on top during billing."}
                        </p>
                      </div>
                    </div>

                    {/* CGST & SGST Percentages */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-medium text-slate-800">
                            GST Tax Percentages (CGST & SGST)
                          </h3>
                          <p className="text-[11px] text-slate-500 font-normal">
                            In intra-state trade, GST is divided equally into CGST (Central) and SGST (State).
                          </p>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] text-slate-400 font-medium mr-1">Presets:</span>
                          {GST_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setCgstPercent(preset.cgst);
                                setSgstPercent(preset.sgst);
                                toast.info(`Applied ${preset.label} (${preset.cgst}% CGST + ${preset.sgst}% SGST)`);
                              }}
                              className="h-[26px] px-2 rounded-[4px] bg-slate-100 hover:bg-purple-100 hover:text-[#5e2b9d] border border-slate-200 text-[10.5px] font-medium text-slate-700 transition-colors cursor-pointer"
                              title={preset.desc}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* CGST Percentage */}
                        <div className="space-y-1 bg-[#f8fafc] border border-slate-200 rounded-[6px] p-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800">
                              CGST Percentage (%)
                            </label>
                            <span className="text-[10px] font-medium text-[#5e2b9d] bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/80">
                              Central Tax
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="50"
                              value={cgstPercent}
                              onChange={(e) => setCgstPercent(e.target.value === "" ? "" : Number(e.target.value))}
                              onWheel={(e) => e.currentTarget.blur()}
                              placeholder="9"
                              className="w-full h-[34px] max-h-[34px] px-3 pr-8 bg-white border border-slate-200 rounded-[6px] text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                              %
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 font-normal">
                            Central GST rate levied on taxable value.
                          </p>
                        </div>

                        {/* SGST Percentage */}
                        <div className="space-y-1 bg-[#f8fafc] border border-slate-200 rounded-[6px] p-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800">
                              SGST Percentage (%)
                            </label>
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/80">
                              State Tax
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="50"
                              value={sgstPercent}
                              onChange={(e) => setSgstPercent(e.target.value === "" ? "" : Number(e.target.value))}
                              onWheel={(e) => e.currentTarget.blur()}
                              placeholder="9"
                              className="w-full h-[34px] max-h-[34px] px-3 pr-8 bg-white border border-slate-200 rounded-[6px] text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                              %
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 font-normal">
                            State GST rate levied on taxable value.
                          </p>
                        </div>
                      </div>

                      {/* Live Tax Calculation Summary Card */}
                      <div className="bg-purple-50/60 border border-purple-200/80 rounded-[6px] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#5e2b9d]" />
                          <span className="text-xs font-medium text-slate-800">
                            Effective Total GST Rate:
                          </span>
                          <span className="text-xs font-bold text-[#5e2b9d]">
                            {totalGstPercent}%
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            ({Number(cgstPercent) || 0}% CGST + {Number(sgstPercent) || 0}% SGST)
                          </span>
                        </div>

                        <span className="text-[10.5px] font-medium text-slate-600 bg-white border border-purple-200 px-2 py-0.5 rounded-[4px]">
                          Billing Mode: {isPriceInclusiveGst ? "Tax Inclusive" : "Tax Exclusive"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Floating Save Button Bar */}
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
                <svg className="w-4 h-4 text-emerald-600 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Store ID: <span className="font-mono text-slate-700">{code || initialData?.id || "Active"}</span></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving || loading}
                  className="h-[34px] max-h-[34px] px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>Save Settings</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </SoftwareLayout>
  );
}
