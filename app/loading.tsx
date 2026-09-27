export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center animate-pulse">
          <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
