"use client";

import React, { useState, useEffect, useRef } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";

type SettingsTab = "profile" | "billing" | "tax" | "hardware";

export default function SettingsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Profile Fields
  const [businessName, setBusinessName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  // Logo & ImageKit
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Billing & Invoice Settings
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [thermalReceiptFooter, setThermalReceiptFooter] = useState(
    "Thank you for shopping with us! Visit again."
  );
  const [enableRoundOff, setEnableRoundOff] = useState(true);

  // Tax Settings
  const [enableGst, setEnableGst] = useState(true);
  const [isPriceInclusiveGst, setIsPriceInclusiveGst] = useState(true);
  const [cgstPercent, setCgstPercent] = useState<number>(9);
  const [sgstPercent, setSgstPercent] = useState<number>(9);

  // Hardware
  const [printerPaperSize, setPrinterPaperSize] = useState("80mm");

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            const s = data.settings;
            setBusinessName(s.name || "");
            setMobileNumber(s.mobileNumber || s.phone || "");
            setEmail(s.email || "");
            setAddress(s.address || "");
            setCity(s.city || "");
            setState(s.state || "");
            setPincode(s.pincode || "");
            setGstNumber(s.gstNumber || "");

            setLogoUrl(s.logoUrl || "");
            setLogoPreviewUrl(s.logoUrl || "");

            setInvoicePrefix(s.invoicePrefix || "INV");
            setThermalReceiptFooter(
              s.thermalReceiptFooter || "Thank you for shopping with us! Visit again."
            );
            setEnableRoundOff(s.enableRoundOff !== undefined ? Boolean(s.enableRoundOff) : true);

            setEnableGst(Boolean(s.enableGst ?? Boolean(s.gstNumber)));
            setIsPriceInclusiveGst(
              s.isPriceInclusiveGst !== undefined ? Boolean(s.isPriceInclusiveGst) : true
            );
            setCgstPercent(typeof s.cgstPercent === "number" ? s.cgstPercent : 9);
            setSgstPercent(typeof s.sgstPercent === "number" ? s.sgstPercent : 9);
            setPrinterPaperSize(s.printerPaperSize || "80mm");
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load business settings.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Handle local image file selection
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size must be less than 5MB.");
      return;
    }

    setSelectedLogoFile(file);
    const localUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(localUrl);
    toast.info("Logo selected! Click 'Save Settings' to upload to ImageKit.");
  };

  const handleRemoveLogo = () => {
    setSelectedLogoFile(null);
    setLogoPreviewUrl("");
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Logo removed.");
  };

  // Save Settings handler
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!businessName.trim()) {
      toast.error("Business name is required.");
      return;
    }

    try {
      setSaving(true);
      let finalLogoUrl = logoUrl;

      // 1. If user selected a new logo image, upload to ImageKit FIRST
      if (selectedLogoFile) {
        try {
          setUploadingLogo(true);
          toast.info("Uploading business logo to ImageKit...");

          const uploadFormData = new FormData();
          uploadFormData.append("file", selectedLogoFile);
          uploadFormData.append("folder", "business");

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadFormData,
          });

          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.success || !uploadJson.url) {
            throw new Error(uploadJson.error || "ImageKit upload failed.");
          }

          finalLogoUrl = uploadJson.url;
          setLogoUrl(finalLogoUrl);
          setLogoPreviewUrl(finalLogoUrl);
          setSelectedLogoFile(null);
          toast.success("Logo uploaded to ImageKit successfully!");
        } catch (upErr: any) {
          console.error("ImageKit upload error:", upErr);
          toast.error(upErr?.message || "Failed to upload logo to ImageKit.");
          setSaving(false);
          setUploadingLogo(false);
          return;
        } finally {
          setUploadingLogo(false);
        }
      }

      // 2. Save complete settings payload
      const payload = {
        name: businessName.trim(),
        businessName: businessName.trim(),
        mobileNumber: mobileNumber.trim(),
        phone: mobileNumber.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        logoUrl: finalLogoUrl,

        invoicePrefix: invoicePrefix.trim(),
        thermalReceiptFooter: thermalReceiptFooter.trim(),
        enableRoundOff,

        enableGst,
        isPriceInclusiveGst,
        cgstPercent: Number(cgstPercent) || 0,
        sgstPercent: Number(sgstPercent) || 0,

        printerPaperSize,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings.");
      }

      toast.success("Business settings saved successfully!");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err?.message || "An error occurred while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="flex flex-col min-h-[calc(100vh-64px)] bg-[#f8fafc] text-slate-800 font-sans pb-16">
        
        {/* ==================================================================== */}
        {/* PAGE HEADER BAR                                                      */}
        {/* ==================================================================== */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs sticky top-0 z-20">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold shadow-inner">
                  ⚙️
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                    Settings & Configuration
                  </h1>
                  <p className="text-xs text-slate-500">
                    Manage business profile, ImageKit logo, tax registrations & billing preferences
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saving || loading}
                className="h-9 px-5 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0"
              >
                {saving ? (
                  <>
                    <Spinner className="w-3.5 h-3.5 text-white" />
                    <span>{uploadingLogo ? "Uploading to ImageKit..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* TAB NAVIGATION BAR                                                   */}
          {/* ==================================================================== */}
          <div className="w-full mt-4 -mb-4 flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "profile"
                  ? "text-[#5e2b9d] border-b-2 border-[#5e2b9d]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🏢</span>
              <span>Business Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tax")}
              className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "tax"
                  ? "text-[#5e2b9d] border-b-2 border-[#5e2b9d]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>⚖️</span>
              <span>GST & Taxation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "billing"
                  ? "text-[#5e2b9d] border-b-2 border-[#5e2b9d]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🧾</span>
              <span>Invoice & Receipt Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("hardware")}
              className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "hardware"
                  ? "text-[#5e2b9d] border-b-2 border-[#5e2b9d]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🖨️</span>
              <span>Thermal Printer</span>
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* MAIN SETTINGS CONTENT CONTAINER                                      */}
        {/* ==================================================================== */}
        <div className="w-full p-4 sm:p-6 flex-1">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Spinner className="w-8 h-8 text-[#5e2b9d]" />
              <p className="text-xs text-slate-400 font-medium">Loading configuration...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">

              {/* ============================================================== */}
              {/* TAB 1: BUSINESS PROFILE                                        */}
              {/* ============================================================== */}
              {activeTab === "profile" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Business Logo & Branding Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Business Logo & Branding
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mb-5">
                      Upload your official store logo. It will be uploaded to ImageKit on save and printed on thermal receipts, digital invoices, and customer receipts.
                    </p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      {/* Logo Preview Container */}
                      <div className="relative group shrink-0">
                        <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 flex items-center justify-center overflow-hidden transition-all shadow-inner">
                          {logoPreviewUrl ? (
                            <img
                              src={logoPreviewUrl}
                              alt="Business Logo"
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="text-center p-3 text-slate-400">
                              <span className="text-3xl block mb-1">🏪</span>
                              <span className="text-[10px] font-semibold text-purple-700 block">No Logo</span>
                            </div>
                          )}
                        </div>

                        {selectedLogoFile && (
                          <span className="absolute -top-2 -right-2 bg-amber-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                            Unsaved
                          </span>
                        )}
                      </div>

                      {/* File Controls */}
                      <div className="flex-1 space-y-2.5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                          onChange={handleLogoFileChange}
                          className="hidden"
                          id="business-logo-upload"
                        />

                        <div className="flex flex-wrap items-center gap-2.5">
                          <label
                            htmlFor="business-logo-upload"
                            className="h-8 px-4 bg-purple-50 hover:bg-purple-100 text-[#5e2b9d] border border-purple-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Choose Logo Image</span>
                          </label>

                          {logoPreviewUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="h-8 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                            >
                              Remove Logo
                            </button>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <p>• Supported formats: PNG, JPG, WEBP, SVG (Max 5MB).</p>
                          <p>• Images are automatically compressed to &le;60KB and hosted on ImageKit CDN for lightning-fast receipt loads.</p>
                          {logoUrl && !selectedLogoFile && (
                            <p className="text-emerald-600 font-mono text-[10.5px] truncate">
                              ✓ Active ImageKit URL: <a href={logoUrl} target="_blank" rel="noreferrer" className="underline">{logoUrl}</a>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Profile Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
                    <div className="border-b border-slate-100 pb-2">
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Business Credentials & Contact Info
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        These official details represent your store on tax invoices and receipts.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Business Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Business / Store Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            🏢
                          </div>
                          <input
                            type="text"
                            required
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g. Doonext Retail Private Limited"
                            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]/30"
                          />
                        </div>
                      </div>

                      {/* GST Number */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          GST Number (GSTIN) <span className="text-purple-600 font-normal">(Optional / Official)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            ⚖️
                          </div>
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                            placeholder="e.g. 36AABCU9603R1ZM"
                            maxLength={15}
                            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 uppercase tracking-wider focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]/30"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          15-digit alphanumeric Indian Goods and Services Tax Identification Number.
                        </span>
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs font-bold">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="9876543210"
                            className="w-full h-10 px-3 rounded-r-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]/30"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Official Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            ✉️
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="billing@doonext.com"
                            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]/30"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Full Address */}
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Business / Store Full Address
                      </label>
                      <textarea
                        rows={3}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Shop No. 4, Ground Floor, Royal Plaza, MG Road..."
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]/30"
                      />
                    </div>

                    {/* City, State, Pincode row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Vijayawada"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="e.g. Andhra Pradesh"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                          placeholder="520001"
                          maxLength={6}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Bottom Action */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 px-6 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {saving && <Spinner className="w-3.5 h-3.5 text-white" />}
                      <span>Save Business Profile</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: GST & TAXATION                                          */}
              {/* ============================================================== */}
              {activeTab === "tax" && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 pb-2">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      GST & Tax Configurations
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure default tax rates, GST inclusivity, and split breakdown percentages for billing.
                    </p>
                  </div>

                  {/* Enable GST Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-bold text-xs text-slate-900">Enable GST Compliance</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Calculate CGST and SGST on customer invoices and generate GST compliant tax breakdowns.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableGst}
                        onChange={(e) => setEnableGst(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5e2b9d]"></div>
                    </label>
                  </div>

                  {/* Tax Inclusivity Default */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="font-bold text-xs text-slate-900">Default Catalog Price Tax Mode</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPriceInclusiveGst(true)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isPriceInclusiveGst
                            ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs flex items-center justify-between">
                          <span>GST Inclusive (Default)</span>
                          {isPriceInclusiveGst && <span>✓</span>}
                        </div>
                        <p className="text-[10.5px] text-slate-500 font-normal mt-1">
                          Product prices already contain GST. The tax breakdown is reverse-calculated.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPriceInclusiveGst(false)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          !isPriceInclusiveGst
                            ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs flex items-center justify-between">
                          <span>GST Exclusive (+ GST Added)</span>
                          {!isPriceInclusiveGst && <span>✓</span>}
                        </div>
                        <p className="text-[10.5px] text-slate-500 font-normal mt-1">
                          GST percentage is added on top of the product base price at checkout.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Default Split Tax Rates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Default CGST Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={cgstPercent}
                        onChange={(e) => setCgstPercent(Number(e.target.value) || 0)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Default SGST Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={sgstPercent}
                        onChange={(e) => setSgstPercent(Number(e.target.value) || 0)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 px-6 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {saving && <Spinner className="w-3.5 h-3.5 text-white" />}
                      <span>Save Tax Settings</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: INVOICE & RECEIPT NOTES                                 */}
              {/* ============================================================== */}
              {activeTab === "billing" && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 pb-2">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Invoice & Thermal Receipt Customization
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Customize how customer receipts look, thermal printer footer notes, and rounding rules.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Invoice Serial Prefix
                      </label>
                      <input
                        type="text"
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. INV"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Will generate bill numbers like {invoicePrefix}-000101
                      </span>
                    </div>

                    {/* Enable Round Off */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 self-center">
                      <div>
                        <div className="font-bold text-xs text-slate-900">Auto Round-off Grand Total</div>
                        <div className="text-[10.5px] text-slate-400">Round final paise to nearest ₹1</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableRoundOff}
                          onChange={(e) => setEnableRoundOff(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5e2b9d]"></div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Thermal Receipt Footer Note
                    </label>
                    <textarea
                      rows={3}
                      value={thermalReceiptFooter}
                      onChange={(e) => setThermalReceiptFooter(e.target.value)}
                      placeholder="Thank you for shopping with us! Visit again. Exchange within 7 days with bill."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#5e2b9d]"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      This message prints at the bottom of all 80mm and 58mm thermal receipts.
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 px-6 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {saving && <Spinner className="w-3.5 h-3.5 text-white" />}
                      <span>Save Invoicing Settings</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 4: THERMAL PRINTER HARDWARE                                */}
              {/* ============================================================== */}
              {activeTab === "hardware" && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 pb-2">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Thermal Printer & POS Hardware
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure default paper roll size, auto-cutter commands, and WebUSB/Bluetooth printer connections.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPrinterPaperSize("80mm")}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        printerPaperSize === "80mm"
                          ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs flex items-center justify-between">
                        <span>80mm Wide Paper (Standard POS)</span>
                        {printerPaperSize === "80mm" && <span>✓</span>}
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-normal mt-1">
                        48 characters per line. Ideal for retail stores, supermarkets, and apparel shops.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrinterPaperSize("58mm")}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        printerPaperSize === "58mm"
                          ? "border-[#5e2b9d] bg-purple-50 text-[#5e2b9d] font-bold shadow-2xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs flex items-center justify-between">
                        <span>58mm Narrow Paper (Compact / Portable)</span>
                        {printerPaperSize === "58mm" && <span>✓</span>}
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-normal mt-1">
                        32 characters per line. Ideal for mobile handheld POS, cafes, and compact kiosks.
                      </p>
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 px-6 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {saving && <Spinner className="w-3.5 h-3.5 text-white" />}
                      <span>Save Hardware Settings</span>
                    </button>
                  </div>
                </div>
              )}

            </form>
          )}
        </div>

      </div>
    </SoftwareLayout>
  );
}
