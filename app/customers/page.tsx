"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import CustomerModal, { CustomerFormData } from "@/components/CustomerModal";
import BulkUploadCustomerModal from "@/components/BulkUploadCustomerModal";
import { useToast } from "@/components/ToastProvider";

interface CustomerItem extends CustomerFormData {
  id: string;
  totalPurchases?: number;
  totalSpend?: number;
  loyaltyPoints?: number;
  storeId?: string;
  businessId?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface PaginationInfo {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function CustomersPage() {
  const toast = useToast();

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [allExistingCustomers, setAllExistingCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL");
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("all"); // all, active, inactive

  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    totalPages: 1,
    page: 1,
    limit: 24,
    hasMore: false,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerFormData | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // View Details Modal
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);

  // Delete Confirmation State
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch paginated customers (strictly 24 per page)
  const fetchCustomers = useCallback(
    async (pageToFetch = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(pageToFetch),
          limit: "24",
        });

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (selectedCity !== "ALL") {
          params.set("city", selectedCity);
        }
        if (selectedGroup !== "ALL") {
          params.set("group", selectedGroup);
        }
        if (selectedStatus !== "all") {
          params.set("status", selectedStatus);
        }

        const res = await fetch(`/api/customers?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setCustomers(data.customers || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        } else {
          toast.error(data.error || "Failed to load customers.");
        }
      } catch (err: any) {
        console.error("Error fetching customers:", err);
        toast.error("Network error while loading customers.");
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, selectedCity, selectedGroup, selectedStatus, toast]
  );

  // Fetch all customers once for duplicate live check in the modal
  const fetchAllForLiveCheck = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?all=true");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.customers)) {
        setAllExistingCustomers(data.customers);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchCustomers(1);
  }, [fetchCustomers]);

  useEffect(() => {
    fetchAllForLiveCheck();
  }, [fetchAllForLiveCheck]);

  // Debounced search handling
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Open Add Customer Modal
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditModal = (cust: CustomerItem) => {
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

  // After customer saved
  const handleCustomerSaved = () => {
    fetchCustomers(pagination.page);
    fetchAllForLiveCheck();
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/customers?id=${deletingCustomer.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Customer removed successfully.");
        setDeletingCustomer(null);
        fetchCustomers(pagination.page);
        fetchAllForLiveCheck();
      } else {
        toast.error(data.error || "Failed to delete customer.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Derived Cities & Groups for Filters
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    allExistingCustomers.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set);
  }, [allExistingCustomers]);

  // Quick stats
  const totalCustomerCount = pagination.total;
  const activeCustomerCount = useMemo(() => {
    return allExistingCustomers.filter((c) => !c.isInactive).length;
  }, [allExistingCustomers]);

  const totalCreditExposure = useMemo(() => {
    return allExistingCustomers.reduce((acc, c) => acc + (Number(c.creditLimit) || 0), 0);
  }, [allExistingCustomers]);

  const totalLifetimePurchases = useMemo(() => {
    return allExistingCustomers.reduce((acc, c) => acc + (Number(c.totalPurchases) || 0), 0);
  }, [allExistingCustomers]);

  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-7xl mx-auto pb-12">
        
        {/* Top Header & Metrics Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Customers Directory
                </h1>
                <p className="text-xs text-slate-500">
                  Manage retail client profiles, credit limits, contact directory & purchase records
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchCustomers(pagination.page)}
              className="h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh customer list"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#5e2b9d]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold text-[#5e2b9d] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Bulk import customers from Excel"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Bulk Upload</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 px-4 text-xs font-semibold text-white bg-gradient-to-r from-[#5e2b9d] to-purple-700 hover:from-purple-700 hover:to-[#5e2b9d] rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Customers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                {totalCustomerCount}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Registered</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Accounts
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">
                {activeCustomerCount}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Eligible</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Credit Limit Exposure
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-purple-700 font-mono">
                ₹{totalCreditExposure.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Lifetime Sales
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{totalLifetimePurchases.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:max-w-md relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by name, 10-digit mobile, code, city, GST..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#5e2b9d] focus:outline-none transition-colors"
            />
          </div>

          <div className="w-full md:w-auto flex flex-wrap items-center gap-2 text-xs">
            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Cities</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            {/* Group Filter */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Groups</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="VIP">VIP</option>
              <option value="Corporate">Corporate</option>
              <option value="Regular">Regular</option>
              <option value="Walk-in">Walk-in</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Customers Table View */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">Customer Name & Group</th>
                  <th className="py-3 px-3.5">Contact Details</th>
                  <th className="py-3 px-3.5">City & State</th>
                  <th className="py-3 px-3.5">Card / Validity</th>
                  <th className="py-3 px-3.5 text-right">Credit Limit</th>
                  <th className="py-3 px-3.5 text-right">Purchases</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="animate-spin w-6 h-6 text-[#5e2b9d]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-xs font-medium">Loading 24 latest customers...</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">No customers found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchQuery
                            ? `No records matching "${searchQuery}". Try a different keyword.`
                            : "Click below to register your first retail customer."}
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="mt-4 px-4 py-2 bg-[#5e2b9d] text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-purple-800 transition-colors"
                        >
                          + Add Customer
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const isInactive = Boolean(c.isInactive);
                    const stopCredit = Boolean(c.stopCredit);
                    const creditLimitNum = Number(c.creditLimit) || 0;
                    const opCreditNum = Number(c.opCreditBalance) || 0;
                    const purchasesNum = Number(c.totalPurchases) || 0;

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setViewingCustomer(c)}
                      >
                        {/* Customer Code */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded border border-purple-100">
                            {c.customerCode || "—"}
                          </span>
                        </td>

                        {/* Customer Name & Group */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-xs">
                              {c.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-medium">
                                {c.customerGroup || "Retail"}
                              </span>
                              {c.classification && (
                                <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1 rounded">
                                  {c.classification}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col text-xs font-mono">
                            <span className="text-slate-800 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {c.phone}
                            </span>
                            {c.email ? (
                              <span className="text-[11px] text-slate-400 font-sans truncate max-w-[150px]">
                                {c.email}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* City & State */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-slate-800">{c.city || "—"}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {c.placeOfSupply || "Andhra Pradesh"}
                            </span>
                          </div>
                        </td>

                        {/* Card / Validity */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {c.cardNo ? (
                            <div className="flex flex-col text-[11px] font-mono">
                              <span className="text-slate-700 font-semibold">{c.cardNo}</span>
                              <span className="text-[10px] text-slate-400">Val: {c.cardValidity || "2500"}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Credit Limit */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-slate-800">
                              ₹{creditLimitNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                            {stopCredit ? (
                              <span className="text-[9.5px] text-rose-600 font-bold">
                                Credit Stopped
                              </span>
                            ) : opCreditNum > 0 ? (
                              <span className="text-[9.5px] text-slate-400">
                                Op: ₹{opCreditNum.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Total Purchases */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">
                          <span className="font-bold text-slate-800">
                            ₹{purchasesNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {isInactive ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              Inactive
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(c)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-[#5e2b9d] hover:bg-purple-50 transition-colors cursor-pointer"
                              title="Edit Customer"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingCustomer(c)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Customer"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer — Latest 24 items per page */}
          <div className="bg-slate-50/70 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{" "}
              <b className="text-slate-800">
                {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
              </b>{" "}
              to{" "}
              <b className="text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </b>{" "}
              of <b className="text-slate-800">{pagination.total}</b> customers
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchCustomers(pagination.page - 1)}
                className="h-8 px-3 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Prev</span>
              </button>

              {/* Page Number Chips */}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - pagination.page) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => fetchCustomers(p)}
                        className={`w-8 h-8 rounded text-xs font-semibold transition-colors cursor-pointer ${
                          p === pagination.page
                            ? "bg-[#5e2b9d] text-white"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchCustomers(pagination.page + 1)}
                className="h-8 px-3 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Customer Modal with All Fields from Screenshot */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleCustomerSaved}
        initialCustomer={editingCustomer}
        existingCustomers={allExistingCustomers}
      />

      {/* Bulk Upload Customer Modal */}
      <BulkUploadCustomerModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={() => {
          setIsBulkUploadOpen(false);
          fetchCustomers(1);
        }}
      />

      {/* Customer Quick Details Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="bg-[#5e2b9d] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{viewingCustomer.name}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px]">
                  {viewingCustomer.customerCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mobile</span>
                  <span className="text-slate-800 font-mono font-medium">{viewingCustomer.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                  <span className="text-slate-800">{viewingCustomer.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">City & State</span>
                  <span className="text-slate-800">{viewingCustomer.city || "VIJAYAWADA"}, {viewingCustomer.placeOfSupply}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Number</span>
                  <span className="text-slate-800 font-mono">{viewingCustomer.gstNumber || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Credit Limit</span>
                  <span className="text-slate-800 font-mono font-bold">₹{Number(viewingCustomer.creditLimit || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Credit Days</span>
                  <span className="text-slate-800 font-mono">{viewingCustomer.creditDays || 0} days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Card # & Validity</span>
                  <span className="text-slate-800 font-mono">{viewingCustomer.cardNo || "—"} ({viewingCustomer.cardValidity || "N/A"})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Group / Class</span>
                  <span className="text-slate-800">{viewingCustomer.customerGroup} / {viewingCustomer.classification}</span>
                </div>
              </div>

              {viewingCustomer.address && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Address</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                    {viewingCustomer.address} {viewingCustomer.pin ? `- ${viewingCustomer.pin}` : ""}
                  </p>
                </div>
              )}

              {viewingCustomer.remarks && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Remarks</span>
                  <p className="text-slate-700 italic bg-amber-50/50 p-2 rounded border border-amber-100">
                    {viewingCustomer.remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const custToEdit = viewingCustomer;
                  setViewingCustomer(null);
                  handleOpenEditModal(custToEdit);
                }}
                className="px-3 py-1.5 bg-[#5e2b9d] text-white rounded font-medium text-xs hover:bg-purple-800 transition-colors cursor-pointer"
              >
                Edit Customer
              </button>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-medium text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Delete Customer?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to remove customer{" "}
              <b className="text-slate-800">{deletingCustomer.name}</b> (
              <span className="font-mono text-purple-700">{deletingCustomer.phone}</span>)?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCustomer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SoftwareLayout>
  );
}
