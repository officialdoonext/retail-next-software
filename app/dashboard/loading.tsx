import SoftwareLayout from "@/components/SoftwareLayout";

export default function DashboardLoading() {
  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
        {/* KPI Top Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200/80 rounded-[6px] p-3.5 space-y-2 animate-pulse">
              <div className="h-3 w-16 bg-slate-200 rounded" />
              <div className="h-6 w-24 bg-slate-300 rounded" />
              <div className="h-2.5 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-white border border-slate-200/80 rounded-[6px] p-4 animate-pulse" />
          <div className="h-72 bg-white border border-slate-200/80 rounded-[6px] p-4 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-white border border-slate-200/80 rounded-[6px] p-4 animate-pulse" />
          <div className="h-64 bg-white border border-slate-200/80 rounded-[6px] p-4 animate-pulse" />
        </div>
      </div>
    </SoftwareLayout>
  );
}
