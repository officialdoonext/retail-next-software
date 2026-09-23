"use client";

import React from "react";
import {
  TrendingUp,
  Banknote,
  Smartphone,
  CreditCard,
  ShoppingBag,
  Receipt,
  Percent,
  AlertTriangle,
  RotateCw,
  Calendar,
  Layers,
  Users,
} from "lucide-react";
import { DateFilterType, DashboardStats } from "./types";

interface DashboardKpisProps {
  stats: DashboardStats;
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  loading: boolean;
  onRefresh: () => void;
  activeStoreName?: string;
}

export default function DashboardKpis({
  stats,
  dateFilter,
  setDateFilter,
  loading,
  onRefresh,
  activeStoreName,
}: DashboardKpisProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filters: { label: string; value: DateFilterType }[] = [
    { label: "Today", value: "TODAY" },
    { label: "Yesterday", value: "YESTERDAY" },
    { label: "Last 7 Days", value: "LAST_7_DAYS" },
    { label: "Last 30 Days", value: "LAST_30_DAYS" },
    { label: "This Month", value: "THIS_MONTH" },
    { label: "All Time", value: "ALL" },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Store Analytics & Overview
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {activeStoreName ? `Viewing metrics for ${activeStoreName}` : "Real-time sales & payment performance"}
            </p>
          </div>
        </div>

        {/* Filters & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter Pills */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 overflow-x-auto">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  dateFilter === f.value
                    ? "bg-white text-[#5e2b9d] shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh Data"
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#5e2b9d]" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Financial KPI Grid (Total Revenue, Cash, UPI, Card) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Revenue */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#5e2b9d] to-[#441a78] text-white p-4 rounded-xl shadow-xs border border-purple-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-purple-200 uppercase tracking-wider">
                Total Revenue
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight mt-1 text-white">
                {formatCurrency(stats.totalRevenue)}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-xs flex items-center justify-center text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-purple-200">
            <span className="flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 opacity-80" />
              <strong className="text-white font-semibold">{stats.orderCount}</strong> bills settled
            </span>
            <span className="bg-white/15 px-2 py-0.5 rounded text-[11px] font-medium text-white">
              Avg {formatCurrency(stats.avgOrderValue)}
            </span>
          </div>
        </div>

        {/* Cash Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Cash Received
                </p>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {formatCurrency(stats.cashRevenue)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-500 font-medium">Cash Share</span>
              <span className="font-semibold text-emerald-600">
                {stats.cashPercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.cashPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* UPI Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  UPI Received
                </p>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {formatCurrency(stats.upiRevenue)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-500 font-medium">UPI / QR Share</span>
              <span className="font-semibold text-blue-600">
                {stats.upiPercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.upiPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Card Received
                </p>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {formatCurrency(stats.cardRevenue)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-500 font-medium">POS Card Share</span>
              <span className="font-semibold text-purple-600">
                {stats.cardPercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.cardPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Fast Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">Average Bill</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {formatCurrency(stats.avgOrderValue)}
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">GST Tax Collected</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {formatCurrency(stats.totalTax)}
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">Discounts Given</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {formatCurrency(stats.totalDiscount)}
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">Items Sold</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {stats.totalItemsSold.toLocaleString()} units
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">Customers Served</p>
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {stats.uniqueCustomers}
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            stats.lowStockCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600"
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10.5px] font-medium text-slate-500 truncate">Low Stock Alert</p>
            <p className={`text-xs sm:text-sm font-bold truncate ${
              stats.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"
            }`}>
              {stats.lowStockCount} items
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
