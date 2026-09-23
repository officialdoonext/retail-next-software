"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import DashboardKpis from "@/components/dashboard/DashboardKpis";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import {
  Order,
  Product,
  Category,
  Customer,
  DateFilterType,
  DashboardStats,
} from "@/components/dashboard/types";
import { useToast } from "@/components/ToastProvider";

const PALETTE = [
  "#5e2b9d",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

export default function DashboardPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Date Filter State (defaults to TODAY)
  const [dateFilter, setDateFilter] = useState<DateFilterType>("TODAY");

  // Fetch all necessary store entities in parallel
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes, categoriesRes, customersRes, settingsRes] =
        await Promise.allSettled([
          fetch("/api/orders"),
          fetch("/api/products?all=true"),
          fetch("/api/categories"),
          fetch("/api/customers"),
          fetch("/api/settings"),
        ]);

      if (ordersRes.status === "fulfilled" && ordersRes.value.ok) {
        const data = await ordersRes.value.json();
        if (data.success) setOrders(data.orders || []);
      }

      if (productsRes.status === "fulfilled" && productsRes.value.ok) {
        const data = await productsRes.value.json();
        if (data.success) setProducts(data.products || []);
      }

      if (categoriesRes.status === "fulfilled" && categoriesRes.value.ok) {
        const data = await categoriesRes.value.json();
        if (data.success) setCategories(data.categories || []);
      }

      if (customersRes.status === "fulfilled" && customersRes.value.ok) {
        const data = await customersRes.value.json();
        if (data.success) setCustomers(data.customers || []);
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
        const data = await settingsRes.value.json();
        if (data.success) setStoreSettings(data.settings || null);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      toast?.error("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Product Category Lookup Map
  const productCategoryMap = useMemo(() => {
    const catMap = new Map<string, string>();
    categories.forEach((c) => catMap.set(c.id, c.name));

    const map = new Map<string, string>();
    products.forEach((p) => {
      const catName = p.categoryId ? catMap.get(p.categoryId) || p.categoryName || "Uncategorized" : "Uncategorized";
      map.set(p.id, catName);
      map.set(p.name.toLowerCase().trim(), catName);
    });
    return map;
  }, [products, categories]);

  // Filtered Orders based on Date Filter
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((order) => {
      const time = order.createdAt;
      if (!time) return true;

      switch (dateFilter) {
        case "TODAY":
          return time >= startOfToday;
        case "YESTERDAY":
          return time >= startOfYesterday && time < startOfToday;
        case "LAST_7_DAYS":
          return time >= sevenDaysAgo;
        case "LAST_30_DAYS":
          return time >= thirtyDaysAgo;
        case "THIS_MONTH":
          return time >= startOfMonth;
        case "ALL":
        default:
          return true;
      }
    });
  }, [orders, dateFilter]);

  // Compute Core Metrics & Payment Breakdown (Cash, UPI, Card, Split)
  const stats: DashboardStats = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalItemsSold = 0;
    const customerSet = new Set<string>();

    filteredOrders.forEach((o) => {
      totalRevenue += Number(o.grandTotal) || 0;
      totalTax += (Number(o.cgst) || 0) + (Number(o.sgst) || 0);
      totalDiscount += Number(o.discount) || 0;

      // Items count
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          totalItemsSold += Number(it.quantity) || 0;
        });
      }

      // Customer tracking
      if (o.customer?.phone) {
        customerSet.add(o.customer.phone);
      } else if (o.customer?.name) {
        customerSet.add(o.customer.name);
      }

      // Tender breakdown: Pure Single Methods vs Split Details
      const method = String(o.paymentMethod || "CASH").toUpperCase();
      if (method === "CASH") {
        cashRevenue += Number(o.grandTotal) || 0;
      } else if (method === "UPI") {
        upiRevenue += Number(o.grandTotal) || 0;
      } else if (method === "CARD") {
        cardRevenue += Number(o.grandTotal) || 0;
      } else if (method === "SPLIT" && o.splitDetails) {
        cashRevenue += Number(o.splitDetails.cash) || 0;
        upiRevenue += Number(o.splitDetails.upi) || 0;
        cardRevenue += Number(o.splitDetails.card) || 0;
      } else {
        // Fallback for custom or unrecognized methods
        cashRevenue += Number(o.grandTotal) || 0;
      }
    });

    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Inventory status
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    products.forEach((p) => {
      const stock = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      totalInventoryValue += stock * price;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= 10) {
        lowStockCount++;
      }
    });

    const denominator = totalRevenue > 0 ? totalRevenue : 1;
    const cashPercent = totalRevenue > 0 ? (cashRevenue / denominator) * 100 : 0;
    const upiPercent = totalRevenue > 0 ? (upiRevenue / denominator) * 100 : 0;
    const cardPercent = totalRevenue > 0 ? (cardRevenue / denominator) * 100 : 0;

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
      uniqueCustomers: customerSet.size || filteredOrders.length,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue,
      cashPercent,
      upiPercent,
      cardPercent,
    };
  }, [filteredOrders, products]);

  // Payment Breakdown Chart Data
  const paymentData = useMemo(() => {
    return [
      {
        name: "Cash",
        value: stats.cashRevenue,
        color: "#10b981",
        percent: stats.cashPercent,
      },
      {
        name: "UPI / QR",
        value: stats.upiRevenue,
        color: "#3b82f6",
        percent: stats.upiPercent,
      },
      {
        name: "POS Card",
        value: stats.cardRevenue,
        color: "#8b5cf6",
        percent: stats.cardPercent,
      },
    ].filter((item) => item.value > 0 || stats.totalRevenue === 0);
  }, [stats]);

  // Revenue & Orders Trend (Area Chart)
  const trendData = useMemo(() => {
    if (filteredOrders.length === 0) return [];

    const isHourly = dateFilter === "TODAY" || dateFilter === "YESTERDAY";

    if (isHourly) {
      // Group by hour (08:00 to 22:00)
      const hourMap: Record<number, { revenue: number; orders: number }> = {};
      for (let h = 8; h <= 22; h++) {
        hourMap[h] = { revenue: 0, orders: 0 };
      }

      filteredOrders.forEach((o) => {
        const d = new Date(o.createdAt);
        const hour = d.getHours();
        if (hourMap[hour]) {
          hourMap[hour].revenue += Number(o.grandTotal) || 0;
          hourMap[hour].orders += 1;
        } else if (hourMap[hour] === undefined) {
          hourMap[hour] = { revenue: Number(o.grandTotal) || 0, orders: 1 };
        }
      });

      return Object.entries(hourMap)
        .map(([h, val]) => {
          const hourNum = parseInt(h, 10);
          const period = hourNum >= 12 ? "PM" : "AM";
          const displayH = hourNum % 12 === 0 ? 12 : hourNum % 12;
          return {
            date: `${displayH} ${period}`,
            revenue: Math.round(val.revenue),
            orders: val.orders,
            aov: val.orders > 0 ? Math.round(val.revenue / val.orders) : 0,
          };
        });
    }

    // Group by Date (Day/Month)
    const dateMap: Record<string, { revenue: number; orders: number; timestamp: number }> = {};

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if (!dateMap[key]) {
        dateMap[key] = { revenue: 0, orders: 0, timestamp: dayStart };
      }
      dateMap[key].revenue += Number(o.grandTotal) || 0;
      dateMap[key].orders += 1;
    });

    return Object.entries(dateMap)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([date, val]) => ({
        date,
        revenue: Math.round(val.revenue),
        orders: val.orders,
        aov: val.orders > 0 ? Math.round(val.revenue / val.orders) : 0,
      }));
  }, [filteredOrders, dateFilter]);

  // Hourly Peak Rush (Bar Chart)
  const hourlyData = useMemo(() => {
    const hours: Record<number, { revenue: number; orders: number }> = {};
    for (let h = 8; h <= 22; h++) {
      hours[h] = { revenue: 0, orders: 0 };
    }

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const h = d.getHours();
      if (hours[h]) {
        hours[h].revenue += Number(o.grandTotal) || 0;
        hours[h].orders += 1;
      }
    });

    let maxRev = 0;
    Object.values(hours).forEach((v) => {
      if (v.revenue > maxRev) maxRev = v.revenue;
    });

    return Object.entries(hours).map(([h, val]) => {
      const hourNum = parseInt(h, 10);
      const period = hourNum >= 12 ? "PM" : "AM";
      const displayH = hourNum % 12 === 0 ? 12 : hourNum % 12;
      return {
        hour: `${displayH} ${period}`,
        revenue: Math.round(val.revenue),
        orders: val.orders,
        isPeak: maxRev > 0 && val.revenue === maxRev,
      };
    });
  }, [filteredOrders]);

  // Top 10 Best-Selling Products
  const topProductsData = useMemo(() => {
    const productMap: Record<string, { quantity: number; revenue: number }> = {};

    filteredOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const name = it.productName || "Unknown Item";
          if (!productMap[name]) {
            productMap[name] = { quantity: 0, revenue: 0 };
          }
          productMap[name].quantity += Number(it.quantity) || 0;
          productMap[name].revenue += Number(it.total) || 0;
        });
      }
    });

    return Object.entries(productMap)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredOrders]);

  // Category Revenue Share (Pie / Donut)
  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};

    filteredOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const cat =
            productCategoryMap.get(it.productId) ||
            productCategoryMap.get(it.productName.toLowerCase().trim()) ||
            "General";
          catMap[cat] = (catMap[cat] || 0) + (Number(it.total) || 0);
        });
      }
    });

    const total = Object.values(catMap).reduce((sum, v) => sum + v, 0) || 1;

    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value: Math.round(value),
        color: PALETTE[i % PALETTE.length],
        percent: (value / total) * 100,
      }));
  }, [filteredOrders, productCategoryMap]);

  // Day of Week Sales Velocity (Bar)
  const weekdayData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayStats = days.map((day) => ({ day, revenue: 0, orders: 0 }));

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const dayIndex = d.getDay();
      dayStats[dayIndex].revenue += Number(o.grandTotal) || 0;
      dayStats[dayIndex].orders += 1;
    });

    // Reorder Mon to Sun
    const reordered = [...dayStats.slice(1), dayStats[0]];
    return reordered.map((d) => ({
      ...d,
      revenue: Math.round(d.revenue),
    }));
  }, [filteredOrders]);

  // Staff / Cashier Billing Leaderboard
  const staffData = useMemo(() => {
    const staffMap: Record<string, { revenue: number; orders: number }> = {};

    filteredOrders.forEach((o) => {
      const name = o.settledBy || "Main Register";
      if (!staffMap[name]) {
        staffMap[name] = { revenue: 0, orders: 0 };
      }
      staffMap[name].revenue += Number(o.grandTotal) || 0;
      staffMap[name].orders += 1;
    });

    return Object.entries(staffMap)
      .map(([name, data]) => ({
        name,
        revenue: Math.round(data.revenue),
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Financial Components (Stacked: Subtotal, Tax, Discounts)
  const taxDiscountData = useMemo(() => {
    if (filteredOrders.length === 0) return [];

    const map: Record<string, { subtotal: number; tax: number; discount: number; timestamp: number }> = {};

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if (!map[key]) {
        map[key] = { subtotal: 0, tax: 0, discount: 0, timestamp: dayStart };
      }
      map[key].subtotal += Number(o.subtotal) || 0;
      map[key].tax += (Number(o.cgst) || 0) + (Number(o.sgst) || 0);
      map[key].discount += Number(o.discount) || 0;
    });

    return Object.entries(map)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(-7)
      .map(([period, val]) => ({
        period,
        subtotal: Math.round(val.subtotal),
        tax: Math.round(val.tax),
        discount: Math.round(val.discount),
      }));
  }, [filteredOrders]);

  // Stock Health Distribution
  const stockHealthData = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let out = 0;

    products.forEach((p) => {
      const stock = Number(p.stock) || 0;
      if (stock === 0) out++;
      else if (stock <= 10) low++;
      else healthy++;
    });

    return [
      { name: "In Stock (>10)", value: healthy, color: "#10b981" },
      { name: "Low Stock (≤10)", value: low, color: "#f59e0b" },
      { name: "Out of Stock (0)", value: out, color: "#f43f5e" },
    ];
  }, [products]);

  // Critical Low Stock Products (< 10)
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => Number(p.stock) <= 10)
      .sort((a, b) => Number(a.stock) - Number(b.stock));
  }, [products]);

  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
        {/* KPI Top Cards & Date Filter Header */}
        <DashboardKpis
          stats={stats}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          loading={loading}
          onRefresh={loadDashboardData}
          activeStoreName={storeSettings?.name}
        />

        {/* Comprehensive Graphs and Visualizations Suite */}
        <DashboardCharts
          trendData={trendData}
          paymentData={paymentData}
          hourlyData={hourlyData}
          topProductsData={topProductsData}
          categoryData={categoryData}
          weekdayData={weekdayData}
          staffData={staffData}
          taxDiscountData={taxDiscountData}
          stockHealthData={stockHealthData}
          stats={stats}
        />

        {/* Live Feed: Recent Settled Bills & Low Stock Alerts */}
        <RecentTransactions
          orders={filteredOrders}
          lowStockProducts={lowStockProducts}
          storeSettings={storeSettings}
        />
      </div>
    </SoftwareLayout>
  );
}
