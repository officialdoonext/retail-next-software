"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  PieChart as PieIcon,
  Clock,
  Award,
  Layers,
  Calendar,
  Users,
  Package,
  CircleDollarSign,
  BarChart3,
} from "lucide-react";
import { DashboardStats } from "./types";

interface ChartDataProps {
  trendData: Array<{
    date: string;
    revenue: number;
    orders: number;
    aov: number;
  }>;
  paymentData: Array<{
    name: string;
    value: number;
    color: string;
    percent: number;
  }>;
  hourlyData: Array<{
    hour: string;
    revenue: number;
    orders: number;
    isPeak?: boolean;
  }>;
  topProductsData: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  categoryData: Array<{
    name: string;
    value: number;
    color: string;
    percent: number;
  }>;
  weekdayData: Array<{
    day: string;
    revenue: number;
    orders: number;
  }>;
  staffData: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
  taxDiscountData: Array<{
    period: string;
    subtotal: number;
    tax: number;
    discount: number;
  }>;
  stockHealthData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  stats: DashboardStats;
}

export default function DashboardCharts({
  trendData,
  paymentData,
  hourlyData,
  topProductsData,
  categoryData,
  weekdayData,
  staffData,
  taxDiscountData,
  stockHealthData,
  stats,
}: ChartDataProps) {
  const [trendMetric, setTrendMetric] = useState<"revenue" | "orders">("revenue");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Custom Glassmorphic Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-lg shadow-xl border border-slate-700/60 text-xs z-50">
          <p className="font-semibold text-slate-200 border-b border-slate-700/80 pb-1 mb-1.5">
            {label}
          </p>
          {payload.map((entry: any, index: number) => {
            const isCurrency =
              entry.dataKey === "revenue" ||
              entry.dataKey === "subtotal" ||
              entry.dataKey === "tax" ||
              entry.dataKey === "discount" ||
              entry.dataKey === "aov";
            return (
              <div key={`tooltip_${index}`} className="flex items-center justify-between gap-3 py-0.5">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  {entry.name}:
                </span>
                <span className="font-bold text-white">
                  {isCurrency ? formatCurrency(entry.value) : entry.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* ROW 1: Revenue Trend (Area) & Payment Mode Breakdown (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue & Sales Trend (Area Chart) - 2 cols on lg */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 text-[#5e2b9d]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Sales & Revenue Velocity
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Trajectory of sales volume and collections over time
              </p>
            </div>

            {/* Toggle metric */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTrendMetric("revenue")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  trendMetric === "revenue"
                    ? "bg-white text-[#5e2b9d] shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric("orders")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  trendMetric === "orders"
                    ? "bg-white text-[#5e2b9d] shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bills Count
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5e2b9d" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#5e2b9d" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      trendMetric === "revenue" ? `₹${(val / 1000).toFixed(0)}k` : val
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {trendMetric === "revenue" ? (
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#5e2b9d"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGradient)"
                    />
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="orders"
                      name="Bills Settled"
                      stroke="#0ea5e9"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#ordersGradient)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs">No sales data recorded in this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Share (Donut / Pie Chart) - 1 col on lg */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <PieIcon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Payment Tender Share
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Distribution across Cash, UPI, and Card
            </p>
          </div>

          <div className="h-52 w-full relative flex items-center justify-center">
            {stats.totalRevenue > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`pay_cell_${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">
                    Total
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                    {formatCurrency(stats.totalRevenue)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <PieIcon className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs">No payment records yet</p>
              </div>
            )}
          </div>

          {/* Payment Custom Legend */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            {paymentData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-700 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">{formatCurrency(item.value)}</span>
                  <span className="w-10 text-right text-[11px] text-slate-400">
                    {item.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 2: Hourly Rush Bar Chart & Composed Orders vs AOV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Peak Rush Bar Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Peak Rush Hours (Sales Volume)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifies high-traffic hours to optimize billing counters & staffing
              </p>
            </div>
          </div>

          <div className="h-60 w-full">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="revenue"
                    name="Hourly Sales"
                    radius={[4, 4, 0, 0]}
                  >
                    {hourlyData.map((entry, index) => (
                      <Cell
                        key={`hour_cell_${index}`}
                        fill={entry.isPeak ? "#f59e0b" : "#5e2b9d"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No hourly transactions yet
              </div>
            )}
          </div>
        </div>

        {/* Composed Chart: Orders Volume vs Average Order Value (AOV) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <CircleDollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Order Volume vs Average Basket Size (AOV)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bills count (Bars) vs Average Order Value in ₹ (Line)
              </p>
            </div>
          </div>

          <div className="h-60 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    name="Orders"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#f59e0b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val}`}
                    name="AOV"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="orders"
                    name="Bills Count"
                    fill="#c084fc"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="aov"
                    name="Avg Basket Size (₹)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: "#f59e0b", r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No orders available for AOV analysis
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: Top 10 Best Sellers (Horizontal Bar) & Category Share (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 10 Best-Selling Products - 2 cols on lg */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Top Best-Selling Products
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by customer demand and gross sales revenue
              </p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {topProductsData.length > 0 ? (
              topProductsData.slice(0, 7).map((prod, index) => {
                const maxRev = topProductsData[0]?.revenue || 1;
                const percent = Math.min(100, Math.round((prod.revenue / maxRev) * 100));
                return (
                  <div key={prod.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            index === 0
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : index === 2
                              ? "bg-amber-50 text-amber-900"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <span className="font-medium text-slate-800 truncate max-w-[180px] sm:max-w-[280px]">
                          {prod.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[11px]">
                          {prod.quantity} sold
                        </span>
                        <span className="font-bold text-slate-900 w-20 text-right">
                          {formatCurrency(prod.revenue)}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#5e2b9d] to-[#8b5cf6] rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                No items sold yet in this period
              </div>
            )}
          </div>
        </div>

        {/* Category Revenue Distribution (Donut) - 1 col on lg */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Category Contribution
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Revenue split by product department
            </p>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cat_cell_${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Layers className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs">No category data</p>
              </div>
            )}
          </div>

          {/* Category List */}
          <div className="space-y-1 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-slate-700 truncate max-w-[110px]">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-800">{formatCurrency(cat.value)}</span>
                  <span className="text-[10px] text-slate-400 w-8 text-right">
                    {cat.percent.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 4: Day of Week Performance & Financial Breakdown (Stacked Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Day of Week Sales Velocity */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Day-of-Week Sales Velocity
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekday vs Weekend revenue trends
              </p>
            </div>
          </div>

          <div className="h-56 w-full">
            {weekdayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No weekday data available
              </div>
            )}
          </div>
        </div>

        {/* Stacked Financial Tax & Discount Analysis */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <CircleDollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Financial Components (Tax & Discounts)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Net Items Subtotal vs GST Tax liability vs Store Discounts
              </p>
            </div>
          </div>

          <div className="h-56 w-full">
            {taxDiscountData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taxDiscountData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                  />
                  <Bar dataKey="subtotal" name="Item Subtotal" fill="#5e2b9d" stackId="a" />
                  <Bar dataKey="tax" name="GST Tax" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="discount" name="Discounts" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No financial data recorded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 5: Cashier Leaderboard & Inventory Stock Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cashier / Staff Sales Leaderboard - 2 cols on lg */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Cashier & Staff Billing Performance
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sales generated and bills processed by store operators
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {staffData.length > 0 ? (
              staffData.map((staff, idx) => {
                const maxRev = staffData[0]?.revenue || 1;
                const percent = Math.min(100, Math.round((staff.revenue / maxRev) * 100));
                return (
                  <div key={staff.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#5e2b9d] flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{staff.name}</span>
                        <span className="text-[11px] text-slate-400">
                          ({staff.orders} bills closed)
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(staff.revenue)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No staff sales records found
              </div>
            )}
          </div>
        </div>

        {/* Inventory Stock Health Breakdown - 1 col on lg */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Package className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Inventory Stock Health
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Catalog stock availability & out-of-stock risks
            </p>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center">
            {stockHealthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                  >
                    {stockHealthData.map((entry, index) => (
                      <Cell key={`stock_cell_${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Package className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs">No inventory data</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {stockHealthData.map((stk) => (
              <div key={stk.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stk.color }}
                  />
                  <span className="text-slate-700">{stk.name}</span>
                </div>
                <span className="font-bold text-slate-800">{stk.value} SKUs</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
