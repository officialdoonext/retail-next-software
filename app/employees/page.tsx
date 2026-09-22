import SoftwareLayout from "@/components/SoftwareLayout";

export default function EmployeesPage() {
  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-medium text-slate-900 tracking-tight">
            Employees
          </h1>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-[6px] p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 stroke-[1.8]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-slate-900 mb-1">
            Employees — Coming Soon
          </h3>
          <p className="text-xs text-slate-500 font-normal max-w-xs mx-auto">
            Employee management features will be added here. Use the{" "}
            <strong>Staff</strong> page to manage store staff with MPIN access.
          </p>
        </div>
      </div>
    </SoftwareLayout>
  );
}
