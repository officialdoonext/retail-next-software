"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { SAMPLE_200_PRODUCTS } from "@/lib/sampleProducts";
import { SAMPLE_CLOTHING_PRODUCTS } from "@/lib/sampleClothingProducts";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedProduct {
  name: string;
  category: string;
  subCategory?: string;
  price: number;
  stock?: number;
  bufferStock: number;
  description: string;
  barcode: string;
  imageUrl: string;
  isDiscountAvailable?: boolean;
  discountType?: "PERCENTAGE" | "RUPEES";
  discountValue?: number;
  variationType?: string;
  variationValue?: string;
}

export default function BulkUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  // 1A. Download Groceries Sample Excel File (.xlsx) with 200+ Products
  const handleDownloadGroceriesExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_200_PRODUCTS);

      // Auto-fit column widths
      ws["!cols"] = [
        { wch: 38 }, // Product Name
        { wch: 18 }, // Category
        { wch: 10 }, // Price
        { wch: 14 }, // Buffer Stock
        { wch: 45 }, // Description
        { wch: 18 }, // Barcode (empty)
        { wch: 30 }, // Image URL (empty)
        { wch: 18 }, // Discount Available
        { wch: 14 }, // Discount Type
        { wch: 14 }, // Discount Value
        { wch: 16 }, // Variation Type (optional)
        { wch: 16 }, // Variation Value (optional)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Groceries Products");

      XLSX.writeFile(wb, "RetailNext_Sample_Groceries_200_Products.xlsx");
      toast.success("Groceries Sample Excel (200+ products) downloaded!");
    } catch (err) {
      console.error("Excel download error:", err);
      toast.error("Failed to generate groceries sample Excel file.");
    }
  };

  // 1B. Download Clothing & Apparel Sample Excel File (.xlsx)
  const handleDownloadClothingExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_CLOTHING_PRODUCTS);

      ws["!cols"] = [
        { wch: 44 }, // Product Name
        { wch: 16 }, // Category
        { wch: 18 }, // Sub Category
        { wch: 10 }, // Price
        { wch: 14 }, // Buffer Stock
        { wch: 55 }, // Description
        { wch: 18 }, // Barcode (empty)
        { wch: 30 }, // Image URL (empty)
        { wch: 18 }, // Discount Available
        { wch: 14 }, // Discount Type
        { wch: 14 }, // Discount Value
        { wch: 22 }, // Variation 1 (Color)
        { wch: 20 }, // Variation 2 (Size)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clothing Products");

      XLSX.writeFile(wb, "RetailNext_Sample_Clothing_Store_Products.xlsx");
      toast.success("Clothing Store Sample Excel (with Size/Color variants) downloaded!");
    } catch (err) {
      console.error("Excel download error:", err);
      toast.error("Failed to generate clothing sample Excel file.");
    }
  };

  // 2. Parse uploaded file (XLSX, XLS, CSV)
  const processFile = (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!jsonRows || jsonRows.length === 0) {
          toast.error("The selected file is empty or has no recognizable rows.");
          setParsedProducts([]);
          setIsParsing(false);
          return;
        }

        // Map and normalize fields
        const validList: ParsedProduct[] = [];

        jsonRows.forEach((row) => {
          const name = String(row["Product Name"] || row["name"] || row["Product"] || "").trim();
          if (!name) return; // skip rows without name

          const category = String(row["Category"] || row["category"] || "General").trim();
          const subCategory = String(
            row["Sub Category"] ||
            row["subCategory"] ||
            row["Subcategory"] ||
            row["Sub-Category"] ||
            ""
          ).trim();

          const price = Math.max(0, Number(row["Price"] || row["price"]) || 0);
          const stock = row["Stock"] !== undefined && row["Stock"] !== "" 
            ? Math.max(0, Number(row["Stock"]) || 0) 
            : (row["stock"] !== undefined && row["stock"] !== "" ? Math.max(0, Number(row["stock"]) || 0) : 0);
          const bufferStock = Math.max(0, Number(row["Buffer Stock"] || row["bufferStock"] || row["Buffer"]) || 0);
          const description = String(row["Description"] || row["description"] || "").trim();
          const barcode = String(row["Barcode"] || row["barcode"] || "").trim();
          const imageUrl = String(row["Image URL"] || row["imageUrl"] || row["Image"] || "").trim();

          // Discount fields parsing
          const discountAvailRaw = String(
            row["Discount Available"] ||
            row["discountAvailable"] ||
            row["isDiscountAvailable"] ||
            row["Discount"] ||
            ""
          ).trim().toLowerCase();
          const isDiscountAvailable = discountAvailRaw === "yes" || discountAvailRaw === "true" || discountAvailRaw === "1";

          const discountTypeRaw = String(
            row["Discount Type"] ||
            row["discountType"] ||
            ""
          ).trim().toUpperCase();
          const discountType = (discountTypeRaw.includes("RUPEE") || discountTypeRaw === "₹" || discountTypeRaw === "RS")
            ? ("RUPEES" as const)
            : ("PERCENTAGE" as const);

          const discountValue = Math.max(0, Number(
            row["Discount Value"] ||
            row["discountValue"] ||
            0
          ) || 0);

          // Multi-level variation columns check
          const var1Color = String(
            row["Variation 1 (Color)"] ||
            row["Variation 1"] ||
            row["Color"] ||
            ""
          ).trim();

          const var2Size = String(
            row["Variation 2 (Size)"] ||
            row["Variation 2"] ||
            row["Size"] ||
            ""
          ).trim();

          let variationType = "";
          let variationValue = "";

          if (var1Color || var2Size) {
            if (var1Color && var2Size) {
              variationType = "Color / Size";
              variationValue = `${var1Color} / ${var2Size}`;
            } else if (var1Color) {
              variationType = "Color";
              variationValue = var1Color;
            } else {
              variationType = "Size";
              variationValue = var2Size;
            }
          } else {
            variationType = String(
              row["Variation Type"] ||
              row["variationType"] ||
              row["Variation"] ||
              row["variation"] ||
              ""
            ).trim();
            variationValue = String(
              row["Variation Value"] ||
              row["variationValue"] ||
              row["Value"] ||
              row["value"] ||
              ""
            ).trim();
          }

          validList.push({
            name,
            category,
            subCategory,
            price,
            stock,
            bufferStock,
            description,
            barcode,
            imageUrl,
            isDiscountAvailable,
            discountType,
            discountValue,
            variationType,
            variationValue,
          });
        });

        if (validList.length === 0) {
          toast.error("No valid products found. Ensure 'Product Name' column exists.");
        } else {
          toast.info(`Parsed ${validList.length} products ready for upload.`);
        }

        setParsedProducts(validList);
      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Failed to read Excel file. Please ensure it is a valid .xlsx or .csv.");
        setParsedProducts([]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read the file.");
      setIsParsing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
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

  // 3. Submit bulk upload to server
  const handleUploadProducts = async () => {
    if (parsedProducts.length === 0) {
      toast.warning("Please choose an Excel file with valid products first.");
      return;
    }

    setIsUploading(true);

    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: parsedProducts }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to upload products.");
      } else {
        toast.success(`Successfully uploaded ${data.count} products!`);
        onSuccess();
        onClose();
      }
    } catch {
      toast.error("Network error during bulk products upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="h-[52px] bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[4px] bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-medium text-slate-900 leading-tight">
                Bulk Upload Products
              </h2>
              <span className="text-[11px] text-slate-400 font-normal">
                Upload products via Excel spreadsheet (.xlsx, .xls, .csv)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: Download Sample Excel Banner with Groceries & Clothing Options */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-900 leading-tight">
                  Download Pre-Filled Sample Excel Templates
                </h3>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Choose a template pre-populated with realistic dummy data. Barcodes and image URLs are left blank for auto-generation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option 1: Groceries Template */}
              <div className="bg-white border border-slate-200 rounded-[6px] p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-[#5e2b9d]/60 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-900 truncate">
                      Groceries & Supermarket
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9.5px] font-medium px-1.5 py-0.2 rounded">
                      220+ Items
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                    FMCG, dairy, staples, snacks, household
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadGroceriesExcel}
                  className="h-[30px] px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-[#5e2b9d] text-xs font-medium rounded-[6px] flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2] text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </button>
              </div>

              {/* Option 2: Clothing & Apparel Template */}
              <div className="bg-white border border-purple-200/80 rounded-[6px] p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-[#5e2b9d] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-900 truncate">
                      Clothing Store (Apparel)
                    </span>
                    <span className="bg-purple-50 text-[#5e2b9d] border border-purple-200 text-[9.5px] font-medium px-1.5 py-0.2 rounded">
                      Sizes & Variants
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                    Tees, Shirts, Jeans, Kurtis (S, M, L, XL, 32)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadClothingExcel}
                  className="h-[30px] px-2.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium rounded-[6px] flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>

          {/* STEP 2: Drag and Drop / Choose File */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Choose or Drag your Excel File
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[6px] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-[#5e2b9d] bg-purple-50/50"
                  : selectedFile
                  ? "border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40"
                  : "border-slate-300 bg-[#f8fafc] hover:bg-slate-100/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-[#5e2b9d] mb-2">
                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              {selectedFile ? (
                <div>
                  <span className="text-xs font-medium text-emerald-800 block">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click or drag another file to replace
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-medium text-slate-800 block">
                    Click to browse or drag & drop file here
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Automatic Rules Info Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-[6px] p-3 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-slate-800 text-[11.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5e2b9d]" />
              <span>Smart Automatic Processing Rules:</span>
            </div>
            <ul className="list-disc pl-4 text-[11px] text-slate-500 space-y-0.5">
              <li><strong>Barcodes:</strong> If left empty, unique 12-digit numeric barcodes are generated automatically.</li>
              <li><strong>Images:</strong> If no image link is provided, a default retail placeholder image is assigned.</li>
              <li><strong>Categories & Variations:</strong> Any category or variation mentioned in your file that does not exist in your store yet will be created automatically.</li>
            </ul>
          </div>

          {/* STEP 3: Parsed Data Preview Table */}
          {isParsing ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-[6px]">
              <div className="inline-block w-5 h-5 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-1.5" />
              <p className="text-xs text-slate-500 font-normal">Reading Excel rows...</p>
            </div>
          ) : parsedProducts.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-900">
                  Preview ({parsedProducts.length} Products Found)
                </span>
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Ready to Import
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-[6px] overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Variation</th>
                      <th className="py-2 px-3">Price</th>
                      <th className="py-2 px-3">Discount</th>
                      <th className="py-2 px-3">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedProducts.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-1.5 px-3 font-medium text-slate-800 truncate max-w-[180px]">
                          {item.name}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          <div className="flex flex-col">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10.5px]">
                              {item.category}
                            </span>
                            {item.subCategory && (
                              <span className="text-[9.5px] text-slate-400 font-medium pl-0.5 mt-0.5">
                                ↳ {item.subCategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {item.variationValue ? (
                            <span className="bg-purple-50 text-[#5e2b9d] border border-purple-200/80 px-1.5 py-0.2 rounded text-[10px] font-medium">
                              {item.variationType ? `${item.variationType}: ` : ""}{item.variationValue}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10.5px]">Standard</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-medium text-slate-900">
                          ₹{item.price}
                        </td>
                        <td className="py-1.5 px-3">
                          {item.isDiscountAvailable ? (
                            <span className="inline-flex items-center text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {item.discountType === "RUPEES" ? `₹${item.discountValue} OFF` : `${item.discountValue}% OFF`}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">None</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[11px] font-mono text-purple-700">
                          {item.barcode || "🎲 Auto (12-digits)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedProducts.length > 10 && (
                <p className="text-[10.5px] text-slate-400 text-right">
                  Showing first 10 of {parsedProducts.length} rows. All {parsedProducts.length} will be uploaded.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Fixed Footer */}
        <div className="h-[52px] bg-[#f8fafc] border-t border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-500 font-normal">
            {parsedProducts.length > 0 ? `${parsedProducts.length} products ready` : "No file selected"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadProducts}
              disabled={isUploading || parsedProducts.length === 0}
              className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading {parsedProducts.length} Products...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload {parsedProducts.length > 0 ? `${parsedProducts.length} Products` : "Products"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
