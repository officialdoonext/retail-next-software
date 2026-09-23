"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { SAMPLE_50_EMPLOYEES } from "@/lib/sampleEmployees";

interface BulkUploadEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function getFirstLetter(name: string): string {
  const clean = name.trim();
  return clean ? clean.charAt(0).toUpperCase() : "E";
}

export function getFirstLetterColor(letter: string): string {
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

export default function BulkUploadEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUploadEmployeeModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedEmployees, setParsedEmployees] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  // 1. Download 50 Sample Employees Excel (.xlsx)
  const handleDownloadSampleExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_50_EMPLOYEES);

      // Auto-fit column widths
      ws["!cols"] = [
        { wch: 25 }, // Employee Name
        { wch: 16 }, // Mobile Number
        { wch: 18 }, // City
        { wch: 45 }, // Full Address
        { wch: 30 }, // Email
        { wch: 14 }, // Salary Type
        { wch: 20 }, // Salary Amount (INR)
        { wch: 16 }, // Accepted Leaves
        { wch: 25 }, // Emergency Contact Name
        { wch: 24 }, // Emergency Contact Relation
        { wch: 24 }, // Emergency Contact Number
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");

      XLSX.writeFile(wb, "RetailNext_Sample_50_Employees.xlsx");
      toast.success("Sample Excel with 50 employees downloaded!");
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
          setParsedEmployees([]);
          setIsParsing(false);
          return;
        }

        const validRows = jsonData.filter((row) => {
          const name = String(row["Employee Name"] || row.Name || row.name || "").trim();
          const mobile = String(row["Mobile Number"] || row.Mobile || row.mobile || "").replace(/\D/g, "");
          return name.length > 0 && mobile.length >= 10;
        });

        if (validRows.length === 0) {
          setErrorMsg("No valid employee rows found. Please check columns: 'Employee Name' and 'Mobile Number'.");
        }

        setParsedEmployees(validRows);
      } catch (err: any) {
        console.error("Error parsing Excel:", err);
        setErrorMsg("Failed to parse file. Please upload a valid .xlsx or .xls file.");
        setParsedEmployees([]);
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // 3. Submit bulk upload to /api/employees/bulk
  const handleUploadSubmit = async () => {
    if (parsedEmployees.length === 0) {
      toast.error("No valid employees to upload.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: parsedEmployees }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload employees.");
      }

      toast.success(
        `Successfully imported ${data.count} employees with unique 7-digit IDs & QR codes!`
      );
      if (data.skippedCount > 0) {
        toast.info(`${data.skippedCount} duplicate employees skipped.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      setErrorMsg(err.message || "Network error during bulk employee upload.");
      toast.error(err.message || "Failed to complete bulk upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] border border-slate-200/80 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="h-[56px] bg-[#f8fafc] border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-medium text-slate-900">Bulk Upload Employees</h2>
              <p className="text-[11px] text-slate-500">Auto 7-digit IDs, first letter identification, &amp; ImageKit QR codes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Download Sample Excel */}
          <div className="p-4 rounded-[8px] bg-gradient-to-r from-purple-50/70 via-slate-50 to-indigo-50/50 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">1</span>
                <h4 className="text-xs font-medium text-slate-900">Need a template with pre-filled data?</h4>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1 max-w-xl">
                Download the sample Excel template containing <strong>50 realistic employee records</strong> with roles, salaries, cities, and emergency contacts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="h-[34px] px-3.5 bg-white hover:bg-purple-50 text-[#5e2b9d] border border-purple-200 rounded-[6px] text-xs font-medium flex items-center gap-2 cursor-pointer shadow-2xs transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample Excel (50 Employees)
            </button>
          </div>

          {/* Step 2: Upload Excel File */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">2</span>
              <h4 className="text-xs font-medium text-slate-900">Upload your Excel or CSV spreadsheet</h4>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[8px] p-6 text-center cursor-pointer transition-all ${
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
                  <p className="text-xs font-medium text-emerald-700">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    <span className="text-[#5e2b9d] font-medium">Click to upload</span> or drag and drop your spreadsheet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Supported formats: .XLSX, .XLS, or .CSV</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Parsed Preview */}
          {isParsing ? (
            <div className="p-8 text-center bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Reading and validating employee rows...</p>
            </div>
          ) : parsedEmployees.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#5e2b9d] text-white text-[10px] font-medium flex items-center justify-center">3</span>
                  <h4 className="text-xs font-medium text-slate-900">
                    Preview: {parsedEmployees.length} Valid Employee Records
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing first {Math.min(parsedEmployees.length, 10)} of {parsedEmployees.length} rows
                </span>
              </div>

              <div className="border border-slate-200 rounded-[6px] overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Avatar</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Mobile</th>
                      <th className="py-2 px-3">City</th>
                      <th className="py-2 px-3">Salary</th>
                      <th className="py-2 px-3">Accepted Leaves</th>
                      <th className="py-2 px-3">Emergency Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedEmployees.slice(0, 10).map((row, idx) => {
                      const name = String(row["Employee Name"] || row.Name || row.name || "");
                      const mobile = String(row["Mobile Number"] || row.Mobile || row.mobile || "");
                      const city = String(row.City || row.city || "—");
                      const salaryType = String(row["Salary Type"] || row.salaryType || "Monthly");
                      const salaryAmount = Number(row["Salary Amount (INR)"] || row.salaryAmount || row.salary || 0);
                      const acceptedLeaves = Number(row["Accepted Leaves"] ?? row.acceptedLeaves ?? 0);
                      const ecName = String(row["Emergency Contact Name"] || row.emergencyName || "—");
                      const letter = getFirstLetter(name);
                      const colorCls = getFirstLetterColor(letter);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3">
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-medium ${colorCls}`}>
                              {letter}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">{name}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{mobile}</td>
                          <td className="py-2 px-3 text-slate-600">{city}</td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-900">₹{salaryAmount.toLocaleString("en-IN")}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({salaryType})</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-mono text-[11px] font-medium">
                              {acceptedLeaves} {acceptedLeaves === 1 ? "day" : "days"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{ecName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-purple-50/60 rounded-[6px] border border-purple-100 flex items-start gap-2 text-xs text-purple-900">
                <svg className="w-4 h-4 text-[#5e2b9d] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Automatic features enabled:</strong> Unique 7-digit numeric Employee IDs will be automatically assigned to all rows, high-resolution QR codes will be generated and uploaded to ImageKit (&le; 60KB), and first-letter avatars will be used for identification.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="h-[56px] bg-[#f8fafc] border-t border-slate-200 px-6 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={parsedEmployees.length === 0 || isUploading || isParsing}
            className="h-[34px] px-5 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing Employees ({parsedEmployees.length})...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Import {parsedEmployees.length > 0 ? `${parsedEmployees.length} Employees` : "Employees"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
