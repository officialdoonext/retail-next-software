"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui/spinner";
import { DateFilterType, getDateRange, isDateInRange } from "@/lib/dateFilters";
import { getFirstLetter, getFirstLetterColor } from "@/components/BulkUploadEmployeeModal";

interface EmployeeSalesSummary {
  employeeId: string; // Internal id or employee_id
  numericId?: string;
  name: string;
  mobile?: string;
  avatarUrl?: string;
  totalRevenue: number;
  totalUnits: number;
  invoicesCount: number;
  items: {
    invoiceNumber: string;
    productName: string;
    variantName?: string;
    salePrice: number;
    quantity: number;
    subtotal: number;
    date: number;
  }[];
}

export default function EmployeeSalesPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Search by staff name / ID / mobile
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed Modal for viewing individual employee item sales
  const [selectedStaffSales, setSelectedStaffSales] = useState<EmployeeSalesSummary | null>(null);

  // Fetch orders and employees
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, empRes] = await Promise.all([
        fetch("/api/orders?all=true"),
        fetch("/api/employees?all=true"),
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        if (oData.success && Array.isArray(oData.orders)) {
          setOrders(oData.orders);
        }
      }

      if (empRes.ok) {
        const eData = await empRes.json();
        if (eData.success && Array.isArray(eData.employees)) {
          setEmployees(eData.employees);
        }
      }
    } catch (err) {
      console.error("Failed fetching employee sales:", err);
      toast.error("Network error while loading employee sales data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Current Date Range
  const activeDateRange = useMemo(() => {
    return getDateRange(dateFilter, customStart, customEnd);
  }, [dateFilter, customStart, customEnd]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => isDateInRange(o.createdAt, activeDateRange));
  }, [orders, activeDateRange]);

  // Aggregate Sales by Employee
  const { employeeSalesMap, unassignedSales, totalStoreRevenue } = useMemo(() => {
    const map = new Map<string, EmployeeSalesSummary>();

    // Prepopulate known employees
    employees.forEach((emp) => {
      const key = emp.id || emp.employeeId;
      map.set(key, {
        employeeId: key,
        numericId: emp.employeeId,
        name: emp.name,
        mobile: emp.mobile,
        avatarUrl: emp.avatarUrl,
        totalRevenue: 0,
        totalUnits: 0,
        invoicesCount: 0,
        items: [],
      });
    });

    const unassigned: EmployeeSalesSummary = {
      employeeId: "unassigned",
      name: "Unassigned Sales",
      totalRevenue: 0,
      totalUnits: 0,
      invoicesCount: 0,
      items: [],
    };

    let totalStoreRevenue = 0;

    filteredOrders.forEach((order) => {
      const invoiceNumber = order.billNumber;
      const orderDate = order.createdAt;
      const staffInThisInvoice = new Set<string>();

      (order.items || []).forEach((it: any) => {
        const lineTotal = Number(it.subtotal || it.total) || 0;
        const lineQty = Number(it.quantity) || 1;
        totalStoreRevenue += lineTotal;

        const lineItemDetail = {
          invoiceNumber,
          productName: it.productName || "Product Item",
          variantName: it.variantName,
          salePrice: Number(it.salePrice || it.price) || 0,
          quantity: lineQty,
          subtotal: lineTotal,
          date: orderDate,
        };

        if (it.employeeId) {
          staffInThisInvoice.add(it.employeeId);
          let record = map.get(it.employeeId);
          if (!record) {
            // Find by numericId or create fallback
            record = {
              employeeId: it.employeeId,
              numericId: it.employeeNumericId,
              name: it.employeeName || "Sales Employee",
              mobile: it.employeeMobile,
              totalRevenue: 0,
              totalUnits: 0,
              invoicesCount: 0,
              items: [],
            };
            map.set(it.employeeId, record);
          }
          record.totalRevenue += lineTotal;
          record.totalUnits += lineQty;
          record.items.push(lineItemDetail);
        } else {
          unassigned.totalRevenue += lineTotal;
          unassigned.totalUnits += lineQty;
          unassigned.items.push(lineItemDetail);
        }
      });

      // Credit invoice count once per employee per invoice
      staffInThisInvoice.forEach((empId) => {
        const record = map.get(empId);
        if (record) record.invoicesCount += 1;
      });
    });

    return { employeeSalesMap: map, unassignedSales: unassigned, totalStoreRevenue };
  }, [employees, filteredOrders]);

  // Convert map to sorted array & apply search filter
  const sortedStaffList = useMemo(() => {
    let list = Array.from(employeeSalesMap.values());

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          String(emp.numericId || "").includes(q) ||
          String(emp.mobile || "").includes(q)
      );
    }

    // Sort by highest revenue first
    list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return list;
  }, [employeeSalesMap, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalStaffRev = sortedStaffList.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalUnits = sortedStaffList.reduce((acc, s) => acc + s.totalUnits, 0);
    const activeStaffCount = sortedStaffList.filter((s) => s.totalRevenue > 0).length;
    const topPerformer = sortedStaffList.find((s) => s.totalRevenue > 0) || null;

    return {
      totalStaffRev,
      totalUnits,
      activeStaffCount,
      topPerformer,
    };
  }, [sortedStaffList]);

  const DATE_FILTER_BUTTONS: { type: DateFilterType; label: string }[] = [
    { type: "today", label: "Today" },
    { type: "yesterday", label: "Yesterday" },
    { type: "this_week", label: "This Week" },
    { type: "last_week", label: "Last Week" },
    { type: "this_month", label: "This Month" },
    { type: "last_month", label: "Last Month" },
    { type: "this_year", label: "This Year" },
    { type: "last_year", label: "Last Year" },
    { type: "custom", label: "Custom Date" },
  ];

  return (
    <SoftwareLayout>
      <div className="w-full space-y-4 sm:space-y-6 font-sans pb-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Employee Sales & Performance</span>
              <span className="text-xs bg-purple-50 text-[#5e2b9d] px-2 py-0.5 rounded-full font-mono font-bold border border-purple-200">
                {metrics.activeStaffCount} Active Sales Reps
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sales attribution per employee item, revenue volume leaderboard, and individual staff sales audit.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            {loading ? <Spinner className="w-3.5 h-3.5 text-[#5e2b9d]" /> : <span>↻</span>}
            <span>Refresh</span>
          </button>
        </div>

        {/* ==================================================================== */}
        {/* DATE FILTER BUTTONS & CUSTOM RANGE PICKER                            */}
        {/* ==================================================================== */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Date Range:</span>
            </span>

            <span className="text-xs font-semibold text-[#5e2b9d] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
              Active: {activeDateRange.label} (
              {activeDateRange.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} -{" "}
              {activeDateRange.endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_FILTER_BUTTONS.map((btn) => (
              <button
                key={btn.type}
                type="button"
                onClick={() => setDateFilter(btn.type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === btn.type
                    ? "bg-[#5e2b9d] text-white shadow-xs font-bold"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-slate-600">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-slate-600">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* KPI OVERVIEW CARDS                                                   */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Staff Attributed Sales
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{metrics.totalStaffRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Items Sold by Staff
            </span>
            <div className="text-xl font-extrabold text-[#5e2b9d] font-mono mt-1">
              {metrics.totalUnits} Units
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Top Sales Performer
            </span>
            <div className="text-sm font-bold text-emerald-700 truncate mt-1">
              {metrics.topPerformer ? (
                <span>
                  🥇 {metrics.topPerformer.name} (₹{metrics.topPerformer.totalRevenue.toFixed(0)})
                </span>
              ) : (
                <span className="text-slate-400 font-normal">No sales recorded</span>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Unassigned Sales
            </span>
            <div className="text-xl font-extrabold text-amber-600 font-mono mt-1">
              ₹{unassignedSales.totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* EMPLOYEE SEARCH TOOLBAR                                              */}
        {/* ==================================================================== */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Employee ID, Name, or Mobile..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#5e2b9d] focus:ring-1 focus:ring-[#5e2b9d]"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* LEADERBOARD & EMPLOYEE SALES TABLE                                   */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4 text-center w-12">Rank</th>
                  <th className="py-3 px-4">Salesperson</th>
                  <th className="py-3 px-4 text-center">Items Sold</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 text-right">Avg Item Rate</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4 text-right">Contribution</th>
                  <th className="py-3 px-4 text-center">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Spinner className="w-6 h-6 text-[#5e2b9d] mx-auto mb-2" />
                      <span>Loading employee sales performance...</span>
                    </td>
                  </tr>
                ) : sortedStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-700">No employees registered or matching filter</p>
                    </td>
                  </tr>
                ) : (
                  sortedStaffList.map((emp, idx) => {
                    const avgRate = emp.totalUnits > 0 ? emp.totalRevenue / emp.totalUnits : 0;
                    const contributionPct =
                      totalStoreRevenue > 0
                        ? ((emp.totalRevenue / totalStoreRevenue) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Rank */}
                        <td className="py-3 px-4 text-center">
                          {idx === 0 && emp.totalRevenue > 0 ? (
                            <span className="text-base" title="Top Performer">🥇</span>
                          ) : idx === 1 && emp.totalRevenue > 0 ? (
                            <span className="text-base" title="2nd Rank">🥈</span>
                          ) : idx === 2 && emp.totalRevenue > 0 ? (
                            <span className="text-base" title="3rd Rank">🥉</span>
                          ) : (
                            <span className="text-slate-400 font-mono font-bold text-xs">#{idx + 1}</span>
                          )}
                        </td>

                        {/* 2. Employee Profile */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {emp.avatarUrl ? (
                              <img
                                src={emp.avatarUrl}
                                alt={emp.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${getFirstLetterColor(
                                  getFirstLetter(emp.name)
                                )}`}
                              >
                                {getFirstLetter(emp.name)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {emp.numericId && (
                                  <span className="font-mono text-[10px] font-bold bg-purple-50 text-[#5e2b9d] px-1.5 py-0.2 rounded border border-purple-200/60">
                                    #{emp.numericId}
                                  </span>
                                )}
                              </div>
                              {emp.mobile && (
                                <div className="text-[10.5px] text-slate-400 mt-0.5">📱 {emp.mobile}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Items Sold */}
                        <td className="py-3 px-4 text-center font-bold font-mono text-slate-800 text-xs">
                          {emp.totalUnits}
                        </td>

                        {/* 4. Invoices Count */}
                        <td className="py-3 px-4 text-center font-semibold text-slate-600 text-xs">
                          {emp.invoicesCount}
                        </td>

                        {/* 5. Avg Item Rate */}
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          ₹{avgRate.toFixed(2)}
                        </td>

                        {/* 6. Total Revenue */}
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                          ₹{emp.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* 7. Revenue Contribution */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[#5e2b9d] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Number(contributionPct))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-bold text-purple-700 w-10 text-right">
                              {contributionPct}%
                            </span>
                          </div>
                        </td>

                        {/* 8. Audit / View Details */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedStaffSales(emp)}
                            disabled={emp.items.length === 0}
                            className="px-3 py-1 bg-purple-50 hover:bg-purple-100 disabled:opacity-30 disabled:pointer-events-none text-[#5e2b9d] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                          >
                            View Items ({emp.items.length})
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

        {/* ==================================================================== */}
        {/* EMPLOYEE ITEMS DRILLDOWN AUDIT MODAL                                 */}
        {/* ==================================================================== */}
        {selectedStaffSales && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
              
              <div className="bg-[#5e2b9d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    {getFirstLetter(selectedStaffSales.name)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      {selectedStaffSales.name} — Sales Ledger
                    </h3>
                    <p className="text-[11px] text-purple-200">
                      {selectedStaffSales.numericId ? `Emp ID #${selectedStaffSales.numericId} • ` : ""}
                      {selectedStaffSales.items.length} items sold (₹{selectedStaffSales.totalRevenue.toFixed(2)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStaffSales(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Sale Price</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {selectedStaffSales.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(it.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-[#5e2b9d]">{it.invoiceNumber}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {it.productName}
                          {it.variantName && (
                            <span className="text-[10px] text-purple-600 font-normal ml-1">
                              ({it.variantName})
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{it.salePrice.toFixed(0)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{it.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  Total Attributed: <b className="text-slate-900 font-mono">₹{selectedStaffSales.totalRevenue.toFixed(2)}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStaffSales(null)}
                  className="px-4 py-1.5 bg-[#5e2b9d] hover:bg-purple-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </SoftwareLayout>
  );
}
