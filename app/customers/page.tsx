"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  email?: string;
  address?: string;
  totalOrders?: number;
  totalSpend?: number;
  createdAt: number;
}

export default function CustomersPage() {
  const toast = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Fetch customers from API
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.customers)) {
        setCustomers(data.customers);
      } else {
        toast.error(data.error || "Failed to fetch customers.");
      }
    } catch {
      toast.error("Network error while loading customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Unique cities list for filtering
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city.trim()) {
        set.add(c.city.trim());
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));

      const matchesCity = cityFilter === "ALL" || c.city.toLowerCase() === cityFilter.toLowerCase();

      return matchesSearch && matchesCity;
    });
  }, [customers, searchQuery, cityFilter]);

  // Open modal for Adding
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName("");
    setPhone("");
    setCity("");
    setEmail("");
    setAddress("");
    setModalError("");
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setCity(customer.city);
    setEmail(customer.email || "");
    setAddress(customer.address || "");
    setModalError("");
    setIsModalOpen(true);
  };

  // Save Customer (Add or Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, "");
    const cleanCity = city.trim();

    if (!cleanName) {
      setModalError("Customer name is required.");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setModalError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!cleanCity) {
      setModalError("City is required.");
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const payload: any = {
        name: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        email: email.trim(),
        address: address.trim(),
      };

      if (editingCustomer) {
        payload.id = editingCustomer.id;
      }

      const res = await fetch("/api/customers", {
        method: editingCustomer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || "Failed to save customer.";
        setModalError(err);
        toast.error(err);
      } else {
        setIsModalOpen(false);
        toast.success(editingCustomer ? "Customer updated successfully!" : "Customer added successfully!");
        loadCustomers();
      }
    } catch {
      const err = "Network error while saving customer.";
      setModalError(err);
      toast.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Customer Handler
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/customers?id=${customerToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to delete customer.");
      } else {
        toast.success("Customer removed successfully!");
        setCustomerToDelete(null);
        loadCustomers();
      }
    } catch {
      toast.error("Network error while deleting customer.");
    } finally {
      setDeleting(false);
    }
  };

  // Helper to extract customer initials
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Dedicated Page Header with Compact Spacing */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">
                Customers
              </h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                {customers.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage your store&apos;s customer directory, contact numbers, and cities.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Customer</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white border border-slate-200/80 rounded-[6px] p-2.5 shadow-2xs mb-3">
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, mobile number, or city..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
            />
          </div>

          {uniqueCities.length > 0 && (
            <div className="w-full sm:w-auto">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-[34px] max-h-[34px] w-full sm:w-40 bg-[#f8fafc] border border-slate-200 rounded-[6px] px-2.5 text-xs font-normal text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d] cursor-pointer"
              >
                <option value="ALL">All Cities</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Customers Table View */}
        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="inline-block w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-normal">Loading store customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery || cityFilter !== "ALL" ? "No matching customers found" : "No customers registered yet"}
            </h3>
            <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto mb-4">
              {searchQuery || cityFilter !== "ALL"
                ? "Try adjusting your search criteria or clear filters to see more results."
                : "Add your store customers with their name, mobile number, and city to start managing sales and records."}
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-[34px] max-h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white px-4 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              + Add First Customer
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Customer Name</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Registered On</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Customer Name & Initials Avatar */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200/80 text-[#5e2b9d] font-medium text-xs flex items-center justify-center flex-shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block leading-tight">
                            {c.name}
                          </span>
                          {c.address && (
                            <span className="text-[10.5px] text-slate-400 font-normal truncate max-w-[200px] block">
                              {c.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Mobile Number */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11.5px]">
                        <svg className="w-3.5 h-3.5 text-slate-400 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                        </svg>
                        <span>{c.phone}</span>
                      </div>
                    </td>

                    {/* City */}
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 text-[10.5px] font-medium px-2 py-0.5 rounded-[4px]">
                        {c.city}
                      </span>
                    </td>

                    {/* Email */}
                    <td className="py-2.5 px-3 text-slate-500 font-normal">
                      {c.email || "—"}
                    </td>

                    {/* Registered Date */}
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] font-normal">
                      {new Date(c.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(c)}
                          title="Edit Customer"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-[#5e2b9d] hover:border-[#5e2b9d] hover:bg-purple-50 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(c)}
                          title="Delete Customer"
                          className="h-[28px] w-[28px] rounded-[4px] border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ADD / EDIT CUSTOMER MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="h-[52px] bg-[#f8fafc] border-b border-slate-200 px-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-[#5e2b9d]/10 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-slate-900 leading-tight">
                      {editingCustomer ? "Edit Customer" : "Add New Customer"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Enter the customer details below and save.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
                {modalError && (
                  <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {modalError}
                  </div>
                )}

                {/* Customer Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Verma"
                    required
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                {/* Mobile Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      required
                      className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-normal">
                    10-digit mobile number for order notifications and billing.
                  </p>
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Hyderabad, Mumbai, Bangalore"
                    required
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                {/* Email (Optional) */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                {/* Address (Optional) */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Address / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Flat / Street address"
                    className="w-full h-[34px] max-h-[34px] px-3 bg-[#f8fafc] border border-slate-200 rounded-[6px] text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5e2b9d] focus:border-[#5e2b9d]"
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] text-white text-xs font-medium hover:bg-[#4e2284] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>{editingCustomer ? "Update Customer" : "Save Customer"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CUSTOM CONFIRMATION MODAL FOR DELETING CUSTOMER */}
        <ConfirmModal
          isOpen={customerToDelete !== null}
          title="Delete Customer"
          message={`Are you sure you want to remove "${customerToDelete?.name}" (${customerToDelete?.phone}) from your store customers list?`}
          confirmText="Delete Customer"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onClose={() => setCustomerToDelete(null)}
        />
      </div>
    </SoftwareLayout>
  );
}
