"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import DashboardKpis from "@/components/dashboard/DashboardKpis";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import PaginationControls from "@/components/ui/PaginationControls";
import { DateFilterType, DashboardStats, Order, Product } from "@/components/dashboard/types";
import { getDateRange, isDateInRange } from "@/lib/dateFilters";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";

export default function DashboardPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>("TODAY");

  // Raw dynamic data from backend API
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeStoreName, setActiveStoreName] = useState<string>("All Stores");

  // Pagination for Recent Transactions (Strictly 24 latest transactions)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // Fetch real data from API
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch latest orders
      const [ordersRes, productsRes, storesRes] = await Promise.all([
        fetch("/api/orders?all=true"),
        fetch("/api/products?all=true"),
        fetch("/api/stores"),
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        if (oData.success && Array.isArray(oData.orders)) {
          setAllOrders(oData.orders);
        }
      }

      if (productsRes.ok) {
        const pData = await productsRes.json();
        if (pData.success && Array.isArray(pData.products)) {
          setAllProducts(pData.products);
        }
      }

      if (storesRes.ok) {
        const sData = await storesRes.json();
        if (sData.success && Array.isArray(sData.stores)) {
          const currentStore = sData.stores.find((s: any) => s.isActiveSelection);
          if (currentStore) {
            setActiveStoreName(currentStore.name);
          }
        }
      }
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      toast.error("Network error while loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Map DateFilterType to dateRange
  const activeDateRange = useMemo(() => {
    let internalFilter: "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "all" = "today";
    if (dateFilter === "TODAY") internalFilter = "today";
    else if (dateFilter === "YESTERDAY") internalFilter = "yesterday";
    else if (dateFilter === "LAST_7_DAYS") internalFilter = "last_7_days";
    else if (dateFilter === "LAST_30_DAYS") internalFilter = "last_30_days";
    else if (dateFilter === "THIS_MONTH") internalFilter = "this_month";
    else internalFilter = "all";

    return getDateRange(internalFilter);
  }, [dateFilter]);

  // Filter orders by active date range
  const filteredOrders = useMemo(() => {
    if (dateFilter === "ALL") return allOrders;
    return allOrders.filter((order) => isDateInRange(order.createdAt, activeDateRange));
  }, [allOrders, dateFilter, activeDateRange]);

  // Reset page when date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter]);

  // Calculate live stats
  const stats: DashboardStats = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalItemsSold = 0;
    const uniqueCustomerSet = new Set<string>();

    filteredOrders.forEach((o) => {
      const gTotal = Number(o.grandTotal || o.total || 0);
      totalRevenue += gTotal;
      totalTax += Number(o.sgst || 0) + Number(o.cgst || 0) || Number(o.tax || 0);
      totalDiscount += Number(o.discount || 0);

      const pMethod = String(o.paymentMethod || "").toUpperCase();
      if (pMethod === "CASH") cashRevenue += gTotal;
      else if (pMethod === "UPI") upiRevenue += gTotal;
      else if (pMethod === "CARD") cardRevenue += gTotal;
      else if (pMethod.startsWith("SPLIT")) {
        const split = o.splitDetails;
        if (split) {
          cashRevenue += Number(split.cash) || 0;
          upiRevenue += Number(split.upi) || 0;
          cardRevenue += Number(split.card) || 0;
        } else {
          cashRevenue += gTotal;
        }
      } else {
        cashRevenue += gTotal;
      }

      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          totalItemsSold += Number(it.quantity) || 1;
        });
      }

      const custId = o.customer?.id || o.customer?.phone || o.customer?.name;
      if (custId) uniqueCustomerSet.add(custId);
    });

    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Inventory metrics
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    allProducts.forEach((p) => {
      const st = Number(p.stock) || 0;
      const price = Number(p.price) || Number(p.costPrice) || 0;
      totalInventoryValue += st * price;

      if (st <= 0) {
        outOfStockCount++;
      } else if (st <= 5) {
        lowStockCount++;
      }
    });

    const totalTender = cashRevenue + upiRevenue + cardRevenue || 1;
    const cashPercent = Math.round((cashRevenue / totalTender) * 100);
    const upiPercent = Math.round((upiRevenue / totalTender) * 100);
    const cardPercent = Math.max(0, 100 - (cashPercent + upiPercent));

    return {
      totalRevenue,
      cashRevenue,
      upiRevenue,
      cardRevenue,
      orderCount,
      avgOrderValue,
      totalTax,
      totalDiscount,
      totalItemsSold,
      uniqueCustomers: uniqueCustomerSet.size,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue,
      cashPercent,
      upiPercent,
      cardPercent,
    };
  }, [filteredOrders, allProducts]);

  // Chart data generators
  const trendData = useMemo(() => {
    const dayMap = new Map<string, { date: string; revenue: number; orders: number; aov: number }>();
    const last7Days: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10); // MM-DD
      last7Days.push(key);
      dayMap.set(key, { date: key, revenue: 0, orders: 0, aov: 0 });
    }

    allOrders.forEach((o) => {
      const key = new Date(o.createdAt).toISOString().slice(5, 10);
      if (dayMap.has(key)) {
        const item = dayMap.get(key)!;
        item.revenue += Number(o.grandTotal || o.total || 0);
        item.orders += 1;
        item.aov = item.revenue / item.orders;
      }
    });

    return last7Days.map((k) => dayMap.get(k)!);
  }, [allOrders]);

  const paymentData = useMemo(() => {
    return [
      { name: "Cash", value: stats.cashRevenue, color: "#10b981", percent: stats.cashPercent },
      { name: "UPI", value: stats.upiRevenue, color: "#0ea5e9", percent: stats.upiPercent },
      { name: "Card", value: stats.cardRevenue, color: "#f59e0b", percent: stats.cardPercent },
    ].filter((p) => p.value > 0);
  }, [stats]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => ({
      hour: `${(i + 9) % 12 || 12} ${i + 9 >= 12 ? "PM" : "AM"}`,
      revenue: 0,
      orders: 0,
    }));

    filteredOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      const idx = h - 9;
      if (idx >= 0 && idx < hours.length) {
        hours[idx].revenue += Number(o.grandTotal || o.total || 0);
        hours[idx].orders += 1;
      }
    });

    return hours;
  }, [filteredOrders]);

  const categoryPerformance = useMemo(() => {
    const catMap = new Map<string, { name: string; revenue: number; unitsSold: number }>();

    filteredOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const cName = it.categoryName || "General";
          const existing = catMap.get(cName) || { name: cName, revenue: 0, unitsSold: 0 };
          existing.revenue += Number(it.total || (Number(it.price) * Number(it.quantity)) || 0);
          existing.unitsSold += Number(it.quantity) || 1;
          catMap.set(cName, existing);
        });
      }
    });

    return Array.from(catMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  const topSellingProducts = useMemo(() => {
    const prodMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();

    filteredOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const pName = it.productName || "Product";
          const existing = prodMap.get(pName) || { name: pName, unitsSold: 0, revenue: 0 };
          existing.unitsSold += Number(it.quantity) || 1;
          existing.revenue += Number(it.total || (Number(it.price) * Number(it.quantity)) || 0);
          prodMap.set(pName, existing);
        });
      }
    });

    return Array.from(prodMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);
  }, [filteredOrders]);

  const lowStockProducts = useMemo(() => {
    return allProducts.filter((p) => Number(p.stock) <= 5).slice(0, 10);
  }, [allProducts]);

  // Paginated recent orders (strictly latest 24)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedRecentOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  return (
    <SoftwareLayout>
      <div className="w-full space-y-5 pb-12">
        {/* Quick Top Bar Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-[#5e2b9d] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Executive Dashboard
                </h1>
                <p className="text-xs text-slate-500">
                  Live store revenue metrics, tender breakdowns, velocity charts & transactions
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/pos"
              className="h-9 px-3.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>POS Billing</span>
            </Link>

            <Link
              href="/products"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#5e2b9d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Product</span>
            </Link>

            <Link
              href="/sales"
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>All Sales</span>
            </Link>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <DashboardKpis
          stats={stats}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          loading={loading}
          onRefresh={fetchDashboardData}
          activeStoreName={activeStoreName}
        />

        {/* Analytics Charts & Graphs */}
        <DashboardCharts
          trendData={trendData}
          paymentData={paymentData}
          hourlyData={hourlyData}
          categoryPerformance={categoryPerformance}
          topSellingProducts={topSellingProducts}
          stats={stats}
        />

        {/* Recent Transactions Table (Latest 24 Paginated) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Recent Store Orders</span>
              <span className="text-[11px] font-semibold text-[#5e2b9d] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                {filteredOrders.length} records
              </span>
            </h2>

            <Link
              href="/sales"
              className="text-xs font-semibold text-[#5e2b9d] hover:text-purple-900 flex items-center gap-1"
            >
              <span>View Full Ledger</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <RecentTransactions
            orders={paginatedRecentOrders}
            lowStockProducts={lowStockProducts}
          />

          {filteredOrders.length > 0 && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemName="transactions"
              />
            </div>
          )}
        </div>
      </div>
    </SoftwareLayout>
  );
}
