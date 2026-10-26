"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { SAMPLE_80_CUSTOMERS } from "@/lib/sampleCustomers";
import { Spinner } from "@/components/ui/spinner";

interface BulkUploadCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function getCustomerFirstLetter(name: string): string {
  const clean = name.trim();
  return clean ? clean.charAt(0).toUpperCase() : "C";
}

export function getCustomerLetterColor(letter: string): string {
  const code = letter.charCodeAt(0) % 8;
  switch (code) {
    case 0: return "bg-purple-100 text-[#5e2b9d] border-purple-200";
    case 1: return "bg-blue-100 text-blue-700 border-blue-200";
    case 2: return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case 3: return "bg-amber-100 text-amber-700 border-amber-200";
    case 4: return "bg-rose-100 text-rose-700 border-rose-200";
    case 5: return "bg-teal-100 text-teal-700 border-teal-200";
    case 6: return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case 7: return "bg-cyan-100 text-cyan-700 border-cyan-200";
    default: return "bg-purple-100 text-[#5e2b9d] border-purple-200";
  }
}

export default function BulkUploadCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUploadCustomerModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  // 1. Download 80 Sample Customers Excel (.xlsx)
  const handleDownloadSampleExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_80_CUSTOMERS);

      // Auto-fit column widths
      ws["!cols"] = [
        { wch: 24 }, // Customer Name
        { wch: 16 }, // Mobile Number
        { wch: 28 }, // Email
        { wch: 16 }, // City
        { wch: 45 }, // Full Address
        { wch: 10 }, // PIN
        { wch: 16 }, // Customer Group
        { wch: 16 }, // Credit Limit
        { wch: 14 }, // Credit Days
        { wch: 20 }, // GST Number
        { wch: 22 }, // Place of Supply
        { wch: 14 }, // Discount %
        { wch: 30 }, // Remarks
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");

      XLSX.writeFile(wb, "RetailNext_Sample_80_Customers.xlsx");
      toast.success("Sample Excel with 80 customers downloaded!");
    } catch (err) {
      console.error("Excel download error:", err);
      toast.error("Failed to generate sample Excel file.");
    }
  };

  // 2. Parse uploaded file
  const processFile = (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!jsonData || jsonData.length === 0) {
          setErrorMsg("The selected Excel file contains no readable rows.");
          setParsedCustomers([]);
          setIsParsing(false);
          return;
        }

        const validRows = jsonData.filter((row) => {
          const name = String(row["Customer Name"] || row.Name || row.name || "").trim();
          const mobile = String(row["Mobile Number"] || row.Mobile || row.mobile || row.Phone || row.phone || "").replace(/\D/g, "");
          return name.length > 0 && mobile.length >= 10;
        });

        if (validRows.length === 0) {
          setErrorMsg("No valid customer rows found. Please ensure 'Customer Name' and 'Mobile Number' columns exist.");
        }

        setParsedCustomers(validRows);
      } catch (err: any) {
        console.error("Error parsing Excel:", err);
        setErrorMsg("Failed to parse file. Please upload a valid .xlsx or .xls file.");
        setParsedCustomers([]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("Failed to read the file.");
      setIsParsing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // 3. Upload parsed rows to backend API
  const handleBulkUpload = async () => {
    if (parsedCustomers.length === 0) {
      toast.error("Please select an Excel file containing valid customer rows.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg("");

      const res = await fetch("/api/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: parsedCustomers }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process bulk upload.");
      }

      let msg = `Successfully uploaded ${data.count} customers!`;
      if (data.skippedCount > 0) {
        msg += ` (${data.skippedCount} duplicates skipped)`;
      }

      toast.success(msg);
      onSuccess();
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      setErrorMsg(err?.message || "An unexpected error occurred during upload.");
      toast.error(err?.message || "Bulk customer upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setParsedCustomers([]);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-white stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Bulk Upload Customers</h3>
              <p className="text-[11px] text-purple-200">
                Import multiple retail client records quickly via Excel or CSV spreadsheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Step 1: Download Sample Excel */}
          <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">1</span>
                <h4 className="text-xs font-semibold text-slate-900">Need a template with pre-filled dummy data?</h4>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1 max-w-xl">
                Download the sample Excel template containing <strong>80 realistic customer records</strong> with cities, credit limits, groups, GST numbers, and contact details. Customer codes are auto-generated.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="h-[34px] px-3.5 bg-white hover:bg-purple-50 text-[#5e2b9d] border border-purple-200 rounded-[6px] text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample Excel (80 Customers)
            </button>
          </div>

          {/* Step 2: Upload Excel File */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">2</span>
              <h4 className="text-xs font-semibold text-slate-900">Upload your Excel or CSV spreadsheet</h4>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-[#5e2b9d] bg-purple-50/50"
                  : selectedFile
                  ? "border-emerald-400 bg-emerald-50/30"
                  : "border-slate-300 hover:border-[#5e2b9d]/60 bg-[#f8fafc]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-xs font-semibold text-emerald-700">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    <span className="text-[#5e2b9d] font-semibold">Click to upload</span> or drag and drop your spreadsheet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Supported formats: .XLSX, .XLS, or .CSV</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Parsed Preview */}
          {isParsing ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
              <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
              <p className="text-xs text-slate-500">Reading and validating customer rows...</p>
            </div>
          ) : parsedCustomers.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">3</span>
                  <h4 className="text-xs font-semibold text-slate-900">
                    Preview: {parsedCustomers.length} Valid Customer Records
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing first {Math.min(parsedCustomers.length, 10)} of {parsedCustomers.length} rows
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Avatar</th>
                      <th className="py-2 px-3">Customer Name</th>
                      <th className="py-2 px-3">Mobile Number</th>
                      <th className="py-2 px-3">City</th>
                      <th className="py-2 px-3">Group</th>
                      <th className="py-2 px-3">Credit Limit</th>
                      <th className="py-2 px-3">Credit Days</th>
                      <th className="py-2 px-3">Place of Supply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedCustomers.slice(0, 10).map((row, idx) => {
                      const name = String(row["Customer Name"] || row.Name || row.name || "");
                      const mobile = String(row["Mobile Number"] || row.Mobile || row.mobile || row.Phone || row.phone || "");
                      const city = String(row.City || row.city || "—");
                      const group = String(row["Customer Group"] || row.customerGroup || row.group || "Retail");
                      const creditLimit = Number(row["Credit Limit"] || row.creditLimit || 0);
                      const creditDays = Number(row["Credit Days"] || row.creditDays || 0);
                      const placeOfSupply = String(row["Place of Supply"] || row.placeOfSupply || "37-Andhra Pradesh");

                      const firstLetter = getCustomerFirstLetter(name);
                      const letterColor = getCustomerLetterColor(firstLetter);

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs ${letterColor}`}>
                              {firstLetter}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{name}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{mobile}</td>
                          <td className="py-2 px-3 text-slate-600">{city}</td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-[#5e2b9d] border border-purple-200">
                              {group}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-800">
                            {creditLimit > 0 ? `₹${creditLimit.toLocaleString("en-IN")}` : "₹0"}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{creditDays > 0 ? `${creditDays} Days` : "0 Days"}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[140px]">{placeOfSupply}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Information / Guidelines */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11.5px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Helpful guidelines for bulk customer upload:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Customer codes are automatically generated with format (e.g. <code>MC1001</code>) and are uniquely tracked.</li>
              <li>Mobile numbers must be at least 10 digits; existing phone numbers in your business directory will be safely deduplicated.</li>
              <li>Credit limits, credit days, GST number, discount percentage, and remarks will be preserved in client profiles.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={resetSelection}
            disabled={isUploading || (!selectedFile && parsedCustomers.length === 0)}
            className="text-xs text-slate-600 hover:text-slate-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Clear Selection
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkUpload}
              disabled={isUploading || parsedCustomers.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-[#5e2b9d] to-purple-700 hover:from-purple-700 hover:to-[#5e2b9d] text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Spinner className="w-3.5 h-3.5 text-white" />
                  <span>Uploading {parsedCustomers.length} Customers...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload {parsedCustomers.length > 0 ? `${parsedCustomers.length} Customers` : "Customers"}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
