import { useState, useEffect } from 'react';
import { Filter, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { api } from '../api/client';
import type { BorrowerCollection } from '../types';

function formatAmount(amount: number): string {
  if (amount >= 1_00_00_000) return `₹ ${(amount / 1_00_00_000).toFixed(1)} Cr`;
  if (amount >= 1_00_000) return `₹ ${(amount / 1_00_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹ ${(amount / 1_000).toFixed(1)} K`;
  return `₹ ${amount.toLocaleString('en-IN')}`;
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BorrowerCollections() {
  const [collections, setCollections] = useState<BorrowerCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalCollected: 0, totalPending: 0, overdueCount: 0, totalPenalties: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getBorrowerCollections({
          page: currentPage,
          limit: pageSize,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          search: debouncedSearch.trim() || undefined,
        });
        if (isMounted) {
          if (res && 'data' in res && 'pagination' in res) {
            setCollections(res.data);
            setTotal(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
            if (res.summary) setSummary(res.summary);
          } else if (Array.isArray(res)) {
            setCollections(res);
            setTotal(res.length);
            setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [currentPage, pageSize, statusFilter, debouncedSearch]);

  const paginatedCollections = collections;
  const totalCollected = summary.totalCollected;
  const totalPending = summary.totalPending;
  const overdueCount = summary.overdueCount;
  const totalPenalties = summary.totalPenalties;

  if (loading) return <div className="p-6 text-slate-500">Loading collections...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Collections</h1>
        <p className="text-slate-600 mt-1 text-sm">Track repayments from borrowers</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Total Collected</p>
          <p className="text-lg font-bold text-emerald-700">{formatAmount(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Pending</p>
          <p className="text-lg font-bold text-amber-700">{formatAmount(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Overdue / Defaulted</p>
          <p className="text-lg font-bold text-red-700">{overdueCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Penalties</p>
          <p className="text-lg font-bold text-orange-700">{formatAmount(totalPenalties)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>
          <input type="text" placeholder="Search borrower, loan ID..."
            aria-label="Search borrower or loan ID"
            value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-auto min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            aria-label="Filter collections by status"
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="All">All Status</option>
            <option value="Received">Received</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Partial">Partial</option>
            <option value="Defaulted">Defaulted</option>
          </select>
        </div>
      </div>

      {/* Collections Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Loan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Borrower</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Principal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Overdue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Penalty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCollections.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-sky-600">{c.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{c.loanId}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{c.borrowerName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(c.paymentDate)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700">{formatAmount(c.interestPaid)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatAmount(c.principalPaid)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatAmount(c.totalPaid)}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.overdueDays > 0 ? (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />{c.overdueDays}d
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-orange-700">{c.penalty > 0 ? formatAmount(c.penalty) : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{c.paymentMode}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                      c.status === 'Defaulted' ? 'bg-red-200 text-red-800' :
                      c.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
              {collections.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No collections found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span>
                Showing <span className="font-semibold">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(currentPage * pageSize, total).toLocaleString()}</span> of{' '}
                <span className="font-semibold">{total.toLocaleString()}</span> collections
              </span>
              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs text-slate-500">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-xs bg-white border border-slate-300 rounded">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
