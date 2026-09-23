"use client";

import React, { useState } from "react";
import { usePrinter } from "@/context/PrinterContext";
import {
  Printer,
  Usb,
  Bluetooth,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sliders,
  FileText,
  X,
  Zap,
  Info,
  PowerOff,
  Check,
  ChevronRight,
} from "lucide-react";

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThermalPrinterModal({ isOpen, onClose }: ThermalPrinterModalProps) {
  const {
    isConnected,
    printerType,
    printerName,
    paperWidth,
    isPrinting,
    statusMessage,
    lastError,
    connectUsbPrinter,
    connectBluetoothPrinter,
    disconnectPrinter,
    printTestSlip,
    printWindow,
    setPaperWidth,
    clearError,
  } = usePrinter();

  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean>(false);
  const [connectingType, setConnectingType] = useState<"USB" | "Bluetooth" | null>(null);

  if (!isOpen) return null;

  const handleConnectUsb = async () => {
    setConnectingType("USB");
    try {
      await connectUsbPrinter();
    } finally {
      setConnectingType(null);
    }
  };

  const handleConnectBluetooth = async () => {
    setConnectingType("Bluetooth");
    try {
      await connectBluetoothPrinter();
    } finally {
      setConnectingType(null);
    }
  };

  const handleRunTestPrint = async () => {
    setTestPrintSuccess(false);
    const ok = await printTestSlip();
    if (ok) {
      setTestPrintSuccess(true);
      setTimeout(() => setTestPrintSuccess(false), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 text-slate-800">
        {/* Header */}
        <div className="bg-[#5e2b9d] text-white px-5 py-4 flex items-center justify-between border-b border-[#4e2284]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-purple-200">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Thermal Printer Center
                </h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/15 text-purple-100 border border-white/20">
                  ESC/POS
                </span>
              </div>
              <p className="text-xs text-purple-200/80 font-normal mt-0.5">
                Connect via Web USB or Bluetooth for instant receipt printing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Active Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isConnected
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isConnected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {isConnected ? (
                  printerType === "Bluetooth" ? (
                    <Bluetooth className="w-5 h-5" />
                  ) : (
                    <Usb className="w-5 h-5" />
                  )
                ) : (
                  <PowerOff className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isConnected ? `Online (${printerType})` : "Disconnected"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                  {isConnected
                    ? printerName
                    : "Choose USB or Bluetooth below to connect printer hardware"}
                </p>
              </div>
            </div>

            {isConnected && (
              <button
                onClick={disconnectPrinter}
                className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Connection Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Web USB Option */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                printerType === "USB" && isConnected
                  ? "bg-purple-50/50 border-[#5e2b9d] ring-1 ring-[#5e2b9d]"
                  : "bg-white border-slate-200/90 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <Usb className="w-4 h-4" />
                  </div>
                  {printerType === "USB" && isConnected && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-900">USB Thermal Printer</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Connect direct USB POS printer (Epson, TVS, Xprinter, NGX, Posiflex, Rugtek).
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleConnectUsb}
                  disabled={connectingType === "USB"}
                  className={`w-full h-8 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    printerType === "USB" && isConnected
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-[#5e2b9d] hover:bg-[#4e2284] text-white shadow-xs"
                  }`}
                >
                  {connectingType === "USB" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : printerType === "USB" && isConnected ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Re-pair USB</span>
                    </>
                  ) : (
                    <>
                      <Usb className="w-3.5 h-3.5" />
                      <span>Connect USB</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Web Bluetooth Option */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                printerType === "Bluetooth" && isConnected
                  ? "bg-blue-50/50 border-blue-600 ring-1 ring-blue-600"
                  : "bg-white border-slate-200/90 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Bluetooth className="w-4 h-4" />
                  </div>
                  {printerType === "Bluetooth" && isConnected && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-900">Bluetooth Printer</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Connect wireless Bluetooth BLE thermal printer for mobile and counter billing.
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  disabled={connectingType === "Bluetooth"}
                  className={`w-full h-8 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    printerType === "Bluetooth" && isConnected
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  }`}
                >
                  {connectingType === "Bluetooth" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Pairing...</span>
                    </>
                  ) : printerType === "Bluetooth" && isConnected ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Re-pair Bluetooth</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-3.5 h-3.5" />
                      <span>Pair Bluetooth</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Paper Width Selector (Default 80mm to fully occupy paper) */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#5e2b9d]" /> Paper Roll Width
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {paperWidth === "80mm" ? "48 Columns (Full 3-Inch)" : "32 Columns (Compact 2-Inch)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  paperWidth === "80mm"
                    ? "bg-white border-[#5e2b9d] text-[#5e2b9d] shadow-xs ring-1 ring-[#5e2b9d]"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>3 Inch / 80mm (Standard POS)</span>
                {paperWidth === "80mm" && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setPaperWidth("58mm")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  paperWidth === "58mm"
                    ? "bg-white border-[#5e2b9d] text-[#5e2b9d] shadow-xs ring-1 ring-[#5e2b9d]"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>2 Inch / 58mm (Portable)</span>
                {paperWidth === "58mm" && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Test Printing Action */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Verify Hardware Print</h4>
              <p className="text-[11px] text-slate-500">
                Sends a formatted test slip to verify paper width alignment and cutter.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunTestPrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isPrinting ? "Printing..." : "Print Test Slip"}</span>
            </button>
          </div>

          {testPrintSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Test print sent successfully to thermal printer!</span>
            </div>
          )}

          {lastError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{lastError}</span>
              </div>
              <button onClick={clearError} className="text-red-500 hover:text-red-700 text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Browser Requirements Footer Note */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>Browser Compatibility</span>
            </div>
            <p>
              Web USB and Web Bluetooth require <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. If hardware connection is not used, standard system printing will automatically open.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={printWindow}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Open System Print Dialog</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
