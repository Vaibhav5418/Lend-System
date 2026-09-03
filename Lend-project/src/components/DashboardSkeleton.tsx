export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-40 bg-slate-200 rounded" />
        <div className="h-4 w-64 mt-2 bg-slate-100 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-slate-200" />
            </div>
            <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
            <div className="h-6 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6">
          <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
          <div className="h-72 sm:h-80 bg-slate-100 rounded" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6">
          <div className="h-5 w-40 bg-slate-200 rounded mb-4" />
          <div className="h-72 sm:h-80 bg-slate-100 rounded-full max-w-[280px] mx-auto" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6">
        <div className="h-5 w-36 bg-slate-200 rounded mb-4" />
        <div className="h-56 bg-slate-100 rounded" />
      </div>
    </div>
  );
}
