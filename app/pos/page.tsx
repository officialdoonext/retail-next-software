"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface CartItem {
  cartId: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  barcode: string;
  sku: string;
  price: number;
  stock: number;
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  email?: string;
  address?: string;
}

interface StoreSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  logoUrl: string;
  enableGst: boolean;
  gstNumber: string;
  isPriceInclusiveGst: boolean;
  cgstPercent: number;
  sgstPercent: number;
}

interface SavedBill {
  id: string;
  draftNumber: string;
  customer?: Customer | null;
  items: any[];
  totalItemsCount: number;
  subtotal: number;
  discount: number;
  discountType: string;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paymentMethod: string;
  notes?: string;
  createdAt: number;
}

export default function PosPage() {
  const toast = useToast();

  // Reference data
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [savedBills, setSavedBills] = useState<SavedBill[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Cart & Bill State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "CARD" | "SPLIT">("CASH");
  const [splitAmounts, setSplitAmounts] = useState({ upi: 0, cash: 0, card: 0 });
  const [billNotes, setBillNotes] = useState("");
  const [activeSavedBillId, setActiveSavedBillId] = useState<string | null>(null);

  // Barcode & Item Search
  const [barcodeInput, setBarcodeInput] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Customer Search & Quick Add
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustCity, setNewCustCity] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState("");

  // Saved Bills Drawer & Action Confirmation
  const [isSavedBillsModalOpen, setIsSavedBillsModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<SavedBill | null>(null);
  const [deletingSavedBill, setDeletingSavedBill] = useState(false);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);

  // Bill Settle & Print Receipt Modal
  const [settlingBill, setSettlingBill] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [settledReceipt, setSettledReceipt] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Audio Beep generator for scanner feedback
  const playBeep = (isSuccess = true) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? "sine" : "square";
      osc.frequency.setValueAtTime(isSuccess ? 880 : 300, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (isSuccess ? 0.12 : 0.25));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.25));
    } catch {
      // Audio context may be restricted by browser policy
    }
  };

  // Load all initial store data
  const loadInitialData = async () => {
    setLoadingInitial(true);
    try {
      const [prodRes, custRes, setRes, savedRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/customers"),
        fetch("/api/settings"),
        fetch("/api/saved-bills"),
      ]);

      const [prodData, custData, setData, savedData] = await Promise.all([
        prodRes.json(),
        custRes.json(),
        setRes.json(),
        savedRes.json(),
      ]);

      if (prodRes.ok && prodData.success) {
        setProducts(prodData.products || []);
      }
      if (custRes.ok && custData.success) {
        setCustomers(custData.customers || []);
      }
      if (setRes.ok && setData.success) {
        setStoreSettings(setData.settings || null);
      }
      if (savedRes.ok && savedData.success) {
        setSavedBills(savedData.savedBills || []);
      }
    } catch (err) {
      console.error("Error loading POS data:", err);
      toast.error("Failed to load store products or settings.");
    } finally {
      setLoadingInitial(false);
      // Auto focus scanner input
      setTimeout(() => barcodeInputRef.current?.focus(), 200);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Filtered customer suggestions
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return [];
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.city && c.city.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [customers, customerSearchQuery]);

  // Filtered products for manual search
  const filteredManualProducts = useMemo(() => {
    const q = itemSearchQuery.toLowerCase().trim();
    if (!q) return products.slice(0, 15);
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchCategory = p.categoryName && p.categoryName.toLowerCase().includes(q);
      const matchBarcode = p.barcode && p.barcode.includes(q);
      const matchVariantBarcode =
        p.hasVariations &&
        p.variants?.some((v: any) => v.barcode && v.barcode.includes(q));
      return matchName || matchCategory || matchBarcode || matchVariantBarcode;
    }).slice(0, 20);
  }, [products, itemSearchQuery]);

  // Handle Add Product to Cart
  const addProductToCart = (
    product: any,
    variant?: any,
    customQty = 1
  ) => {
    const isVariant = Boolean(variant);
    const safeProdId = product?.id || product?.barcode || `prod_${Date.now()}`;
    const safeVarId = variant ? (variant.id || variant.barcode || variant.name || "v") : null;
    const cartId = isVariant ? `${safeProdId}_${safeVarId}` : safeProdId;
    const price = isVariant ? Number(variant.price) || 0 : Number(product.price) || 0;
    const availableStock = isVariant ? Number(variant.stock) || 0 : Number(product.stock) || 0;
    const barcode = isVariant ? variant.barcode || "" : product.barcode || "";
    const sku = isVariant ? variant.sku || "" : product.sku || "";
    const variantName = isVariant ? variant.name : null;

    if (availableStock <= 0) {
      toast.warning(`Warning: "${product.name}${variantName ? ` (${variantName})` : ""}" is currently out of stock!`);
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.cartId === cartId);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + customQty;
        if (newQty > availableStock && availableStock > 0) {
          toast.warning(`Available stock is ${availableStock}. Added anyway.`);
        }
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            cartId,
            productId: product.id,
            productName: product.name,
            variantId: isVariant ? variant.id : null,
            variantName,
            barcode,
            sku,
            price,
            stock: availableStock,
            quantity: customQty,
          },
        ];
      }
    });

    playBeep(true);
  };

  // Barcode Scanning / Enter Submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    // Search simple products or variants matching this exact barcode
    let foundProduct: any = null;
    let foundVariant: any = null;

    for (const p of products) {
      if (p.hasVariations && Array.isArray(p.variants)) {
        const matchV = p.variants.find(
          (v: any) => v.barcode && v.barcode.toLowerCase() === code.toLowerCase()
        );
        if (matchV) {
          foundProduct = p;
          foundVariant = matchV;
          break;
        }
      } else {
        if (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) {
          foundProduct = p;
          break;
        }
      }
    }

    if (foundProduct) {
      addProductToCart(foundProduct, foundVariant, 1);
    } else {
      playBeep(false);
      toast.error(`No product found with barcode "${code}".`);
    }

    setBarcodeInput("");
    barcodeInputRef.current?.focus();
  };

  // Update item quantity
  const updateItemQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Set explicit quantity
  const setDirectQuantity = (cartId: string, val: string) => {
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty <= 0) return;
    setCart((prev) =>
      prev.map((item) => (item.cartId === cartId ? { ...item, quantity: qty } : item))
    );
  };

  // Remove item from cart
  const removeItemFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountValue("");
    setPaymentMethod("CASH");
    setBillNotes("");
    setActiveSavedBillId(null);
    setIsClearCartConfirmOpen(false);
    toast.info("Cart cleared.");
    barcodeInputRef.current?.focus();
  };

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCustName.trim();
    const cleanPhone = newCustPhone.trim().replace(/\D/g, "");
    const cleanCity = newCustCity.trim();

    if (!cleanName) {
      setAddCustomerError("Customer name is required.");
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      setAddCustomerError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!cleanCity) {
      setAddCustomerError("City is required.");
      return;
    }

    setSavingCustomer(true);
    setAddCustomerError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          city: cleanCity,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setCustomers((prev) => [data.customer, ...prev]);
        setSelectedCustomer(data.customer);
        setIsAddCustomerModalOpen(false);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustCity("");
        setCustomerSearchQuery("");
        toast.success(`Customer "${data.customer.name}" created and selected!`);
      } else {
        setAddCustomerError(data.error || "Failed to add customer.");
      }
    } catch {
      setAddCustomerError("Network error while creating customer.");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Totals & Taxes Calculation
  // GST Calculation based on Store Settings
  const enableGst = Boolean(storeSettings?.enableGst);
  const isPriceInclusiveGst = Boolean(storeSettings?.isPriceInclusiveGst);
  const cgstPercent = storeSettings?.cgstPercent ?? 9;
  const sgstPercent = storeSettings?.sgstPercent ?? 9;
  const totalGstRate = cgstPercent + sgstPercent;

  // Gross cart total (MRP sum of item prices * quantity)
  const grossCartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  // Comprehensive Totals & Taxes Calculation
  const { subtotal, discountAmount, cgst, sgst, grandTotal } = useMemo(() => {
    if (grossCartTotal <= 0) {
      return { subtotal: 0, discountAmount: 0, cgst: 0, sgst: 0, grandTotal: 0 };
    }

    if (!enableGst || totalGstRate <= 0) {
      // GST Disabled
      const disc =
        !discountValue || discountValue <= 0
          ? 0
          : discountType === "PERCENT"
          ? (grossCartTotal * Number(discountValue)) / 100
          : Math.min(Number(discountValue), grossCartTotal);

      const gTotal = Math.max(0, grossCartTotal - disc);
      return {
        subtotal: Math.round(grossCartTotal * 100) / 100,
        discountAmount: Math.round(disc * 100) / 100,
        cgst: 0,
        sgst: 0,
        grandTotal: Math.round(gTotal * 100) / 100,
      };
    }

    if (isPriceInclusiveGst) {
      // GST IS INCLUSIVE IN PRODUCT PRICES
      // Product price already contains GST (e.g. ₹399 at 18% GST).
      // Base Taxable Subtotal = Gross / (1 + totalGstRate / 100) = 399 / 1.18 = ₹338.14
      const rawDisc =
        !discountValue || discountValue <= 0
          ? 0
          : discountType === "PERCENT"
          ? (grossCartTotal * Number(discountValue)) / 100
          : Math.min(Number(discountValue), grossCartTotal);

      const payableGross = Math.max(0, grossCartTotal - rawDisc);
      const gTotal = Math.round(payableGross * 100) / 100;

      // Extract CGST and SGST from payable amount
      const taxComponent = (gTotal * totalGstRate) / (100 + totalGstRate);
      const halfTax = taxComponent / 2;
      const calculatedCgst = Math.round(halfTax * 100) / 100;
      const calculatedSgst = Math.round(halfTax * 100) / 100;

      // Base Taxable Subtotal before tax: 399 - 60.86 = ₹338.14
      // Subtotal (338.14) - Discount (42.37) + CGST (26.62) + SGST (26.62) = Grand Total (349.00)
      const taxableDiscount = Math.round((rawDisc / (1 + totalGstRate / 100)) * 100) / 100;
      const taxableGross = Math.round((grossCartTotal / (1 + totalGstRate / 100)) * 100) / 100;

      return {
        subtotal: taxableGross,
        discountAmount: taxableDiscount,
        cgst: calculatedCgst,
        sgst: calculatedSgst,
        grandTotal: gTotal,
      };
    } else {
      // GST IS EXCLUSIVE (Added on top of subtotal)
      const disc =
        !discountValue || discountValue <= 0
          ? 0
          : discountType === "PERCENT"
          ? (grossCartTotal * Number(discountValue)) / 100
          : Math.min(Number(discountValue), grossCartTotal);

      const taxableBase = Math.max(0, grossCartTotal - disc);
      const calculatedCgst = Math.round((taxableBase * (cgstPercent / 100)) * 100) / 100;
      const calculatedSgst = Math.round((taxableBase * (sgstPercent / 100)) * 100) / 100;
      const gTotal = Math.round((taxableBase + calculatedCgst + calculatedSgst) * 100) / 100;

      return {
        subtotal: Math.round(grossCartTotal * 100) / 100,
        discountAmount: Math.round(disc * 100) / 100,
        cgst: calculatedCgst,
        sgst: calculatedSgst,
        grandTotal: gTotal,
      };
    }
  }, [grossCartTotal, discountValue, discountType, enableGst, isPriceInclusiveGst, cgstPercent, sgstPercent, totalGstRate]);

  // Keep split amounts synced when split mode is used
  const currentSplitTotal = Math.round((splitAmounts.upi + splitAmounts.cash + splitAmounts.card) * 100) / 100;
  const splitBalance = Math.round((grandTotal - currentSplitTotal) * 100) / 100;

  const autoFillSplitCash = () => {
    setSplitAmounts((prev) => ({
      ...prev,
      cash: Math.max(0, Math.round((grandTotal - (prev.upi + prev.card)) * 100) / 100),
    }));
  };

  // SAVE BILL (Hold Draft in saved_bills)
  const handleSaveBillDraft = async () => {
    if (cart.length === 0) {
      toast.warning("Cannot save an empty bill.");
      return;
    }

    setSavingDraft(true);
    try {
      const res = await fetch("/api/saved-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSavedBillId,
          customer: selectedCustomer,
          items: cart,
          subtotal,
          discount: discountAmount,
          discountType,
          cgst,
          sgst,
          grandTotal,
          paymentMethod,
          notes: billNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Bill placed on hold in Saved Bills list!");
        // Refresh saved bills list
        const refRes = await fetch("/api/saved-bills");
        const refData = await refRes.json();
        if (refRes.ok && refData.success) {
          setSavedBills(refData.savedBills || []);
        }

        // Reset cart
        setCart([]);
        setSelectedCustomer(null);
        setDiscountValue("");
        setBillNotes("");
        setActiveSavedBillId(null);
      } else {
        toast.error(data.error || "Failed to save bill draft.");
      }
    } catch {
      toast.error("Network error while saving draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  // LOAD SAVED BILL DRAFT
  const handleLoadSavedBill = (bill: SavedBill) => {
    const loadedItems = (bill.items || []).map((it: any, index: number) => ({
      ...it,
      cartId:
        it.cartId ||
        (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) ||
        `loaded_${Date.now()}_${index}`,
    }));
    setCart(loadedItems);
    setSelectedCustomer(bill.customer || null);
    setDiscountValue(bill.discount || "");
    setDiscountType((bill.discountType as any) || "FIXED");
    setPaymentMethod((bill.paymentMethod as any) || "CASH");
    setBillNotes(bill.notes || "");
    setActiveSavedBillId(bill.id);
    setIsSavedBillsModalOpen(false);
    toast.info(`Loaded draft "${bill.draftNumber}" back to billing!`);
  };

  // DISCARD / DELETE SAVED BILL DRAFT
  const handleConfirmDeleteSavedBill = async () => {
    if (!billToDelete) return;
    setDeletingSavedBill(true);
    try {
      const res = await fetch(`/api/saved-bills?id=${billToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSavedBills((prev) => prev.filter((b) => b.id !== billToDelete.id));
        if (activeSavedBillId === billToDelete.id) {
          setActiveSavedBillId(null);
        }
        toast.success("Saved draft removed.");
        setBillToDelete(null);
      } else {
        toast.error(data.error || "Failed to remove saved draft.");
      }
    } catch {
      toast.error("Network error while removing saved draft.");
    } finally {
      setDeletingSavedBill(false);
    }
  };

  // SAVE & SETTLE BILL
  const handleSettleBill = async () => {
    if (cart.length === 0) {
      toast.warning("Cannot settle an empty bill. Please add items.");
      return;
    }

    if (paymentMethod === "SPLIT" && Math.abs(splitBalance) > 0.05) {
      toast.error(`Split payment incomplete. Difference is ₹${splitBalance.toFixed(2)}.`);
      return;
    }

    setSettlingBill(true);

    try {
      const payload: any = {
        items: cart,
        customer: selectedCustomer,
        subtotal,
        discount: discountAmount,
        discountType,
        cgst,
        sgst,
        cgstPercent,
        sgstPercent,
        isPriceInclusiveGst,
        grandTotal,
        paymentMethod,
        splitDetails: paymentMethod === "SPLIT" ? splitAmounts : null,
        notes: billNotes,
        savedBillId: activeSavedBillId,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.order) {
        toast.success("Bill settled & sale recorded successfully!");

        // Open Printable Receipt
        setSettledReceipt(data.order);
        setIsReceiptModalOpen(true);

        // Remove from saved bills if it was a draft
        if (activeSavedBillId) {
          setSavedBills((prev) => prev.filter((b) => b.id !== activeSavedBillId));
        }

        // Reset cart for next customer
        setCart([]);
        setSelectedCustomer(null);
        setDiscountValue("");
        setBillNotes("");
        setSplitAmounts({ upi: 0, cash: 0, card: 0 });
        setActiveSavedBillId(null);

        // Refresh products list in background to reflect deducted stocks
        fetch("/api/products")
          .then((r) => r.json())
          .then((d) => {
            if (d.success) setProducts(d.products || []);
          })
          .catch(() => {});
      } else {
        toast.error(data.error || "Failed to settle bill.");
      }
    } catch {
      toast.error("Network error while settling bill.");
    } finally {
      setSettlingBill(false);
    }
  };

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans space-y-3">
        {/* TOP BAR / SCANNER & QUICK ACTIONS */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] p-2.5 sm:p-3 shadow-2xs flex flex-col lg:flex-row items-center justify-between gap-2.5">
          {/* Barcode Scanner Form */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1 w-full">
            <div className="relative">
              <svg
                className="w-4 h-4 text-purple-600 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[2]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75z"
                />
              </svg>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan product barcode with scanner, or type & press Enter..."
                className="w-full h-[34px] max-h-[34px] pl-8 pr-20 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-[26px] bg-[#5e2b9d] text-white px-2.5 rounded-[4px] text-[11px] font-medium hover:bg-[#4e2284] transition-colors cursor-pointer"
              >
                Scan Enter
              </button>
            </div>
          </form>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            {/* Manual Product Browser Button */}
            <button
              type="button"
              onClick={() => setIsProductSearchOpen(true)}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Browse Products</span>
            </button>

            {/* Saved Bills Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsSavedBillsModalOpen(true)}
              className="relative h-[34px] max-h-[34px] px-3 rounded-[6px] border border-amber-300 bg-amber-50 hover:bg-amber-100/80 text-xs font-medium text-amber-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Saved Bills</span>
              {savedBills.length > 0 && (
                <span className="ml-0.5 bg-amber-600 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                  {savedBills.length}
                </span>
              )}
            </button>

            {/* Clear Cart Button */}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearCartConfirmOpen(true)}
                className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-medium text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear Cart"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* ACTIVE DRAFT BANNER */}
        {activeSavedBillId && (
          <div className="bg-amber-50 border border-amber-200 rounded-[6px] px-3.5 py-2 flex items-center justify-between text-xs text-amber-900 font-medium animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                You are currently editing a resumed draft bill. Settling will automatically remove it from your saved drafts.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSavedBillId(null)}
              className="text-[11px] text-amber-800 underline hover:text-amber-950 cursor-pointer"
            >
              Detach Draft
            </button>
          </div>
        )}

        {/* MAIN POS WORKSPACE: 2 COLUMNS (CART 65%, CHECKOUT SUMMARY 35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* LEFT: CART ITEMS TABLE (7 or 8 cols on large screens) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs flex flex-col">
            <div className="p-3 border-b border-slate-200 bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-medium text-slate-800 uppercase tracking-wide">
                  Current Bill Items
                </h2>
                <span className="bg-purple-50 text-[#5e2b9d] text-[10px] font-mono px-2 py-0.5 rounded-[4px] font-medium">
                  {cart.reduce((s, it) => s + it.quantity, 0)} Items
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                Press Enter to scan more items
              </span>
            </div>

            {/* Cart Table */}
            {cart.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800 mb-1">Billing cart is empty</h3>
                <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mb-3">
                  Scan any product barcode or click &quot;Browse Products&quot; to begin building your customer&apos;s invoice.
                </p>
                <button
                  type="button"
                  onClick={() => setIsProductSearchOpen(true)}
                  className="h-[34px] max-h-[34px] bg-[#5e2b9d] text-white px-3.5 rounded-[6px] text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Select Products Manually</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                    <tr>
                      <th className="py-2 px-3">Item Details</th>
                      <th className="py-2 px-3">Barcode</th>
                      <th className="py-2 px-3 text-right">Price</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-2.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item, index) => {
                      const lineTotal = item.price * item.quantity;
                      const rowKey =
                        item.cartId ||
                        (item.variantId ? `${item.productId}_${item.variantId}` : item.productId) ||
                        `cart_row_${index}`;
                      return (
                        <tr key={rowKey} className="hover:bg-slate-50/70 transition-colors">
                          {/* Item Details */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900 leading-tight">
                              {item.productName}
                            </div>
                            {item.variantName && (
                              <span className="inline-block mt-0.5 text-[10px] bg-purple-50 text-[#5e2b9d] px-1.5 py-0.2 rounded-[3px] font-medium">
                                {item.variantName}
                              </span>
                            )}
                          </td>

                          {/* Barcode */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] text-slate-500">
                              {item.barcode || "—"}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                            ₹{item.price.toFixed(2)}
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.cartId, -1)}
                                className="w-6 h-6 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-medium cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => setDirectQuantity(item.cartId, e.target.value)}
                                className="w-10 h-6 text-center border border-slate-200 rounded-[4px] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                              />
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.cartId, 1)}
                                className="w-6 h-6 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-medium cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-900 font-mono">
                            ₹{lineTotal.toFixed(2)}
                          </td>

                          {/* Delete Item */}
                          <td className="py-2.5 px-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemFromCart(item.cartId)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                              title="Remove item"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: CUSTOMER, PRICING BREAKDOWN, PAYMENT & SETTLE (4 or 5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-3">
            {/* 1. CUSTOMER SELECTION CARD */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wide">
                  Customer
                </span>
                {!selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCustomerModalOpen(true);
                      setAddCustomerError("");
                    }}
                    className="text-[11px] text-[#5e2b9d] hover:underline font-medium cursor-pointer"
                  >
                    + Add Customer
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                /* Selected Customer Banner */
                <div className="bg-purple-50/60 border border-purple-200/70 rounded-[6px] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#5e2b9d] text-white flex items-center justify-center font-medium text-xs">
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-900 leading-tight">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        {selectedCustomer.phone} {selectedCustomer.city ? `• ${selectedCustomer.city}` : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title="Change Customer"
                  >
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Customer Search Dropdown */
                <div className="relative">
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[2]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      placeholder="Search customer by name or phone..."
                      className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                    />
                  </div>

                  {/* Suggestions Popover */}
                  {isCustomerDropdownOpen && customerSearchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-[6px] shadow-lg z-30 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c, cIdx) => (
                          <div
                            key={c.id || `cust_${c.phone}_${cIdx}`}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsCustomerDropdownOpen(false);
                              setCustomerSearchQuery("");
                            }}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-medium text-slate-900">{c.name}</div>
                              <div className="text-[11px] font-mono text-slate-500">{c.phone}</div>
                            </div>
                            <span className="text-[10.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-[3px]">
                              {c.city}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center">
                          <p className="text-xs text-slate-500 mb-2">No matching customer found.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomerDropdownOpen(false);
                              setNewCustName(customerSearchQuery);
                              setIsAddCustomerModalOpen(true);
                            }}
                            className="h-[28px] bg-[#5e2b9d] text-white px-3 rounded-[4px] text-[11px] font-medium hover:bg-[#4e2284] cursor-pointer"
                          >
                            + Add &quot;{customerSearchQuery}&quot;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. PRICING BREAKDOWN & DISCOUNT CARD */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs space-y-2.5">
              <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wide block">
                Bill Summary
              </span>

              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal ({cart.reduce((s, it) => s + it.quantity, 0)} items)</span>
                <span className="font-mono font-medium text-slate-800">₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount Input & Selector */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">Discount</label>
                  <div className="flex items-center rounded-[4px] border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setDiscountType("FIXED")}
                      className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium transition-colors cursor-pointer ${
                        discountType === "FIXED"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ₹ (Flat)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("PERCENT")}
                      className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium transition-colors cursor-pointer ${
                        discountType === "PERCENT"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      % (Rate)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    placeholder={discountType === "FIXED" ? "Discount amount in ₹" : "Discount in %"}
                    className="w-full h-[32px] max-h-[32px] px-2.5 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                  {discountAmount > 0 && (
                    <span className="text-xs text-rose-600 font-mono font-medium whitespace-nowrap">
                      -₹{discountAmount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* GST Tax Breakdown */}
              {enableGst && totalGstRate > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span>CGST ({cgstPercent}%)</span>
                    <span className="font-mono">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span>SGST ({sgstPercent}%)</span>
                    <span className="font-mono">₹{sgst.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-800">Grand Total</span>
                <span className="text-lg font-mono font-medium text-[#5e2b9d]">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 3. PAYMENT METHOD SELECTION CARD */}
            <div className="bg-white border border-slate-200/80 rounded-[6px] p-3 shadow-2xs space-y-2.5">
              <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wide block">
                Payment Mode
              </span>

              {/* Payment Type Selector Pills with Icons & Distinct Color Shades */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    id: "CASH" as const,
                    label: "Cash",
                    icon: (
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm6 3.75a3 3 0 11-6 0 3 3 0 016 0zM6 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-2xs",
                    inactiveClass: "bg-emerald-50/70 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/80 hover:border-emerald-300",
                  },
                  {
                    id: "UPI" as const,
                    label: "UPI",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        {/* Top-Left Position Marker */}
                        <rect x="3" y="3" width="6" height="6" rx="1" strokeWidth="2" />
                        <rect x="5" y="5" width="2" height="2" fill="currentColor" />
                        {/* Top-Right Position Marker */}
                        <rect x="15" y="3" width="6" height="6" rx="1" strokeWidth="2" />
                        <rect x="17" y="5" width="2" height="2" fill="currentColor" />
                        {/* Bottom-Left Position Marker */}
                        <rect x="3" y="15" width="6" height="6" rx="1" strokeWidth="2" />
                        <rect x="5" y="17" width="2" height="2" fill="currentColor" />
                        {/* Data Modules */}
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
                      </svg>
                    ),
                    activeClass: "bg-blue-600 text-white border-blue-600 shadow-2xs",
                    inactiveClass: "bg-blue-50/70 text-blue-800 border-blue-200/80 hover:bg-blue-100/80 hover:border-blue-300",
                  },
                  {
                    id: "CARD" as const,
                    label: "Card",
                    icon: (
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6.75-10.5h18a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0120.25 21H3.75A2.25 2.25 0 011.5 18.75V7.5A2.25 2.25 0 013.75 5.25z" />
                      </svg>
                    ),
                    activeClass: "bg-[#5e2b9d] text-white border-[#5e2b9d] shadow-2xs",
                    inactiveClass: "bg-purple-50/70 text-purple-900 border-purple-200/80 hover:bg-purple-100/80 hover:border-purple-300",
                  },
                  {
                    id: "SPLIT" as const,
                    label: "Split",
                    icon: (
                      <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                    ),
                    activeClass: "bg-amber-600 text-white border-amber-600 shadow-2xs",
                    inactiveClass: "bg-amber-50/70 text-amber-900 border-amber-200/80 hover:bg-amber-100/80 hover:border-amber-300",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(item.id);
                      if (item.id === "SPLIT") {
                        autoFillSplitCash();
                      }
                    }}
                    className={`h-[34px] max-h-[34px] rounded-[6px] text-xs font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 px-2 ${
                      paymentMethod === item.id ? item.activeClass : item.inactiveClass
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* SPLIT PAYMENT DETAIL INPUTS */}
              {paymentMethod === "SPLIT" && (
                <div className="p-2.5 bg-amber-50/50 border border-amber-200/70 rounded-[6px] space-y-2 mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-600 mb-0.5">
                        UPI (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={splitAmounts.upi || ""}
                        onChange={(e) =>
                          setSplitAmounts({ ...splitAmounts, upi: Number(e.target.value) || 0 })
                        }
                        className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded-[4px] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-600 mb-0.5">
                        Cash (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={splitAmounts.cash || ""}
                        onChange={(e) =>
                          setSplitAmounts({ ...splitAmounts, cash: Number(e.target.value) || 0 })
                        }
                        className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded-[4px] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-600 mb-0.5">
                        Card (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={splitAmounts.card || ""}
                        onChange={(e) =>
                          setSplitAmounts({ ...splitAmounts, card: Number(e.target.value) || 0 })
                        }
                        className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded-[4px] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Split Balance Helper */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="font-mono text-slate-600">
                      Split Sum: ₹{currentSplitTotal.toFixed(2)}
                    </span>
                    {Math.abs(splitBalance) < 0.05 ? (
                      <span className="text-emerald-700 font-medium">✓ Matches Grand Total</span>
                    ) : (
                      <button
                        type="button"
                        onClick={autoFillSplitCash}
                        className="text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                      >
                        Auto-balance (Diff: ₹{splitBalance.toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. BILL ACTIONS: SAVE (HOLD) & SAVE & SETTLE */}
            <div className="grid grid-cols-2 gap-2">
              {/* SAVE BILL BUTTON (HOLD IN SAVED BILLS) */}
              <button
                type="button"
                onClick={handleSaveBillDraft}
                disabled={cart.length === 0 || savingDraft || settlingBill}
                className="h-[34px] max-h-[34px] rounded-[6px] border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {savingDraft ? (
                  <div className="w-3.5 h-3.5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>Save Bill</span>
              </button>

              {/* SAVE & SETTLE BILL BUTTON (STOCK DEDUCTION & SALE LOGGED) */}
              <button
                type="button"
                onClick={handleSettleBill}
                disabled={cart.length === 0 || settlingBill || savingDraft}
                className="h-[34px] max-h-[34px] rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {settlingBill ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                <span>Save & Settle</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL 1: BROWSE & SELECT PRODUCTS MANUALLY */}
        {isProductSearchOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-3.5 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-slate-900">Select Store Products</h3>
                    <p className="text-[11px] text-slate-500 font-normal">Click any item to add directly to current bill</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Search bar inside modal */}
              <div className="p-3 border-b border-slate-100">
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Filter by product title, category, or barcode..."
                  autoFocus
                  className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                />
              </div>

              {/* Products List */}
              <div className="p-3 overflow-y-auto max-h-[55vh] space-y-2">
                {filteredManualProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No products matched your search.
                  </div>
                ) : (
                  filteredManualProducts.map((p, pIdx) => (
                    <div
                      key={p.id || `p_${pIdx}`}
                      className="border border-slate-200/80 rounded-[6px] p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-900 leading-tight">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{p.categoryName || "Uncategorized"}</span>
                          {p.barcode && <span className="font-mono text-slate-400">#{p.barcode}</span>}
                        </div>
                      </div>

                      {p.hasVariations && Array.isArray(p.variants) && p.variants.length > 0 ? (
                        /* Variants dropdown/options */
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {p.variants.map((v: any, vIdx: number) => (
                            <button
                              key={v.id || `v_${vIdx}`}
                              type="button"
                              onClick={() => addProductToCart(p, v, 1)}
                              className="h-[28px] max-h-[28px] px-2 rounded-[4px] border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-[#5e2b9d] text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              + {v.name} (₹{v.price})
                            </button>
                          ))}
                        </div>
                      ) : (
                        /* Simple product add button */
                        <button
                          type="button"
                          onClick={() => addProductToCart(p, undefined, 1)}
                          className="h-[28px] max-h-[28px] px-3 rounded-[4px] bg-[#5e2b9d] text-white hover:bg-[#4e2284] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>+ Add (₹{p.price || 0})</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: ADD CUSTOMER QUICK MODAL */}
        {isAddCustomerModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="h-[48px] bg-[#f8fafc] border-b border-slate-200 px-4 flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-900">Add Customer & Select</h3>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="p-4 space-y-3">
                {addCustomerError && (
                  <div className="p-2 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {addCustomerError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Anand Sharma"
                    required
                    autoFocus
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    required
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d]"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(false)}
                    className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] cursor-pointer disabled:opacity-50"
                  >
                    {savingCustomer ? "Saving..." : "Save & Select"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: SAVED BILLS LIST (HOLD BILLS) */}
        {isSavedBillsModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3.5 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-amber-500/10 text-amber-800 flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-slate-900">Saved / On-Hold Bills</h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Resume any held draft bill to finish and settle
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedBillsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 overflow-y-auto max-h-[60vh] space-y-2">
                {savedBills.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No bills are currently on hold.
                  </div>
                ) : (
                  savedBills.map((sb, sbIdx) => (
                    <div
                      key={sb.id || `sb_${sbIdx}`}
                      className="border border-slate-200/80 rounded-[6px] p-3 hover:bg-amber-50/30 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-slate-900">
                            {sb.draftNumber}
                          </span>
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-[3px]">
                            {sb.totalItemsCount} items
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {sb.customer ? `${sb.customer.name} (${sb.customer.phone})` : "Walk-in Customer"} •{" "}
                          {new Date(sb.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-900 text-xs">
                          ₹{sb.grandTotal.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedBill(sb)}
                          className="h-[28px] max-h-[28px] px-2.5 rounded-[4px] bg-[#5e2b9d] text-white text-[11px] font-medium hover:bg-[#4e2284] transition-colors cursor-pointer"
                        >
                          Load Bill
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillToDelete(sb)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Discard Draft"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: PRINTABLE THERMAL RECEIPT / INVOICE MODAL */}
        {isReceiptModalOpen && settledReceipt && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Receipt Action Bar (Non-Printable) */}
              <div className="p-3 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between print:hidden">
                <span className="text-xs font-medium text-slate-700">Bill Settled Successfully</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-[28px] bg-[#5e2b9d] text-white px-2.5 rounded-[4px] text-[11px] font-medium hover:bg-[#4e2284] cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.056-.367-2.155-.367-3.28 0-4.418 3.582-8 8-8s8 3.582 8 8a7.965 7.965 0 01-.367 3.28m-15.266 0A7.962 7.962 0 004 10.549c0 4.418 3.582 8 8 8a7.96 7.96 0 006.72-3.69m-14.72 0h14.72" />
                    </svg>
                    <span>Print Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReceiptModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Thermal Slip Content */}
              <div id="thermal-receipt" className="p-4 text-[11px] font-mono text-slate-800 space-y-2 max-h-[75vh] overflow-y-auto">
                {/* Store Branding Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-2.5">
                  <div className="font-sans font-medium text-sm text-slate-900 tracking-wide uppercase">
                    {storeSettings?.name || "Retail Next Store"}
                  </div>
                  {storeSettings?.address && (
                    <div className="text-[10px] text-slate-500 font-normal">
                      {storeSettings.address}, {storeSettings.city}
                    </div>
                  )}
                  {storeSettings?.phone && (
                    <div className="text-[10px] text-slate-500 font-normal">
                      Ph: {storeSettings.phone}
                    </div>
                  )}
                  {storeSettings?.enableGst && storeSettings.gstNumber && (
                    <div className="text-[10px] text-slate-600 font-normal mt-0.5">
                      GSTIN: {storeSettings.gstNumber}
                    </div>
                  )}
                </div>

                {/* Invoice Metadata */}
                <div className="border-b border-dashed border-slate-300 pb-2 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Invoice:</span>
                    <span className="font-medium">{settledReceipt.billNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{new Date(settledReceipt.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>{settledReceipt.customer?.name || "Walk-in"}</span>
                  </div>
                  {settledReceipt.customer?.phone && (
                    <div className="flex justify-between">
                      <span>Phone:</span>
                      <span>{settledReceipt.customer.phone}</span>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <table className="w-full text-[10px] border-b border-dashed border-slate-300 pb-2">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left pb-1 font-normal">Item</th>
                      <th className="text-center pb-1 font-normal">Qty</th>
                      <th className="text-right pb-1 font-normal">Rate</th>
                      <th className="text-right pb-1 font-normal">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settledReceipt.items.map((it: any, i: number) => (
                      <tr key={it.cartId || it.variantId || it.productId || `rec_item_${i}`}>
                        <td className="py-1">
                          <div className="leading-tight">{it.productName}</div>
                          {it.variantName && (
                            <div className="text-[9px] text-slate-400">{it.variantName}</div>
                          )}
                        </td>
                        <td className="text-center py-1">{it.quantity}</td>
                        <td className="text-right py-1">₹{it.price}</td>
                        <td className="text-right py-1 font-medium">₹{it.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Breakdown */}
                <div className="text-[10.5px] space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{settledReceipt.subtotal.toFixed(2)}</span>
                  </div>
                  {settledReceipt.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span>-₹{settledReceipt.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {settledReceipt.cgst > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>CGST:</span>
                      <span>₹{settledReceipt.cgst.toFixed(2)}</span>
                    </div>
                  )}
                  {settledReceipt.sgst > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>SGST:</span>
                      <span>₹{settledReceipt.sgst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-medium pt-1.5 border-t border-dashed border-slate-300">
                    <span>GRAND TOTAL:</span>
                    <span className="font-medium">₹{settledReceipt.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                    <span>Payment Mode:</span>
                    <span className="font-medium uppercase">{settledReceipt.paymentMethod}</span>
                  </div>
                  {settledReceipt.paymentMethod === "SPLIT" && settledReceipt.splitDetails && (
                    <div className="text-[9.5px] text-slate-400 pl-2">
                      UPI: ₹{settledReceipt.splitDetails.upi} | Cash: ₹{settledReceipt.splitDetails.cash} | Card: ₹{settledReceipt.splitDetails.card}
                    </div>
                  )}
                </div>

                {/* Footer Note */}
                <div className="text-center text-[9.5px] text-slate-400 pt-3 border-t border-dashed border-slate-200">
                  Thank you for shopping with us!
                </div>
              </div>

              {/* Close / Next Sale Button */}
              <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="h-[32px] max-h-[32px] w-full rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] cursor-pointer"
                >
                  Start New Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODALS */}
        {/* Delete Saved Draft Confirm */}
        <ConfirmModal
          isOpen={billToDelete !== null}
          title="Discard Saved Bill"
          message={`Are you sure you want to discard saved draft "${billToDelete?.draftNumber}"?`}
          confirmText="Discard Draft"
          cancelText="Keep"
          confirmVariant="danger"
          loading={deletingSavedBill}
          onConfirm={handleConfirmDeleteSavedBill}
          onClose={() => setBillToDelete(null)}
        />

        {/* Clear Current Cart Confirm */}
        <ConfirmModal
          isOpen={isClearCartConfirmOpen}
          title="Clear Current Bill"
          message="Are you sure you want to remove all items from the current bill?"
          confirmText="Clear Items"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={false}
          onConfirm={handleClearCart}
          onClose={() => setIsClearCartConfirmOpen(false)}
        />
      </div>
    </SoftwareLayout>
  );
}
