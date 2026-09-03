export default function InquiriesListSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-7 w-28 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-72 bg-slate-100 rounded" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded" />
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-wrap gap-3">
          <div className="h-8 w-48 bg-slate-100 rounded-lg" />
          <div className="h-8 w-28 bg-slate-100 rounded-lg" />
          <div className="h-8 w-28 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <th key={i} className="px-3 sm:px-6 py-3">
                    <div className="h-3 w-16 bg-slate-200 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <tr key={i}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="h-4 w-28 bg-slate-100 rounded mb-1" />
                    <div className="h-3 w-24 bg-slate-50 rounded" />
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-6 w-14 bg-slate-100 rounded-full" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-6 w-12 bg-slate-100 rounded-full" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-4 w-14 bg-slate-100 rounded" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4"><div className="h-8 w-12 bg-slate-100 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
