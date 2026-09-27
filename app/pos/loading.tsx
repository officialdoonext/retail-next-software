import SoftwareLayout from "@/components/SoftwareLayout";

export default function PosLoading() {
  return (
    <SoftwareLayout>
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-80px)] pb-4">
        {/* Left: Cart & Items area */}
        <div className="flex-1 bg-white border border-slate-200/80 rounded-[6px] p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
          </div>
          {/* Scanner barcode input skeleton */}
          <div className="h-10 w-full bg-slate-100 rounded-[6px] animate-pulse" />
          {/* Table skeleton */}
          <div className="flex-1 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-[4px] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Right: Payment & Summary sidebar */}
        <div className="w-full lg:w-80 bg-white border border-slate-200/80 rounded-[6px] p-4 space-y-4">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-20 bg-purple-50/50 border border-purple-100 rounded-[6px] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-12 w-full bg-[#5e2b9d]/20 rounded-[6px] animate-pulse" />
        </div>
      </div>
    </SoftwareLayout>
  );
}
