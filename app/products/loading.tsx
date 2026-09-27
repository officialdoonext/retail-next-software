import SoftwareLayout from "@/components/SoftwareLayout";

export default function ProductsLoading() {
  return (
    <SoftwareLayout>
      <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/80">
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 bg-slate-200 rounded-[4px] animate-pulse" />
            <div className="h-8 w-32 bg-[#5e2b9d]/20 rounded-[4px] animate-pulse" />
          </div>
        </div>

        {/* Filter bar Skeleton */}
        <div className="h-10 w-full bg-white rounded-[6px] border border-slate-200/80 animate-pulse" />

        {/* Table Skeleton */}
        <div className="bg-white border border-slate-200/80 rounded-[6px] overflow-hidden">
          <div className="h-9 bg-slate-50 border-b border-slate-200" />
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3.5 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[4px] bg-slate-200" />
                  <div className="space-y-1">
                    <div className="h-3.5 w-36 bg-slate-200 rounded" />
                    <div className="h-2.5 w-20 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded" />
                <div className="h-6 w-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SoftwareLayout>
  );
}
