"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import CustomerModal, { CustomerFormData } from "@/components/CustomerModal";
import PosReceiptModal, { ReceiptData } from "@/components/PosReceiptModal";
import PosDraftsModal, { DraftBillItem } from "@/components/PosDraftsModal";
import PosCouponsModal from "@/components/PosCouponsModal";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import { CouponItem } from "@/lib/coupons";
import { EmployeeSummary } from "@/components/EmployeeSearchPicker";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

// Cart Item Type
export interface PosCartItem {
  cartId: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  barcode: string;
  sku: string;
  listPrice: number;
  salePrice: number;
  quantity: number;
  taxRate: number; // e.g. 18 for 18%
  isTaxInclusive: boolean;
  // Employee attribution per line item
  employee?: EmployeeSummary | null;
}

// Sound Beep helper using Web Audio API
function playScanBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(success ? 900 : 350, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export default function PosBillingPage() {
  const toast = useToast();

  // Top Bar Scanner & Search
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Cart & Line Items
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);

  // Variant selector modal
  const [variantModalProduct, setVariantModalProduct] = useState<any | null>(null);

  // Employees List for line item attribution
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [activeEmployeePickerRowId, setActiveEmployeePickerRowId] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  // Customer Selection & Search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Available Coupons & Auto-applicability
  const [availableCoupons, setAvailableCoupons] = useState<CouponItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponItem | null>(null);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);

  // Payment Methods & Split
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");
  const [splitAmounts, setSplitAmounts] = useState({
    cash: "",
    upi: "",
    card: "",
  });

  // Drafts / Parked Bills
  const [draftBills, setDraftBills] = useState<DraftBillItem[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Settlement & Receipt Modal
  const [isSettling, setIsSettling] = useState(false);
  const [settledReceipt, setSettledReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // 1. Initial Load: Employees, Coupons, Local Drafts
  useEffect(() => {
    // Load Employees
    async function loadEmployees() {
      try {
        const res = await fetch("/api/employees?all=true");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.employees)) {
            setEmployees(data.employees);
          }
        }
      } catch (err) {
        console.error("Failed loading employees:", err);
      }
    }

    // Load Active Coupons
    async function loadCoupons() {
      try {
        const res = await fetch("/api/coupons?status=Active");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.coupons)) {
            setAvailableCoupons(data.coupons);
          }
        }
      } catch (err) {
        console.error("Failed loading coupons:", err);
      }
    }

    // Load Local Drafts
    if (typeof window !== "undefined") {
      try {
        const savedLocal = localStorage.getItem("pos_draft_bills");
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) setDraftBills(parsed);
        }
      } catch {}
    }

    loadEmployees();
    loadCoupons();

    // Auto focus barcode scanner on mount
    barcodeInputRef.current?.focus();
  }, []);

  // Save drafts to localStorage whenever draftBills state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pos_draft_bills", JSON.stringify(draftBills));
      } catch {}
    }
  }, [draftBills]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Customer Search Handler
  const handleCustomerSearch = async (query: string) => {
    setCustomerSearchQuery(query);
    const clean = query.trim();
    if (!clean) {
      setCustomerResults([]);
      setIsCustomerDropdownOpen(false);
      return;
    }

    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(clean)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.customers)) {
          setCustomerResults(data.customers);
          setIsCustomerDropdownOpen(true);
        }
      }
    } catch (e) {
      console.error("Customer search error:", e);
    }
  };

  // 3. Product Live Search when typing in scanner input
  useEffect(() => {
    const clean = barcodeInput.trim();
    if (clean.length < 2) {
      setProductSearchResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingProducts(true);
        const res = await fetch(`/api/products?search=${encodeURIComponent(clean)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products)) {
            setProductSearchResults(data.products);
            setIsSearchDropdownOpen(true);
          }
        }
      } catch (e) {
        console.error("Product search error:", e);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [barcodeInput]);

  // 4. Add Product to Cart helper
  const addProductToCart = useCallback((product: any, variant?: any) => {
    if (product.hasVariations && !variant && Array.isArray(product.variants) && product.variants.length > 0) {
      // Prompt variant selection modal
      setVariantModalProduct(product);
      setIsSearchDropdownOpen(false);
      return;
    }

    const variantId = variant?.id || null;
    const variantName = variant?.name || null;
    const barcode = variant?.barcode || product.barcode || "";
    const sku = variant?.sku || product.sku || "";
    const listPrice = Number(variant?.listPrice || variant?.mrp || product.listPrice || product.mrp || product.price) || 0;
    const salePrice = Number(variant?.salesPrice || variant?.price || product.salesPrice || product.price) || 0;
    const taxRate = Number(variant?.taxRate || product.taxRate || 0);
    const isTaxInclusive = variant?.isTaxInclusive !== undefined ? Boolean(variant.isTaxInclusive) : Boolean(product.isTaxInclusive);

    setCartItems((prev) => {
      // Check if product / variant already exists in cart
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && (variantId ? it.variantId === variantId : !it.variantId)
      );

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      const newItem: PosCartItem = {
        cartId: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        productName: product.name,
        variantId,
        variantName,
        barcode,
        sku,
        listPrice,
        salePrice,
        quantity: 1,
        taxRate,
        isTaxInclusive,
        employee: null, // Initial unassigned employee
      };
      return [newItem, ...prev];
    });

    playScanBeep(true);
    setBarcodeInput("");
    setIsSearchDropdownOpen(false);
    barcodeInputRef.current?.focus();
  }, []);

  // 5. Handle Barcode Scanner Form Submit (Enter key or USB Barcode Gun)
  const handleScannerSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    try {
      setIsSearchingProducts(true);
      // First exact barcode lookup
      const bcRes = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
      if (bcRes.ok) {
        const bcData = await bcRes.json();
        if (bcData.success && bcData.product) {
          addProductToCart(bcData.product, bcData.variant);
          return;
        }
      }

      // If not exact barcode, check search results
      const res = await fetch(`/api/products?search=${encodeURIComponent(code)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.products && data.products.length > 0) {
          addProductToCart(data.products[0]);
          return;
        }
      }

      playScanBeep(false);
      toast.error(`No product found for barcode / SKU: ${code}`);
    } catch (err) {
      console.error("Barcode scan lookup error:", err);
      toast.error("Network error while looking up item.");
    } finally {
      setIsSearchingProducts(false);
    }
  };

  // Quantity controls
  const handleUpdateQuantity = (cartId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(cartId);
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => (it.cartId === cartId ? { ...it, quantity: newQty } : it))
    );
  };

  const handleRemoveItem = (cartId: string) => {
    setCartItems((prev) => prev.filter((it) => it.cartId !== cartId));
  };

  const handleToggleTaxMode = (cartId: string) => {
    setCartItems((prev) =>
      prev.map((it) =>
        it.cartId === cartId ? { ...it, isTaxInclusive: !it.isTaxInclusive } : it
      )
    );
  };

  // Employee Assignment per item
  const handleAssignEmployee = (cartId: string, emp: EmployeeSummary | null) => {
    setCartItems((prev) =>
      prev.map((it) => (it.cartId === cartId ? { ...it, employee: emp } : it))
    );
    setActiveEmployeePickerRowId(null);
    setEmployeeSearchQuery("");
  };

  // 6. Real-time Calculation of Cart Totals & Tax Breakdowns
  const calculatedItems = useMemo(() => {
    return cartItems.map((item) => {
      const grossAmount = item.salePrice * item.quantity;
      let taxableAmount = grossAmount;
      let taxAmount = 0;

      if (item.taxRate > 0) {
        if (item.isTaxInclusive) {
          // Inclusive: grossAmount already contains GST
          taxableAmount = grossAmount / (1 + item.taxRate / 100);
          taxAmount = grossAmount - taxableAmount;
        } else {
          // Exclusive: GST is added on top
          taxableAmount = grossAmount;
          taxAmount = grossAmount * (item.taxRate / 100);
        }
      }

      const subtotal = item.isTaxInclusive ? grossAmount : grossAmount + taxAmount;

      return {
        ...item,
        grossAmount,
        taxableAmount,
        taxAmount,
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        subtotal,
      };
    });
  }, [cartItems]);

  const grossSubtotal = useMemo(() => {
    return calculatedItems.reduce((acc, it) => acc + it.grossAmount, 0);
  }, [calculatedItems]);

  const totalTax = useMemo(() => {
    return calculatedItems.reduce((acc, it) => acc + it.taxAmount, 0);
  }, [calculatedItems]);

  const totalUnits = useMemo(() => {
    return calculatedItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [calculatedItems]);

  // Customer Auto Discount Calculation
  const customerDiscountAmount = useMemo(() => {
    if (!selectedCustomer?.discountPercent) return 0;
    const pct = Number(selectedCustomer.discountPercent) || 0;
    if (pct <= 0) return 0;
    return (grossSubtotal * pct) / 100;
  }, [selectedCustomer, grossSubtotal]);

  // Coupon Discount Calculation
  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    let disc = 0;
    if (appliedCoupon.discountType === "percentage") {
      disc = (grossSubtotal * (appliedCoupon.discountValue || 0)) / 100;
      if (appliedCoupon.maxDiscountCap && disc > appliedCoupon.maxDiscountCap) {
        disc = appliedCoupon.maxDiscountCap;
      }
    } else if (appliedCoupon.discountType === "flat") {
      disc = appliedCoupon.discountValue || 0;
    }
    return Math.min(disc, grossSubtotal);
  }, [appliedCoupon, grossSubtotal]);

  const totalDiscount = useMemo(() => {
    return customerDiscountAmount + couponDiscountAmount;
  }, [customerDiscountAmount, couponDiscountAmount]);

  // Base Grand Total before discount & taxes
  const grandTotal = useMemo(() => {
    let total = calculatedItems.reduce((acc, it) => acc + it.subtotal, 0);
    total = Math.max(0, total - totalDiscount);
    return Math.round(total * 100) / 100;
  }, [calculatedItems, totalDiscount]);

  // 7. Auto-apply eligible coupons with autoApplyAtCheckout flag
  useEffect(() => {
    if (availableCoupons.length === 0 || cartItems.length === 0) return;
    if (appliedCoupon) return; // User already has a coupon selected

    const autoCoupon = availableCoupons.find((c) => {
      if (!c.autoApplyAtCheckout) return false;
      if (c.status !== "Active") return false;
      if (c.minOrderValue && grossSubtotal < c.minOrderValue) return false;

      // Customer scope check
      if (c.customerScope === "individual" && selectedCustomer?.phone) {
        const phones = c.targetCustomerPhones || [];
        if (!phones.includes(selectedCustomer.phone)) return false;
      }

      return true;
    });

    if (autoCoupon) {
      setAppliedCoupon(autoCoupon);
      toast.success(`Auto-applied promo: ${autoCoupon.code}`);
    }
  }, [availableCoupons, cartItems, grossSubtotal, selectedCustomer, appliedCoupon]);

  // Split Payment Balance Verification
  const splitRemainingBalance = useMemo(() => {
    const cash = Number(splitAmounts.cash) || 0;
    const upi = Number(splitAmounts.upi) || 0;
    const card = Number(splitAmounts.card) || 0;
    const totalSplit = cash + upi + card;
    return Math.round((grandTotal - totalSplit) * 100) / 100;
  }, [splitAmounts, grandTotal]);

  // Auto-fill split balance helper
  const handleAutoFillSplit = (mode: "cash" | "upi" | "card") => {
    const currentModeVal = Number(splitAmounts[mode]) || 0;
    const toFill = Math.max(0, currentModeVal + splitRemainingBalance);
    setSplitAmounts((prev) => ({
      ...prev,
      [mode]: toFill > 0 ? String(toFill) : "",
    }));
  };

  // 8. Action: Draft the Bill (Hold Bill)
  const handleDraftBill = async () => {
    if (cartItems.length === 0) {
      toast.error("Cannot draft an empty bill.");
      return;
    }

    const draftNumber = `HOLD-${Date.now().toString().slice(-6)}`;
    const newDraft: DraftBillItem = {
      id: activeDraftId || `draft_${Date.now()}`,
      draftNumber,
      createdAt: Date.now(),
      customer: selectedCustomer
        ? {
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            discountPercent: selectedCustomer.discountPercent,
          }
        : undefined,
      items: cartItems,
      subtotal: grossSubtotal,
      discount: totalDiscount,
      tax: totalTax,
      grandTotal,
      couponCode: appliedCoupon?.code,
      appliedCoupon,
    };

    setDraftBills((prev) => [newDraft, ...prev.filter((d) => d.id !== newDraft.id)]);

    // Sync to server draft api
    try {
      fetch("/api/saved-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newDraft.id,
          customer: newDraft.customer,
          items: cartItems,
        }),
      }).catch(() => {});
    } catch {}

    toast.success(`Bill drafted successfully as #${draftNumber}`);
    handleResetCart();
  };

  // Resume drafted bill
  const handleResumeDraft = (draft: DraftBillItem) => {
    setCartItems(draft.items || []);
    if (draft.customer) {
      setSelectedCustomer(draft.customer);
    } else {
      setSelectedCustomer(null);
    }
    if (draft.appliedCoupon) {
      setAppliedCoupon(draft.appliedCoupon);
    } else {
      setAppliedCoupon(null);
    }
    setActiveDraftId(draft.id);
    setIsDraftsModalOpen(false);
    toast.success(`Resumed draft #${draft.draftNumber}`);
  };

  // Delete draft bill
  const handleDeleteDraft = (draftId: string) => {
    setDraftBills((prev) => prev.filter((d) => d.id !== draftId));
    try {
      fetch(`/api/saved-bills?id=${draftId}`, { method: "DELETE" }).catch(() => {});
    } catch {}
    toast.success("Draft bill discarded.");
  };

  // Reset cart for new bill
  const handleResetCart = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setAppliedCoupon(null);
    setBarcodeInput("");
    setPaymentMethod("CASH");
    setSplitAmounts({ cash: "", upi: "", card: "" });
    setActiveDraftId(null);
    barcodeInputRef.current?.focus();
  };

  // 9. Action: Settle the Bill
  const handleSettleBill = async () => {
    if (cartItems.length === 0) {
      toast.error("Please scan at least one item before settling the bill.");
      return;
    }

    if (paymentMethod === "SPLIT" && Math.abs(splitRemainingBalance) > 0.01) {
      toast.error(
        `Split amounts do not match Grand Total. Remaining to balance: ₹${splitRemainingBalance.toFixed(2)}`
      );
      return;
    }

    try {
      setIsSettling(true);

      const splitDetails =
        paymentMethod === "SPLIT"
          ? {
              cash: Number(splitAmounts.cash) || 0,
              upi: Number(splitAmounts.upi) || 0,
              card: Number(splitAmounts.card) || 0,
            }
          : null;

      const payload = {
        items: calculatedItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          variantId: it.variantId,
          variantName: it.variantName,
          barcode: it.barcode,
          sku: it.sku,
          listPrice: it.listPrice,
          salePrice: it.salePrice,
          price: it.salePrice,
          quantity: it.quantity,
          taxRate: it.taxRate,
          isTaxInclusive: it.isTaxInclusive,
          taxableAmount: it.taxableAmount,
          taxAmount: it.taxAmount,
          subtotal: it.subtotal,
          employeeId: it.employee?.id || null,
          employeeName: it.employee?.name || null,
          employeeNumericId: it.employee?.employeeId || null,
          employeeMobile: it.employee?.mobile || null,
        })),
        customer: selectedCustomer
          ? {
              id: selectedCustomer.id,
              name: selectedCustomer.name,
              phone: selectedCustomer.phone,
            }
          : null,
        subtotal: grossSubtotal,
        discount: totalDiscount,
        cgst: totalTax / 2,
        sgst: totalTax / 2,
        grandTotal,
        paymentMethod,
        splitDetails,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: couponDiscountAmount,
        customerDiscount: customerDiscountAmount,
        savedBillId: activeDraftId || null,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to settle bill.");
      }

      // If this bill was loaded from draft, remove from local draft bills
      if (activeDraftId) {
        setDraftBills((prev) => prev.filter((d) => d.id !== activeDraftId));
      }

      toast.success(`Bill #${data.order.billNumber} settled successfully!`);

      // Prepare receipt data
      const receiptPayload: ReceiptData = {
        billNumber: data.order.billNumber,
        createdAt: data.order.created_at || Date.now(),
        customer: selectedCustomer
          ? { name: selectedCustomer.name, phone: selectedCustomer.phone }
          : undefined,
        items: calculatedItems.map((it) => ({
          productName: it.productName,
          variantName: it.variantName,
          barcode: it.barcode,
          listPrice: it.listPrice,
          salePrice: it.salePrice,
          price: it.salePrice,
          quantity: it.quantity,
          taxRate: it.taxRate,
          isTaxInclusive: it.isTaxInclusive,
          taxAmount: it.taxAmount,
          subtotal: it.subtotal,
          employeeName: it.employee?.name,
          employeeNumericId: it.employee?.employeeId,
        })),
        subtotal: grossSubtotal,
        tax: totalTax,
        discount: totalDiscount,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscountAmount,
        customerDiscount: customerDiscountAmount,
        grandTotal,
        paymentMethod:
          paymentMethod === "SPLIT" && splitDetails
            ? `SPLIT (Cash: ₹${splitDetails.cash}, UPI: ₹${splitDetails.upi}, Card: ₹${splitDetails.card})`
            : paymentMethod,
        splitDetails,
        staffName: data.order.staff_name || "Cashier",
      };

      setSettledReceipt(receiptPayload);
      setIsReceiptModalOpen(true);
      handleResetCart();
    } catch (err: any) {
      console.error("Bill settlement error:", err);
      toast.error(err?.message || "Failed to settle bill.");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] bg-[#f8fafc] text-slate-800 overflow-hidden font-sans">
        
        {/* ==================================================================== */}
        {/* TOP BAR: BARCODE SCANNER, DRAFT BILLS, TERMINAL STATUS               */}
        {/* ==================================================================== */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 flex items-center justify-between gap-3 shadow-2xs">
          
          {/* Barcode Scanner Box */}
          <div className="flex-1 max-w-2xl relative" ref={searchDropdownRef}>
            <form onSubmit={handleScannerSubmit} className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5e2b9d]">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>

              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan Barcode or Type Product Name / SKU (Press Enter to add)..."
                className="w-full h-10 pl-10 pr-24 bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-[#5e2b9d] rounded-xl text-xs font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5e2b9d]/20 transition-all shadow-inner"
              />

              <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
                {isSearchingProducts && <Spinner className="w-4 h-4 text-[#5e2b9d] mr-1" />}
                <button
                  type="submit"
                  disabled={!barcodeInput.trim()}
                  className="h-7 px-3 bg-[#5e2b9d] hover:bg-purple-800 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Scan</span>
                  <span className="text-[10px] text-purple-200">↵</span>
                </button>
              </div>
            </form>

            {/* Live Product Search Autocomplete Dropdown */}
            {isSearchDropdownOpen && productSearchResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 divide-y divide-slate-100">
                {productSearchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    className="w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-purple-50/60 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">📦</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {p.barcode && <span className="font-mono">#{p.barcode}</span>}
                          {p.sku && <span>SKU: {p.sku}</span>}
                          <span>Stock: {p.stock}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs font-bold text-[#5e2b9d]">₹{p.salesPrice}</div>
                      {p.listPrice > p.salesPrice && (
                        <div className="text-[10px] text-slate-400 line-through">₹{p.listPrice}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Top Right Actions: Draft Bills, Cart Reset */}
          <div className="flex items-center gap-2 shrink-0">
            {activeDraftId && (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Active Draft Bill</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsDraftsModalOpen(true)}
              className="relative px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Draft Bills</span>
              {draftBills.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#5e2b9d] text-white font-mono text-[10px] font-bold">
                  {draftBills.length}
                </span>
              )}
            </button>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleResetCart}
                className="px-3 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                title="Clear current cart"
              >
                Clear Cart
              </button>
            )}
          </div>

        </div>

        {/* ==================================================================== */}
        {/* MAIN BODY: 2 COLUMN SPLIT - CART LIST (65%) & SUMMARY CHECKOUT (35%) */}
        {/* ==================================================================== */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT: SCANNED ITEMS LIST TABLE */}
          <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
            
            {/* Table Header Bar */}
            <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0">
              <div className="col-span-4">Item & Barcode</div>
              <div className="col-span-1 text-right">MRP</div>
              <div className="col-span-1 text-right">Sale Price</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">GST Breakdown</div>
              <div className="col-span-1 text-right">Subtotal</div>
              <div className="col-span-1 text-center">Action</div>
            </div>

            {/* Cart Items Scrollable Table Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3 shadow-inner">
                    <svg className="w-8 h-8 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Scanner Ready</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Scan any product barcode with your barcode reader, or type product name/SKU in the top bar to begin billing.
                  </p>
                </div>
              ) : (
                calculatedItems.map((item, idx) => (
                  <div
                    key={item.cartId}
                    className="px-4 py-3 hover:bg-slate-50/70 transition-colors flex flex-col gap-2"
                  >
                    {/* Primary Row Grid */}
                    <div className="grid grid-cols-12 items-center text-xs">
                      
                      {/* 1. Item Name, Variant & Barcode */}
                      <div className="col-span-4 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 truncate block">
                            {item.productName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-7 flex items-center gap-2 mt-0.5">
                          {item.variantName && (
                            <span className="bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-medium border border-purple-200/60">
                              {item.variantName}
                            </span>
                          )}
                          {item.barcode && <span className="font-mono">#{item.barcode}</span>}
                          {item.sku && <span>SKU: {item.sku}</span>}
                        </div>
                      </div>

                      {/* 2. List Price (MRP) */}
                      <div className="col-span-1 text-right text-slate-400 line-through font-mono text-[11px]">
                        ₹{item.listPrice || item.salePrice}
                      </div>

                      {/* 3. Sale Price */}
                      <div className="col-span-1 text-right font-bold text-slate-800 font-mono">
                        ₹{item.salePrice}
                      </div>

                      {/* 4. Quantity Stepper */}
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartId, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(item.cartId, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-10 h-6 text-center font-bold font-mono text-xs border border-slate-200 rounded focus:border-[#5e2b9d] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartId, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-xs"
                        >
                          +
                        </button>
                      </div>

                      {/* 5. GST Breakdown & Inclusive/Exclusive Toggle */}
                      <div className="col-span-2 px-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleTaxMode(item.cartId)}
                            title="Click to toggle Inclusive / Exclusive tax"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              item.isTaxInclusive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {item.isTaxInclusive ? "GST Incl." : "+ GST Excl."} ({item.taxRate}%)
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Base: ₹{item.taxableAmount.toFixed(1)} | GST: ₹{item.taxAmount.toFixed(1)}
                        </div>
                      </div>

                      {/* 6. Subtotal */}
                      <div className="col-span-1 text-right font-extrabold text-slate-900 font-mono">
                        ₹{item.subtotal.toFixed(2)}
                      </div>

                      {/* 7. Delete Item */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.cartId)}
                          className="w-6 h-6 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer mx-auto"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>

                    </div>

                    {/* Secondary Row: Employee Selection for this specific item */}
                    <div className="pl-7 pr-2 flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium text-[10.5px]">Attributed Salesperson:</span>

                        {item.employee ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 text-[#5e2b9d] border border-purple-200/80 rounded-lg">
                            <span className="font-semibold text-xs">{item.employee.name}</span>
                            {item.employee.employeeId && (
                              <span className="text-[10px] font-mono text-purple-600 font-bold">
                                #{item.employee.employeeId}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAssignEmployee(item.cartId, null)}
                              className="text-purple-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                              title="Clear employee"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEmployeePickerRowId(
                                  activeEmployeePickerRowId === item.cartId ? null : item.cartId
                                );
                                setEmployeeSearchQuery("");
                              }}
                              className="text-[#5e2b9d] hover:underline font-semibold text-[11px] cursor-pointer flex items-center gap-1"
                            >
                              <span>+ Select Employee</span>
                              <span className="text-[9.5px] text-slate-400">(optional)</span>
                            </button>

                            {/* Floating Employee Search Dropdown */}
                            {activeEmployeePickerRowId === item.cartId && (
                              <div className="absolute z-40 left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 text-left">
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={employeeSearchQuery}
                                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                                    placeholder="Search by ID, Name, Mobile..."
                                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d]"
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                  {employees
                                    .filter((emp) => {
                                      const q = employeeSearchQuery.trim().toLowerCase();
                                      if (!q) return true;
                                      return (
                                        (emp.name || "").toLowerCase().includes(q) ||
                                        String(emp.employeeId || "").includes(q) ||
                                        String(emp.mobile || "").includes(q)
                                      );
                                    })
                                    .slice(0, 10)
                                    .map((emp) => (
                                      <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => handleAssignEmployee(item.cartId, emp)}
                                        className="w-full text-left p-2 hover:bg-purple-50/60 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {emp.avatarUrl ? (
                                            <img
                                              src={emp.avatarUrl}
                                              alt={emp.name}
                                              className="w-6 h-6 rounded-full object-cover shrink-0"
                                            />
                                          ) : (
                                            <div
                                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 border ${getFirstLetterColor(
                                                getFirstLetter(emp.name)
                                              )}`}
                                            >
                                              {getFirstLetter(emp.name)}
                                            </div>
                                          )}
                                          <div className="truncate">
                                            <div className="font-semibold text-xs text-slate-900 truncate">
                                              {emp.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400">📱 {emp.mobile}</div>
                                          </div>
                                        </div>
                                        {emp.employeeId && (
                                          <span className="font-mono text-[10px] font-bold text-[#5e2b9d] bg-purple-50 px-1 rounded shrink-0">
                                            #{emp.employeeId}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-[10.5px] text-slate-400">
                        CGST: ₹{item.cgst.toFixed(1)} | SGST: ₹{item.sgst.toFixed(1)}
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* Bottom Cart Status Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 shrink-0 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span>Total Items: <b className="text-slate-800">{cartItems.length}</b></span>
                <span>•</span>
                <span>Total Units: <b className="text-slate-800">{totalUnits}</b></span>
              </div>
              <div className="font-mono text-xs">
                Taxable Base: <b className="text-slate-800">₹{(grossSubtotal - (totalTax > 0 ? totalTax : 0)).toFixed(2)}</b>
              </div>
            </div>

          </div>

          {/* ==================================================================== */}
          {/* RIGHT: ORDER SUMMARY, CUSTOMER, OFFERS, PAYMENT & SETTLE BILL       */}
          {/* ==================================================================== */}
          <div className="w-full lg:w-96 bg-white flex flex-col overflow-y-auto border-t lg:border-t-0 shadow-lg shrink-0">
            
            <div className="p-4 space-y-4 flex-1">
              
              {/* 1. CUSTOMER SELECTION & SEARCH BAR */}
              <div className="space-y-1.5" ref={customerDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Customer Details</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] font-semibold text-[#5e2b9d] hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span>+ New Customer</span>
                  </button>
                </div>

                {selectedCustomer ? (
                  /* Selected Customer Card */
                  <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#5e2b9d] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedCustomer.name?.charAt(0)?.toUpperCase() || "C"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {selectedCustomer.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span>📱 {selectedCustomer.phone || "No Mobile"}</span>
                          {selectedCustomer.discountPercent > 0 && (
                            <span className="text-emerald-700 font-bold bg-emerald-100 px-1 rounded text-[9.5px]">
                              {selectedCustomer.discountPercent}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-slate-400 hover:text-rose-600 font-semibold p-1 cursor-pointer"
                      title="Clear customer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  /* Customer Search Input */
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      placeholder="Search Customer by Name or Mobile..."
                      className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
                    />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearchQuery("");
                          setCustomerResults([]);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}

                    {/* Customer Dropdown Suggestions */}
                    {isCustomerDropdownOpen && customerResults.length > 0 && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 divide-y divide-slate-100">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearchQuery("");
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-purple-50/60 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-xs text-slate-900">{c.name}</div>
                              <div className="text-[10.5px] text-slate-500">📱 {c.phone}</div>
                            </div>
                            {c.discountPercent > 0 && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                {c.discountPercent}% Disc
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. COUPONS & PROMOTIONS SECTION */}
              <div className="p-3 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5e2b9d] flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span>Offers & Coupons</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsCouponsModalOpen(true)}
                    className="text-[11px] font-bold text-[#5e2b9d] hover:underline cursor-pointer"
                  >
                    View All ({availableCoupons.length})
                  </button>
                </div>

                {appliedCoupon ? (
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-300 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-emerald-700">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-semibold">
                          APPLIED
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        Discount Saving: <b className="text-emerald-700 font-mono">₹{couponDiscountAmount.toFixed(2)}</b>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliedCoupon(null)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="text-[11px] text-slate-500">No promo applied</span>
                    <button
                      type="button"
                      onClick={() => setIsCouponsModalOpen(true)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-purple-200 text-[#5e2b9d] rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                    >
                      Apply Coupon
                    </button>
                  </div>
                )}
              </div>

              {/* 3. TOTALS BREAKDOWN */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-semibold text-slate-900">₹{grossSubtotal.toFixed(2)}</span>
                </div>

                {customerDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Customer Discount ({selectedCustomer.discountPercent}%):</span>
                    <span className="font-mono">-₹{customerDiscountAmount.toFixed(2)}</span>
                  </div>
                )}

                {couponDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Coupon Discount ({appliedCoupon?.code}):</span>
                    <span className="font-mono">-₹{couponDiscountAmount.toFixed(2)}</span>
                  </div>
                )}

                {totalTax > 0 && (
                  <div className="flex justify-between">
                    <span>GST (CGST + SGST):</span>
                    <span className="font-mono text-slate-900">₹{totalTax.toFixed(2)}</span>
                  </div>
                )}

                <div className="p-3 bg-gradient-to-r from-purple-700 to-[#5e2b9d] rounded-xl text-white flex items-center justify-between shadow-sm mt-2">
                  <div>
                    <span className="text-[10px] text-purple-200 block uppercase font-bold tracking-wider">
                      Grand Total Amount
                    </span>
                    <span className="text-xl font-extrabold font-mono tracking-tight">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded font-mono font-medium">
                    {cartItems.length} items
                  </span>
                </div>
              </div>

              {/* 4. PAYMENT METHOD SELECTOR */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-800 block">Payment Mode</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["CASH", "UPI", "CARD", "SPLIT"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        paymentMethod === method
                          ? "bg-[#5e2b9d] text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Split Payment Detailed Inputs */}
                {paymentMethod === "SPLIT" && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-in fade-in duration-100">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span>Specify Split Tenders:</span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          Math.abs(splitRemainingBalance) < 0.01
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {Math.abs(splitRemainingBalance) < 0.01
                          ? "✓ Balanced"
                          : `Balance: ₹${splitRemainingBalance.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-bold text-slate-600">Cash (₹)</label>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplit("cash")}
                            className="text-[9px] text-[#5e2b9d] font-semibold hover:underline"
                          >
                            Fill
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={splitAmounts.cash}
                          onChange={(e) =>
                            setSplitAmounts((prev) => ({ ...prev, cash: e.target.value }))
                          }
                          placeholder="0"
                          className="w-full h-8 px-2 rounded border border-slate-300 font-mono text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-bold text-slate-600">UPI (₹)</label>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplit("upi")}
                            className="text-[9px] text-[#5e2b9d] font-semibold hover:underline"
                          >
                            Fill
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={splitAmounts.upi}
                          onChange={(e) =>
                            setSplitAmounts((prev) => ({ ...prev, upi: e.target.value }))
                          }
                          placeholder="0"
                          className="w-full h-8 px-2 rounded border border-slate-300 font-mono text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-bold text-slate-600">Card (₹)</label>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplit("card")}
                            className="text-[9px] text-[#5e2b9d] font-semibold hover:underline"
                          >
                            Fill
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={splitAmounts.card}
                          onChange={(e) =>
                            setSplitAmounts((prev) => ({ ...prev, card: e.target.value }))
                          }
                          placeholder="0"
                          className="w-full h-8 px-2 rounded border border-slate-300 font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* 5. BOTTOM CHECKOUT ACTIONS: DRAFT & SETTLE */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                
                {/* Draft Bill (Hold) Button */}
                <button
                  type="button"
                  onClick={handleDraftBill}
                  disabled={cartItems.length === 0 || isSettling}
                  className="w-full py-2.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Draft Bill</span>
                </button>

                {/* Settle Bill Button */}
                <button
                  type="button"
                  onClick={handleSettleBill}
                  disabled={cartItems.length === 0 || isSettling}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSettling ? (
                    <>
                      <Spinner className="w-3.5 h-3.5 text-white" />
                      <span>Settling...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Settle Bill</span>
                    </>
                  )}
                </button>

              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ==================================================================== */}
      {/* MODALS: CUSTOMER MODAL, RECEIPT MODAL, DRAFTS MODAL, COUPONS MODAL   */}
      {/* ==================================================================== */}

      {/* Add New Customer Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSaved={(newCust) => {
          setSelectedCustomer(newCust);
          setIsCustomerModalOpen(false);
          toast.success(`Customer ${newCust.name} added and selected!`);
        }}
      />

      {/* Settlement & Receipt Modal with ESC/POS Printing */}
      <PosReceiptModal
        isOpen={isReceiptModalOpen}
        receipt={settledReceipt}
        onClose={() => setIsReceiptModalOpen(false)}
        onNewSale={() => {
          setIsReceiptModalOpen(false);
          handleResetCart();
        }}
      />

      {/* Parked / Draft Bills Modal */}
      <PosDraftsModal
        isOpen={isDraftsModalOpen}
        drafts={draftBills}
        onClose={() => setIsDraftsModalOpen(false)}
        onResumeDraft={handleResumeDraft}
        onDeleteDraft={handleDeleteDraft}
      />

      {/* Available Coupons & Promotions Modal */}
      <PosCouponsModal
        isOpen={isCouponsModalOpen}
        coupons={availableCoupons}
        appliedCoupon={appliedCoupon}
        cartSubtotal={grossSubtotal}
        onClose={() => setIsCouponsModalOpen(false)}
        onApplyCoupon={(c) => {
          setAppliedCoupon(c);
          toast.success(`Coupon ${c.code} applied!`);
        }}
        onRemoveCoupon={() => {
          setAppliedCoupon(null);
          toast.info("Coupon removed.");
        }}
      />

      {/* Variant Selector Modal for Multi-variant Products */}
      {variantModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{variantModalProduct.name}</h3>
                <p className="text-[11px] text-slate-500">Select variant to add to bill</p>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {variantModalProduct.variants.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    addProductToCart(variantModalProduct, v);
                    setVariantModalProduct(null);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-[#5e2b9d] hover:bg-purple-50/50 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{v.name}</div>
                    <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                      {v.barcode ? `#${v.barcode}` : ""} {v.sku ? `SKU: ${v.sku}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-[#5e2b9d]">₹{v.salesPrice || v.price}</div>
                    <div className="text-[10px] text-slate-400">Stock: {v.stock}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </SoftwareLayout>
  );
}
