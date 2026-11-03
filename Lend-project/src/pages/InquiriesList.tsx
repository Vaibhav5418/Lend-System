import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Eye, Phone, Mail, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { api } from '../api/client';
import InquiriesListSkeleton from '../components/InquiriesListSkeleton';
import type { Inquiry, InquiryType, Priority } from '../types';
import { STAGE_LABELS } from '../types';
import { formatCurrencyShort } from '../utils/formatters';

function formatLoanAmount(amount: number): string {
  if (amount >= 1_00_00_000) return `₹ ${(amount / 1_00_00_000).toFixed(amount % 1_00_00_000 === 0 ? 0 : 1)} Cr`;
  if (amount >= 1_00_000) return `₹ ${(amount / 1_00_000).toFixed(amount % 1_00_000 === 0 ? 0 : 1)} L`;
  return `₹ ${amount.toLocaleString('en-IN')}`;
}

function formatTurnover(turnover: string | undefined): string {
  if (!turnover || !turnover.trim()) return '—';
  const num = Number(String(turnover).replace(/,/g, '').trim());
  if (!Number.isNaN(num) && num >= 0) return formatCurrencyShort(num);
  return turnover;
}

export default function InquiriesList() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<InquiryType | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;
    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getInquiries({
          page: currentPage,
          limit: pageSize,
          type: typeFilter !== 'All' ? typeFilter : undefined,
          priority: priorityFilter !== 'All' ? priorityFilter : undefined,
          search: debouncedSearch.trim() || undefined,
        });
        if (!isMounted) return;
        if (res && 'data' in res && 'pagination' in res) {
          setInquiries(res.data);
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        } else if (Array.isArray(res)) {
          setInquiries(res);
          setTotal(res.length);
          setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to fetch inquiries');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void fetchPage();
    return () => {
      isMounted = false;
    };
  }, [currentPage, pageSize, typeFilter, priorityFilter, debouncedSearch]);

  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage all borrower and investor inquiries</p>
        </div>
        <button
          onClick={() => navigate('/inquiries/new')}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shrink-0"
        >
          + New Inquiry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <input
            type="text"
            placeholder="Search name, mobile, email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto min-w-0 px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />

          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value as InquiryType | 'All')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Types</option>
            <option value="Borrower">Borrower</option>
            <option value="Investor">Investor</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => handleFilterChange(setPriorityFilter, e.target.value as Priority | 'All')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Priorities</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </select>

          {(typeFilter !== 'All' || priorityFilter !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setTypeFilter('All');
                setPriorityFilter('All');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
          {loading ? (
            <InquiriesListSkeleton />
          ) : error ? (
            <div className="p-6 text-red-600 text-center">{error}</div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inquiry ID
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name & Contact
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No inquiries found matching criteria
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inquiry) => (
                    <tr
                      key={inquiry.id}
                      onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-blue-600">{inquiry.id}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{inquiry.name}</div>
                        <div className="flex flex-col gap-0.5 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {inquiry.mobile}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {inquiry.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inquiry.type === 'Borrower'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {inquiry.type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inquiry.priority === 'Hot'
                              ? 'bg-red-100 text-red-800'
                              : inquiry.priority === 'Warm'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {inquiry.priority}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {STAGE_LABELS[inquiry.stage] ?? inquiry.stage}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {inquiry.type === 'Borrower' && inquiry.borrowerDetails ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatLoanAmount(inquiry.borrowerDetails.loanAmount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {inquiry.borrowerDetails.tenure}m @ {inquiry.borrowerDetails.proposedInterest}%
                            </div>
                          </div>
                        ) : inquiry.type === 'Investor' && inquiry.investorDetails ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatLoanAmount(inquiry.investorDetails.investmentAmount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {inquiry.investorDetails.tenure}m @ {inquiry.investorDetails.expectedInterest}%
                            </div>
                          </div>
                        ) : (
                          formatTurnover(inquiry.turnover)
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {inquiry.assignedTo || '—'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inquiries/${inquiry.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inquiries/${inquiry.id}/edit`);
                            }}
                            className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>
                Showing <span className="font-semibold">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(currentPage * pageSize, total).toLocaleString()}</span> of{' '}
                <span className="font-semibold">{total.toLocaleString()}</span> inquiries
              </span>
              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs text-gray-500">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
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
                className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-xs bg-white border border-gray-300 rounded">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
