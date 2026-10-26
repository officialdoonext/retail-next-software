"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SoftwareLayout from "@/components/SoftwareLayout";

// Types
interface CustomerData {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  birthDate?: string;
  hasBirthDate?: boolean;
  anniversaryDate?: string;
  hasAnniversary?: boolean;
  cardNo?: string;
  cardValidity?: string;
  entryDate?: string;
  pin?: string;
  tin?: string;
  branch?: string;
  ledger?: string;
  stopCredit?: boolean;
  opCreditBalance?: number;
  creditDays?: number;
  creditLimit?: number;
  customerGroup?: string;
  classification?: string;
  landline?: string;
  billCycle?: number;
  opSales?: number;
  remarks?: string;
  gstNumber?: string;
  placeOfSupply?: string;
  discountPercent?: number;
  applyDiscountNonDisc?: boolean;
  isInactive?: boolean;
  blockTSms?: boolean;
  blockPSms?: boolean;
  blockWa?: boolean;
  dontFollowup?: boolean;
  totalPurchases?: number;
  totalSpend?: number;
  loyaltyPoints?: number;
  createdAt?: number;
}

interface OrderItem {
  sku?: string;
  barcode?: string;
  productName?: string;
  variantName?: string;
  price?: number;
  salePrice?: number;
  listPrice?: number;
  quantity?: number;
  total?: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  isTaxInclusive?: boolean;
  employeeName?: string;
  [key: string]: any;
}

interface OrderData {
  id: string;
  billNumber: string;
  storeId?: string;
  status: string;
  customer?: { id?: string; name?: string; phone?: string };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  total: number;
  paymentMethod: string;
  splitDetails?: any;
  couponCode?: string;
  couponDiscount?: number;
  customerDiscount?: number;
  settledBy?: string;
  createdAt: number;
}

interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderNumber: string;
  type: "RETURN" | "EXCHANGE";
  customer: { id?: string; name?: string; phone?: string };
  items: any[];
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: string;
  staffName: string;
  createdAt: number;
}

export default function IndividualCustomerPage() {
  return (
    <Suspense
      fallback={
        <SoftwareLayout>
          <div className="w-full h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#5e2b9d] border-t-transparent rounded-full animate-spin" />
          </div>
        </SoftwareLayout>
      }
    >
      <IndividualCustomerContent />
    </Suspense>
  );
}

function IndividualCustomerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState<CustomerData[]>([]);

  // Active Selected Customer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Active Tab: 'profile' | 'orders' | 'returns'
  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "returns">("profile");

  // Orders State
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrderModal, setSelectedOrderModal] = useState<OrderData | null>(null);

  // Returns / Exchange State
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnTypeFilter, setReturnTypeFilter] = useState<"ALL" | "RETURN" | "EXCHANGE">("ALL");
  const [selectedReturnModal, setSelectedReturnModal] = useState<ReturnRecord | null>(null);

  // New Return Modal State
  const [isRecordReturnOpen, setIsRecordReturnOpen] = useState(false);
  const [newReturnType, setNewReturnType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [newReturnOrderNumber, setNewReturnOrderNumber] = useState("");
  const [newReturnReason, setNewReturnReason] = useState("Defective item or wrong size");
  const [newReturnAmount, setNewReturnAmount] = useState<string>("");
  const [newReturnMethod, setNewReturnMethod] = useState("CASH");
  const [newReturnSubmitting, setNewReturnSubmitting] = useState(false);

  // Notifications
  const [toastMsg, setToastMsg] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch initial quick recent customers for suggestions
  useEffect(() => {
    async function loadRecentCustomers() {
      try {
        const res = await fetch("/api/customers?limit=6");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.customers)) {
            setRecentCustomers(data.customers.slice(0, 6));
          }
        }
      } catch {
        // ignore
      }
    }
    loadRecentCustomers();
  }, []);

  // Check URL params on mount (e.g. ?id=xxx or ?phone=xxx)
  useEffect(() => {
    const paramId = searchParams.get("id");
    const paramPhone = searchParams.get("phone");
    const paramSearch = searchParams.get("search");

    if (paramId || paramPhone || paramSearch) {
      const term = paramId || paramPhone || paramSearch || "";
      handleFetchCustomerByIdOrPhone(term);
    }
  }, [searchParams]);

  // Fetch customer by ID or Phone
  const handleFetchCustomerByIdOrPhone = async (identifier: string) => {
    if (!identifier) return;
    setLoadingCustomer(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(identifier)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.customers) && data.customers.length > 0) {
          // Exact match by ID or phone if possible, else first result
          const matched =
            data.customers.find((c: CustomerData) => c.id === identifier || c.phone === identifier) ||
            data.customers[0];
          handleSelectCustomer(matched);
        }
      }
    } catch {
      showToast("Failed to fetch customer data.");
    } finally {
      setLoadingCustomer(false);
    }
  };

  // Debounced live customer search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.customers)) {
            setSearchResults(data.customers);
            setIsDropdownOpen(true);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Select a customer
  const handleSelectCustomer = (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setActiveTab("profile");

    // Load their orders and returns
    loadCustomerOrders(customer);
    loadCustomerReturns(customer);
  };

  // Load customer orders
  const loadCustomerOrders = async (customer: CustomerData) => {
    setLoadingOrders(true);
    try {
      let url = `/api/orders?allStores=true&limit=100`;
      if (customer.id) {
        url += `&customerId=${encodeURIComponent(customer.id)}`;
      } else if (customer.phone) {
        url += `&customerPhone=${encodeURIComponent(customer.phone)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else {
          setOrders([]);
        }
      }
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load customer returns & exchanges
  const loadCustomerReturns = async (customer: CustomerData) => {
    setLoadingReturns(true);
    try {
      let url = `/api/returns?limit=100`;
      if (customer.id) {
        url += `&customerId=${encodeURIComponent(customer.id)}`;
      } else if (customer.phone) {
        url += `&customerPhone=${encodeURIComponent(customer.phone)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.returns)) {
          setReturns(data.returns);
        } else {
          setReturns([]);
        }
      }
    } catch {
      setReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  };

  // Submit a new return/exchange against an order
  const handleCreateReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    if (!newReturnOrderNumber.trim()) {
      showToast("Please select or enter the invoice/bill number.");
      return;
    }

    const amountNum = parseFloat(newReturnAmount) || 0;
    if (amountNum <= 0) {
      showToast("Please enter a valid refund/exchange amount.");
      return;
    }

    setNewReturnSubmitting(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newReturnType,
          orderNumber: newReturnOrderNumber.trim(),
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          refundAmount: amountNum,
          refundMethod: newReturnMethod,
          reason: newReturnReason.trim(),
          items: [
            {
              productName: `Item from ${newReturnOrderNumber}`,
              quantity: 1,
              price: amountNum,
              reason: newReturnReason,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Failed to process return.");
      } else {
        showToast(`${newReturnType === "EXCHANGE" ? "Exchange" : "Return"} recorded successfully!`);
        setIsRecordReturnOpen(false);
        setNewReturnAmount("");
        setNewReturnOrderNumber("");

        // Refresh returns & orders
        loadCustomerReturns(selectedCustomer);
        loadCustomerOrders(selectedCustomer);
      }
    } catch {
      showToast("Network error while recording return.");
    } finally {
      setNewReturnSubmitting(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.billNumber?.toLowerCase().includes(q) ||
        o.paymentMethod?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q) ||
        o.items?.some((it) => it.productName?.toLowerCase().includes(q))
    );
  }, [orders, orderSearch]);

  // Filtered returns
  const filteredReturns = useMemo(() => {
    if (returnTypeFilter === "ALL") return returns;
    return returns.filter((r) => r.type === returnTypeFilter);
  }, [returns, returnTypeFilter]);

  // Aggregate Return / Exchange Counts
  const returnsCount = useMemo(() => returns.filter((r) => r.type === "RETURN").length, [returns]);
  const exchangesCount = useMemo(() => returns.filter((r) => r.type === "EXCHANGE").length, [returns]);
  const totalRefundAmount = useMemo(
    () => returns.reduce((acc, curr) => acc + curr.refundAmount, 0),
    [returns]
  );

  // Total Billed Amount from actual orders
  const totalBilledAmount = useMemo(
    () => orders.reduce((acc, curr) => acc + (Number(curr.grandTotal) || Number(curr.total) || 0), 0),
    [orders]
  );

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 pb-12 animate-in fade-in duration-150">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1e1b4b] text-white px-4 py-3 rounded-[6px] shadow-lg flex items-center gap-2.5 text-xs font-medium border border-purple-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Breadcrumb Navigation & Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <Link href="/dashboard" className="hover:text-[#5e2b9d] transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/customers" className="hover:text-[#5e2b9d] transition-colors">
                Customer Manager
              </Link>
              <span>/</span>
              <span className="text-[#5e2b9d] font-medium">Individual Customer</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Individual Customer Profile
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              360° deep customer view: complete profile, purchase invoice history, and return/exchange ledger.
            </p>
          </div>

          {/* Quick Actions */}
          {selectedCustomer && (
            <div className="flex items-center gap-2">
              <Link
                href={`/pos?customerId=${selectedCustomer.id}&phone=${selectedCustomer.phone}`}
                className="h-[34px] px-3.5 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>New POS Bill</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setOrders([]);
                  setReturns([]);
                  setSearchQuery("");
                }}
                className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Change Customer</span>
              </button>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* CUSTOMER SEARCH BAR (Always accessible at top)                       */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-[8px] border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1" ref={searchBoxRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  )}
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setIsDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResults.length > 0) {
                      handleSelectCustomer(searchResults[0]);
                    }
                  }}
                  placeholder="Search customer by name, mobile number, or customer code..."
                  className="w-full h-[40px] pl-10 pr-10 rounded-[6px] border border-slate-200 bg-slate-50/60 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:bg-white focus:ring-1 focus:ring-[#5e2b9d]/20 transition-all font-medium"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setIsDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs w-5 h-5 flex items-center justify-center rounded cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Live Search Suggestion Dropdown */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-[8px] border border-slate-200 shadow-xl z-40 max-h-80 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-normal">
                      No matching customer found for &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    searchResults.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className="p-3 hover:bg-purple-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-[#5e2b9d] font-bold flex items-center justify-center text-xs shrink-0">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{cust.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {cust.customerCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>📱 {cust.phone || "No phone"}</span>
                              {cust.city && <span>• 📍 {cust.city}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-semibold text-emerald-700 block">
                            ₹{(cust.totalPurchases || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400">Total Spend</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* If a customer is selected, show active badge */}
            {selectedCustomer && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200/70 rounded-[6px] text-xs text-[#5e2b9d] shrink-0 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Active: <b>{selectedCustomer.name}</b></span>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* CONDITIONAL CONTENT: EMPTY STATE vs CUSTOMER SELECTED 360° DASHBOARD */}
        {/* ==================================================================== */}
        {!selectedCustomer ? (
          /* EMPTY STATE (As requested: "first every thing be empty and i need search bar") */
          <div className="bg-white rounded-[10px] border border-slate-200/90 p-8 sm:p-14 text-center shadow-2xs flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-purple-50 border border-purple-100 text-[#5e2b9d] flex items-center justify-center mb-4 shadow-xs">
              <svg className="w-8 h-8 stroke-[1.7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mb-1.5">
              Select a Customer to View Detailed History
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed font-normal">
              Type a customer&apos;s name or 10-digit mobile number in the search bar above to inspect their profile details, complete order bills, and return/exchange records.
            </p>

            {/* Quick Suggestions from Recent Customers */}
            {recentCustomers.length > 0 && (
              <div className="w-full max-w-2xl text-left border-t border-slate-100 pt-6">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-3 text-center sm:text-left">
                  Or select a customer directly:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {recentCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="p-3 rounded-[6px] border border-slate-200 bg-slate-50/60 hover:bg-purple-50/60 hover:border-purple-200 transition-all text-left flex items-center gap-2.5 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 group-hover:border-[#5e2b9d] text-slate-700 group-hover:text-[#5e2b9d] font-bold text-xs flex items-center justify-center shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-xs text-slate-800 block truncate group-hover:text-[#5e2b9d]">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          📱 {c.phone || "No phone"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* CUSTOMER 360° PROFILE VIEW (Header + Tabs + Content)                 */
          /* ==================================================================== */
          <div className="space-y-4">
            {/* Customer Summary Hero Card */}
            <div className="bg-white rounded-[10px] border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100">
                {/* Left: Customer Identity */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5e2b9d] to-[#7c3aed] text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                    {selectedCustomer.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                        {selectedCustomer.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-purple-50 text-[#5e2b9d] border border-purple-200">
                        {selectedCustomer.customerCode}
                      </span>
                      {selectedCustomer.isInactive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          Inactive
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                      {selectedCustomer.customerGroup && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {selectedCustomer.customerGroup}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <span>📱</span> {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <span>✉️</span> {selectedCustomer.email}
                        </span>
                      )}
                      {selectedCustomer.city && (
                        <span className="flex items-center gap-1">
                          <span>📍</span> {selectedCustomer.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Stat Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-2.5 text-center min-w-[110px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Total Purchases
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5 text-emerald-700">
                      ₹{totalBilledAmount > 0 ? totalBilledAmount.toLocaleString() : (selectedCustomer.totalPurchases || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-2.5 text-center min-w-[110px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Orders Count
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      {loadingOrders ? "..." : `${orders.length} Bills`}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-2.5 text-center min-w-[110px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Returns / Exch
                    </span>
                    <span className="text-sm font-bold text-rose-600 block mt-0.5">
                      {loadingReturns ? "..." : `${returns.length} Records`}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-2.5 text-center min-w-[110px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Loyalty Points
                    </span>
                    <span className="text-sm font-bold text-[#5e2b9d] block mt-0.5">
                      {selectedCustomer.loyaltyPoints || 0} Pts
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB NAVIGATION BAR */}
              <div className="flex items-center gap-1 px-4 sm:px-5 bg-slate-50/70 border-t border-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "profile"
                      ? "border-[#5e2b9d] text-[#5e2b9d] bg-white shadow-2xs"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Customer Profile Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "orders"
                      ? "border-[#5e2b9d] text-[#5e2b9d] bg-white shadow-2xs"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Orders & Bills ({orders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("returns")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "returns"
                      ? "border-[#5e2b9d] text-[#5e2b9d] bg-white shadow-2xs"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Returns & Exchanges ({returns.length})</span>
                </button>
              </div>
            </div>

            {/* ================================================================ */}
            {/* TAB 1: PROFILE DETAILS                                           */}
            {/* ================================================================ */}
            {activeTab === "profile" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-100">
                {/* 1. Personal & Contact Details */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <svg className="w-4 h-4 text-[#5e2b9d] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Contact & Address Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Customer Name</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.name}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Customer Code</span>
                      <span className="font-mono font-semibold text-[#5e2b9d]">{selectedCustomer.customerCode}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Primary Mobile</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.phone || "—"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Landline / Alt Phone</span>
                      <span className="font-medium text-slate-700">{selectedCustomer.landline || "—"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Email Address</span>
                      <span className="font-medium text-slate-800">{selectedCustomer.email || "—"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Street Address</span>
                      <span className="font-medium text-slate-800">{selectedCustomer.address || "—"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">City</span>
                      <span className="font-medium text-slate-800">{selectedCustomer.city || "—"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">PIN Code</span>
                      <span className="font-medium text-slate-800">{selectedCustomer.pin || "—"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Place of Supply</span>
                      <span className="font-medium text-slate-800">{selectedCustomer.placeOfSupply || "37-Andhra Pradesh"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Membership & Special Dates */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <svg className="w-4 h-4 text-[#5e2b9d] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Important Dates & Membership
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Date of Birth</span>
                      <span className="font-semibold text-slate-800">
                        {selectedCustomer.birthDate || "Not recorded"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Anniversary Date</span>
                      <span className="font-semibold text-slate-800">
                        {selectedCustomer.anniversaryDate || "Not recorded"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Membership Card No</span>
                      <span className="font-mono text-slate-700">{selectedCustomer.cardNo || "Standard"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Card Validity</span>
                      <span className="text-slate-700">{selectedCustomer.cardValidity || "Lifetime"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Customer Group</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.customerGroup || "Retail"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Classification</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.classification || "General"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Registered Since</span>
                      <span className="text-slate-700">
                        {selectedCustomer.entryDate ||
                          (selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString() : "—")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Credit Terms & Ledger */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <svg className="w-4 h-4 text-[#5e2b9d] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Credit Limit & Financial Ledger
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Ledger Account</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.ledger || "Sundry Debtors"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Stop Credit</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedCustomer.stopCredit ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {selectedCustomer.stopCredit ? "BLOCKED" : "NO"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Credit Limit</span>
                      <span className="font-bold text-slate-900">₹{(selectedCustomer.creditLimit || 0).toLocaleString()}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Credit Allowed Days</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.creditDays || 0} days</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Opening Credit Balance</span>
                      <span className="font-medium text-slate-700">₹{(selectedCustomer.opCreditBalance || 0).toLocaleString()}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Billing Cycle</span>
                      <span className="font-medium text-slate-700">{selectedCustomer.billCycle || 1} day(s)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Tax Compliance, Discount & Remarks */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <svg className="w-4 h-4 text-[#5e2b9d] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Tax, Discount Rules & Notes
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">GSTIN / Tax Number</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedCustomer.gstNumber || "Unregistered"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block font-normal">Special Discount %</span>
                      <span className="font-bold text-[#5e2b9d]">{selectedCustomer.discountPercent || 0}%</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Communication Channels</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          selectedCustomer.blockTSms ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {selectedCustomer.blockTSms ? "SMS Blocked" : "SMS Allowed"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          selectedCustomer.blockWa ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {selectedCustomer.blockWa ? "WhatsApp Blocked" : "WhatsApp Allowed"}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block font-normal">Remarks & Staff Notes</span>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs italic mt-0.5">
                        {selectedCustomer.remarks || "No special notes recorded for this customer."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 2: ORDERS & INVOICE BILLS                                    */}
            {/* ================================================================ */}
            {activeTab === "orders" && (
              <div className="space-y-3.5 animate-in fade-in duration-100">
                {/* Orders Filter & Search Bar */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="relative flex-1 max-w-sm">
                    <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Filter by bill no, payment method..."
                      className="w-full h-[32px] pl-8 pr-3 rounded-[6px] border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Showing <b className="text-slate-900">{filteredOrders.length}</b> bills</span>
                    <span>•</span>
                    <span>Total Billed: <b className="text-emerald-700">₹{totalBilledAmount.toLocaleString()}</b></span>
                  </div>
                </div>

                {/* Orders Data Table */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3.5">Bill Number</th>
                          <th className="py-2.5 px-3.5">Date & Time</th>
                          <th className="py-2.5 px-3.5">Items Purchased</th>
                          <th className="py-2.5 px-3.5 text-right">Subtotal</th>
                          <th className="py-2.5 px-3.5 text-right">Discount</th>
                          <th className="py-2.5 px-3.5 text-right">Grand Total</th>
                          <th className="py-2.5 px-3.5">Payment</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingOrders ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <span>Loading customer invoices...</span>
                            </td>
                          </tr>
                        ) : filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-10 text-center text-slate-400">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                                🛒
                              </div>
                              <span className="font-semibold block text-slate-600">No invoices found</span>
                              <span className="text-[11px] text-slate-400">
                                This customer has no recorded orders yet.
                              </span>
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((order) => {
                            const actualItems = Array.isArray(order.items)
                              ? order.items.filter((it) => !it._isBillMeta && !it._isReturnMeta)
                              : [];
                            const itemsCount = actualItems.reduce((acc, it) => acc + (it.quantity || 1), 0);

                            return (
                              <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3.5 font-mono font-semibold text-[#5e2b9d] whitespace-nowrap">
                                  {order.billNumber}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600">
                                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}{" "}
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 max-w-xs">
                                  <div className="font-medium text-slate-800 truncate">
                                    {actualItems.map((it) => it.productName || it.sku).filter(Boolean).slice(0, 2).join(", ")}
                                    {actualItems.length > 2 && ` +${actualItems.length - 2} more`}
                                  </div>
                                  <span className="text-[11px] text-slate-400">
                                    {itemsCount} {itemsCount === 1 ? "unit" : "units"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                                  ₹{order.subtotal?.toLocaleString() || "0"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-medium text-rose-600 whitespace-nowrap">
                                  {order.discount > 0 ? `-₹${order.discount?.toLocaleString()}` : "—"}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                  ₹{(order.grandTotal || order.total || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    {order.paymentMethod || "CASH"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      order.status?.toLowerCase().includes("return")
                                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                                        : order.status?.toLowerCase().includes("exchange")
                                        ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {order.status || "Completed"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrderModal(order)}
                                    className="h-7 px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    View Bill
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 3: RETURNS & EXCHANGES                                       */}
            {/* ================================================================ */}
            {activeTab === "returns" && (
              <div className="space-y-3.5 animate-in fade-in duration-100">
                {/* Top Stat Summary of Returns / Exchange Frequency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-[8px] border border-slate-200/90 p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Times Returned
                      </span>
                      <span className="text-xl font-bold text-rose-600 block mt-0.5">
                        {returnsCount} {returnsCount === 1 ? "Time" : "Times"}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                      ↩
                    </div>
                  </div>

                  <div className="bg-white rounded-[8px] border border-slate-200/90 p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Times Exchanged
                      </span>
                      <span className="text-xl font-bold text-indigo-600 block mt-0.5">
                        {exchangesCount} {exchangesCount === 1 ? "Time" : "Times"}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      ⇄
                    </div>
                  </div>

                  <div className="bg-white rounded-[8px] border border-slate-200/90 p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Refund / Exch Value
                      </span>
                      <span className="text-xl font-bold text-slate-900 block mt-0.5">
                        ₹{totalRefundAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-sm">
                      ₹
                    </div>
                  </div>
                </div>

                {/* Filter Bar & "Record Return" Action */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  {/* Type Filter Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReturnTypeFilter("ALL")}
                      className={`h-7 px-3 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                        returnTypeFilter === "ALL"
                          ? "bg-[#5e2b9d] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All ({returns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnTypeFilter("RETURN")}
                      className={`h-7 px-3 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                        returnTypeFilter === "RETURN"
                          ? "bg-rose-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Returns Only ({returnsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnTypeFilter("EXCHANGE")}
                      className={`h-7 px-3 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                        returnTypeFilter === "EXCHANGE"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Exchanges Only ({exchangesCount})
                    </button>
                  </div>

                  {/* Record Return / Exchange Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (orders.length > 0) {
                        setNewReturnOrderNumber(orders[0].billNumber);
                      }
                      setIsRecordReturnOpen(true);
                    }}
                    className="h-8 px-3.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Record Return / Exchange</span>
                  </button>
                </div>

                {/* Returns Data Table */}
                <div className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3.5">Return ID</th>
                          <th className="py-2.5 px-3.5">Type</th>
                          <th className="py-2.5 px-3.5">Date & Time</th>
                          <th className="py-2.5 px-3.5">Original Invoice</th>
                          <th className="py-2.5 px-3.5">Returned Items</th>
                          <th className="py-2.5 px-3.5">Reason</th>
                          <th className="py-2.5 px-3.5 text-right">Refund Amount</th>
                          <th className="py-2.5 px-3.5">Refund Method</th>
                          <th className="py-2.5 px-3.5">Staff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingReturns ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <span>Loading return history...</span>
                            </td>
                          </tr>
                        ) : filteredReturns.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                                🛡️
                              </div>
                              <span className="font-semibold block text-slate-700">Clean Customer Record</span>
                              <span className="text-[11px] text-slate-400">
                                No returns or exchanges recorded for this customer yet.
                              </span>
                            </td>
                          </tr>
                        ) : (
                          filteredReturns.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3.5 font-mono font-semibold text-[#5e2b9d] whitespace-nowrap">
                                {record.returnNumber}
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    record.type === "RETURN"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  }`}
                                >
                                  {record.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600">
                                {new Date(record.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono font-medium text-slate-700 whitespace-nowrap">
                                {record.orderNumber || "—"}
                              </td>
                              <td className="py-2.5 px-3.5 max-w-xs text-slate-800 font-medium">
                                {Array.isArray(record.items) && record.items.length > 0
                                  ? record.items.map((it: any) => it.productName || it.sku || "Product").join(", ")
                                  : "Returned products"}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600 italic">
                                {record.reason || "Customer request"}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-bold text-rose-600 whitespace-nowrap">
                                ₹{record.refundAmount.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {record.refundMethod || "CASH"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                                {record.staffName || "Staff"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* INVOICE DETAILS MODAL                                                */}
        {/* ==================================================================== */}
        {selectedOrderModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Invoice Details</h3>
                  <p className="text-[11px] text-purple-200 font-mono">#{selectedOrderModal.billNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderModal(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                    <span className="font-bold text-slate-900 block text-xs mt-0.5">
                      {selectedOrderModal.customer?.name || selectedCustomer?.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      📱 {selectedOrderModal.customer?.phone || selectedCustomer?.phone}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Cashier</span>
                    <span className="font-semibold text-slate-800 block text-xs mt-0.5">
                      {new Date(selectedOrderModal.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Billed by: {selectedOrderModal.settledBy || "Cashier"}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3.5 py-2 font-bold text-slate-700 text-[11px] uppercase tracking-wider border-b border-slate-200">
                    Billed Products
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {selectedOrderModal.items
                      .filter((it) => !it._isBillMeta && !it._isReturnMeta)
                      .map((it, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-semibold text-slate-900 block">{it.productName || it.sku}</span>
                            {it.variantName && (
                              <span className="text-[11px] text-[#5e2b9d] block">{it.variantName}</span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              Qty: {it.quantity} × ₹{it.salePrice || it.price}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900">
                            ₹{(it.total || (it.salePrice || it.price || 0) * (it.quantity || 1)).toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Subtotal</span>
                    <span>₹{selectedOrderModal.subtotal?.toLocaleString()}</span>
                  </div>
                  {selectedOrderModal.discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Total Discounts</span>
                      <span>-₹{selectedOrderModal.discount?.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedOrderModal.tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST Tax</span>
                      <span>₹{selectedOrderModal.tax?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span>₹{(selectedOrderModal.grandTotal || selectedOrderModal.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Paid via: <b className="text-slate-900">{selectedOrderModal.paymentMethod || "CASH"}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrderModal(null)}
                  className="h-8 px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-semibold hover:bg-[#4e2284] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* RECORD RETURN / EXCHANGE MODAL                                       */}
        {/* ==================================================================== */}
        {isRecordReturnOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col">
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold tracking-tight">Record Return or Exchange</h3>
                <button
                  type="button"
                  onClick={() => setIsRecordReturnOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateReturnSubmit} className="p-5 space-y-4 text-xs">
                {/* Type Selection */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Operation Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewReturnType("RETURN")}
                      className={`h-9 rounded-[6px] font-semibold text-xs border flex items-center justify-center gap-1.5 cursor-pointer ${
                        newReturnType === "RETURN"
                          ? "bg-rose-50 border-rose-300 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span>↩ Product Return (Refund)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewReturnType("EXCHANGE")}
                      className={`h-9 rounded-[6px] font-semibold text-xs border flex items-center justify-center gap-1.5 cursor-pointer ${
                        newReturnType === "EXCHANGE"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span>⇄ Product Exchange</span>
                    </button>
                  </div>
                </div>

                {/* Original Bill Selection */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Select Customer Bill / Invoice #
                  </label>
                  {orders.length > 0 ? (
                    <select
                      value={newReturnOrderNumber}
                      onChange={(e) => setNewReturnOrderNumber(e.target.value)}
                      className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                    >
                      {orders.map((o) => (
                        <option key={o.id} value={o.billNumber}>
                          {o.billNumber} — ₹{o.grandTotal || o.total} ({new Date(o.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newReturnOrderNumber}
                      onChange={(e) => setNewReturnOrderNumber(e.target.value)}
                      placeholder="e.g. INV-20261026-0001"
                      className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                    />
                  )}
                </div>

                {/* Refund / Value Amount */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    {newReturnType === "RETURN" ? "Refund Amount (₹)" : "Exchanged Item Value (₹)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={newReturnAmount}
                    onChange={(e) => setNewReturnAmount(e.target.value)}
                    placeholder="Enter amount in ₹"
                    required
                    className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                {/* Refund Method */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Settlement Method
                  </label>
                  <select
                    value={newReturnMethod}
                    onChange={(e) => setNewReturnMethod(e.target.value)}
                    className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                  >
                    <option value="CASH">Cash Refund</option>
                    <option value="UPI">UPI / Online Transfer</option>
                    <option value="STORE_CREDIT">Store Credit / Credit Note</option>
                    <option value="CARD">Original Card Reverse</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Reason for Return / Exchange
                  </label>
                  <input
                    type="text"
                    value={newReturnReason}
                    onChange={(e) => setNewReturnReason(e.target.value)}
                    placeholder="e.g. Size mismatch, defective fabric, customer choice"
                    className="w-full h-[36px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#5e2b9d]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRecordReturnOpen(false)}
                    className="h-8 px-3 rounded-[6px] border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={newReturnSubmitting}
                    className="h-8 px-4 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {newReturnSubmitting ? "Processing..." : "Confirm & Save Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SoftwareLayout>
  );
}
