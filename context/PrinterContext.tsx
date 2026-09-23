"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { generateTestReceipt, generateReceiptEscPos, ReceiptData } from "@/lib/escpos";
import { useToast } from "@/components/ToastProvider";

export type PrinterType = "USB" | "Bluetooth" | "None";
export type UsbSubtype = "WebUSB" | "Serial" | "None";
export type PaperWidth = "58mm" | "80mm";

interface PrinterContextType {
  isConnected: boolean;
  printerType: PrinterType;
  usbSubtype: UsbSubtype;
  printerName: string;
  paperWidth: PaperWidth;
  isPrinting: boolean;
  statusMessage: string;
  lastError: string | null;
  connectUsbPrinter: () => Promise<boolean>;
  connectBluetoothPrinter: () => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  printRaw: (data: Uint8Array) => Promise<boolean>;
  printTestSlip: () => Promise<boolean>;
  printReceipt: (order: any, storeSettings?: any) => Promise<boolean>;
  printWindow: () => void;
  setPaperWidth: (width: PaperWidth) => void;
  clearError: () => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

// Known thermal printer BLE service UUIDs
const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "00001800-0000-1000-8000-00805f9b34fb",
  "00001801-0000-1000-8000-00805f9b34fb",
];

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [printerType, setPrinterType] = useState<PrinterType>("None");
  const [usbSubtype, setUsbSubtype] = useState<UsbSubtype>("None");
  const [printerName, setPrinterName] = useState<string>("");
  const [paperWidth, setPaperWidthState] = useState<PaperWidth>("80mm");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [lastError, setLastError] = useState<string | null>(null);

  // Active hardware handles kept in refs to avoid re-rendering
  const serialPortRef = useRef<any>(null);
  const bleDeviceRef = useRef<any>(null);
  const bleCharacteristicRef = useRef<any>(null);
  const usbDeviceRef = useRef<any>(null);
  const usbEndpointRef = useRef<number | null>(null);
  const printQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  // Load saved paper width on mount (defaults to 80mm to fully occupy paper)
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("retailnext_printer_width") as PaperWidth;
      if (savedWidth === "58mm" || savedWidth === "80mm") {
        setPaperWidthState(savedWidth);
      } else {
        setPaperWidthState("80mm");
        localStorage.setItem("retailnext_printer_width", "80mm");
      }
    } catch {}
  }, []);

  const setPaperWidth = (width: PaperWidth) => {
    setPaperWidthState(width);
    try {
      localStorage.setItem("retailnext_printer_width", width);
    } catch {}
  };

  const clearError = () => setLastError(null);

  // 1. DISCONNECT PRINTER
  const disconnectPrinter = useCallback(async () => {
    try {
      if (serialPortRef.current) {
        try {
          await serialPortRef.current.close();
        } catch {}
        serialPortRef.current = null;
      }

      if (bleDeviceRef.current && bleDeviceRef.current.gatt?.connected) {
        try {
          bleDeviceRef.current.gatt.disconnect();
        } catch {}
      }
      bleDeviceRef.current = null;
      bleCharacteristicRef.current = null;

      if (usbDeviceRef.current) {
        try {
          await usbDeviceRef.current.close();
        } catch {}
        usbDeviceRef.current = null;
        usbEndpointRef.current = null;
      }

      setIsConnected(false);
      setPrinterType("None");
      setUsbSubtype("None");
      setPrinterName("");
      setStatusMessage("Printer Disconnected");
      toast?.info("Printer disconnected");
    } catch (err: any) {
      console.error("Disconnect error:", err);
    }
  }, [toast]);

  // 2. CONNECT WEB USB PRINTER (with WebSerial fallback)
  const connectUsbPrinter = useCallback(async (): Promise<boolean> => {
    setStatusMessage("Searching for USB Thermal Printers...");
    setLastError(null);

    // Try Pure WebUSB first
    if (typeof navigator !== "undefined" && (navigator as any).usb) {
      try {
        const usb = (navigator as any).usb;
        const device = await usb.requestDevice({ filters: [] });

        setStatusMessage(`Connecting to ${device.productName || "USB Printer"}...`);
        await device.open();
        await device.selectConfiguration(1);

        // Find printer interface & bulk OUT endpoint
        let targetInterface: any = null;
        let outEndpoint: any = null;

        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates) {
            // Check printer class (7) or find bulk OUT endpoint
            const outEp = alt.endpoints.find(
              (ep: any) => ep.direction === "out" && ep.type === "bulk"
            );
            if (outEp) {
              targetInterface = iface;
              outEndpoint = outEp;
              break;
            }
          }
          if (targetInterface) break;
        }

        if (targetInterface && outEndpoint) {
          await device.claimInterface(targetInterface.interfaceNumber);
          usbDeviceRef.current = device;
          usbEndpointRef.current = outEndpoint.endpointNumber;

          const devName = device.productName || "USB Thermal Printer";
          setPrinterName(devName);
          setIsConnected(true);
          setPrinterType("USB");
          setUsbSubtype("WebUSB");
          setStatusMessage(`Connected via WebUSB: ${devName}`);
          toast?.success(`USB Connected: ${devName}`);
          return true;
        }
      } catch (usbErr: any) {
        if (usbErr.name === "NotFoundError") {
          setStatusMessage("USB selection cancelled.");
          return false;
        }
        console.warn("Pure WebUSB claim unsuccessful, attempting WebSerial fallback...", usbErr);
      }
    }

    // Fallback: Web Serial API (for USB Virtual COM / Windows spooler drivers)
    if (typeof navigator !== "undefined" && (navigator as any).serial) {
      try {
        setStatusMessage("Opening via Serial / USB COM...");
        const serial = (navigator as any).serial;
        const port = await serial.requestPort();
        await port.open({ baudRate: 9600 });

        serialPortRef.current = port;
        const devName = "USB Serial Thermal Printer";
        setPrinterName(devName);
        setIsConnected(true);
        setPrinterType("USB");
        setUsbSubtype("Serial");
        setStatusMessage("Connected via USB Serial (COM)");
        toast?.success("USB Serial Printer Connected");
        return true;
      } catch (serialErr: any) {
        if (serialErr.name === "NotFoundError") {
          setStatusMessage("Serial port selection cancelled.");
          return false;
        }
        console.error("WebSerial error:", serialErr);
        const errMsg = serialErr.message || "Failed to connect to USB Printer.";
        setLastError(errMsg);
        toast?.error(errMsg);
        return false;
      }
    }

    const unsuppMsg = "Web USB / Serial is not supported in this browser. Please use Chrome or Edge.";
    setLastError(unsuppMsg);
    toast?.warning(unsuppMsg);
    return false;
  }, [toast]);

  // 3. CONNECT WEB BLUETOOTH PRINTER
  const connectBluetoothPrinter = useCallback(async (): Promise<boolean> => {
    setStatusMessage("Searching for Bluetooth Thermal Printers...");
    setLastError(null);

    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      const errMsg = "Web Bluetooth is not supported in this browser. Please use Chrome or Edge with Bluetooth enabled.";
      setLastError(errMsg);
      toast?.warning(errMsg);
      return false;
    }

    try {
      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
      });

      setStatusMessage(`Pairing with ${device.name || "Bluetooth Printer"}...`);

      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setPrinterType("None");
        setPrinterName("");
        setStatusMessage("Bluetooth printer disconnected");
        toast?.info("Bluetooth printer disconnected");
      });

      const server = await device.gatt.connect();

      // Find writable characteristic
      let targetCharacteristic: any = null;

      for (const serviceUuid of BLE_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();

          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch {}
      }

      if (!targetCharacteristic) {
        throw new Error("No writable ESC/POS print service found on this Bluetooth device.");
      }

      bleDeviceRef.current = device;
      bleCharacteristicRef.current = targetCharacteristic;

      const devName = device.name || "Bluetooth Thermal Printer";
      setPrinterName(devName);
      setIsConnected(true);
      setPrinterType("Bluetooth");
      setStatusMessage(`Connected via Bluetooth: ${devName}`);
      toast?.success(`Bluetooth Connected: ${devName}`);
      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        setStatusMessage("Bluetooth pairing cancelled.");
        return false;
      }
      console.error("Bluetooth error:", err);
      const msg = err.message || "Failed to pair Bluetooth printer.";
      setLastError(msg);
      toast?.error(msg);
      return false;
    }
  }, [toast]);

  // 4. LOW-LEVEL ESC/POS BYTE STREAMER
  const printRaw = useCallback(async (data: Uint8Array): Promise<boolean> => {
    return (printQueueRef.current = printQueueRef.current.then(async () => {
      setIsPrinting(true);
      setStatusMessage("Sending print data to hardware...");

      try {
        // A. Pure WebUSB
        if (printerType === "USB" && usbSubtype === "WebUSB" && usbDeviceRef.current && usbEndpointRef.current) {
          await usbDeviceRef.current.transferOut(usbEndpointRef.current, data);
          setStatusMessage("Print completed via WebUSB");
          return true;
        }

        // B. USB Serial Port
        if (printerType === "USB" && usbSubtype === "Serial" && serialPortRef.current) {
          const writer = serialPortRef.current.writable.getWriter();
          await writer.write(data);
          writer.releaseLock();
          setStatusMessage("Print completed via Serial");
          return true;
        }

        // C. Bluetooth BLE in chunks (max 128 bytes to prevent BLE buffer drops)
        if (printerType === "Bluetooth" && bleCharacteristicRef.current) {
          const char = bleCharacteristicRef.current;
          const CHUNK_SIZE = 100;

          for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            if (char.writeValueWithoutResponse) {
              await char.writeValueWithoutResponse(chunk);
            } else {
              await char.writeValue(chunk);
            }
            // Small throttle between BLE packets
            await new Promise((r) => setTimeout(r, 20));
          }

          setStatusMessage("Print completed via Bluetooth");
          return true;
        }

        // If not connected, fallback to browser print
        window.print();
        return true;
      } catch (err: any) {
        console.error("Print stream error:", err);
        setLastError(err.message || "Failed to stream print data.");
        // Fallback to browser print on hardware error
        window.print();
        return false;
      } finally {
        setIsPrinting(false);
      }
    }));
  }, [printerType, usbSubtype]);

  // 5. PRINT HARDWARE TEST SLIP
  const printTestSlip = useCallback(async (): Promise<boolean> => {
    const bytes = generateTestReceipt(paperWidth);
    return await printRaw(bytes);
  }, [paperWidth, printRaw]);

  // 6. PRINT COMPREHENSIVE STORE RECEIPT
  const printReceipt = useCallback(
    async (order: any, storeSettings?: any): Promise<boolean> => {
      if (!order) return false;

      const receiptData: ReceiptData = {
        storeName: storeSettings?.name || "Retail Next Store",
        storeAddress: storeSettings?.address,
        storeCity: storeSettings?.city,
        storeState: storeSettings?.state,
        storePincode: storeSettings?.pincode,
        storePhone: storeSettings?.phone,
        storeEmail: storeSettings?.email,
        storeGst: storeSettings?.gstNumber,
        enableGst: storeSettings?.enableGst,
        billNumber: order.billNumber || "BILL-001",
        createdAt: order.createdAt || Date.now(),
        customerName: order.customer?.name,
        customerPhone: order.customer?.phone,
        customerCity: order.customer?.city,
        cashierName: order.settledBy,
        paymentMethod: order.paymentMethod || "CASH",
        splitDetails: order.splitDetails,
        items: (order.items || []).map((it: any) => ({
          name: it.productName || "Item",
          variantName: it.variantName,
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          total: Number(it.total) || 0,
        })),
        subtotal: Number(order.subtotal) || 0,
        discount: Number(order.discount) || 0,
        cgst: Number(order.cgst) || 0,
        sgst: Number(order.sgst) || 0,
        roundOff: Number(order.roundOff) || 0,
        grandTotal: Number(order.grandTotal) || 0,
        notes: order.notes,
      };

      if (isConnected) {
        const bytes = generateReceiptEscPos(receiptData, paperWidth);
        const ok = await printRaw(bytes);
        if (ok) {
          toast?.success(`Receipt Printed (${paperWidth})`);
          return true;
        }
      }

      // Fallback: standard browser window print dialog
      window.print();
      return true;
    },
    [isConnected, paperWidth, printRaw, toast]
  );

  const printWindow = useCallback(() => {
    window.print();
  }, []);

  return (
    <PrinterContext.Provider
      value={{
        isConnected,
        printerType,
        usbSubtype,
        printerName,
        paperWidth,
        isPrinting,
        statusMessage,
        lastError,
        connectUsbPrinter,
        connectBluetoothPrinter,
        disconnectPrinter,
        printRaw,
        printTestSlip,
        printReceipt,
        printWindow,
        setPaperWidth,
        clearError,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
};
