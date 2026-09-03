import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Eye, Phone, Mail, Pencil } from 'lucide-react';
import { useInquiryCache } from '../context/InquiryCacheContext';
import InquiriesListSkeleton from '../components/InquiriesListSkeleton';
import { InquiryType, Priority, STAGE_LABELS } from '../types';
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
  const { inquiries, loading, error } = useInquiryCache();
  const [typeFilter, setTypeFilter] = useState<InquiryType | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInquiries = inquiries.filter((inquiry) => {
    const matchesType = typeFilter === 'All' || inquiry.type === typeFilter;
    const matchesPriority = priorityFilter === 'All' || inquiry.priority === priorityFilter;
    const matchesSearch =
      inquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.mobile.includes(searchQuery) ||
      inquiry.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesPriority && matchesSearch;
  });

  if (loading) return <InquiriesListSkeleton />;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-auto min-w-0 px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InquiryType | 'All')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Types</option>
            <option value="Borrower">Borrower</option>
            <option value="Investor">Investor</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'All')}
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
                  Loan Amount
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Turnover
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInquiries.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/inquiries/${inquiry.id}`);
                    }
                  }}
                  className="hover:bg-sky-50/70 cursor-pointer transition-colors focus:outline-none focus:bg-sky-50/70"
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-blue-600">{inquiry.id}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inquiry.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{inquiry.mobile}</span>
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{inquiry.email}</span>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inquiry.type === 'Borrower' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                      {inquiry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inquiry.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                      inquiry.priority === 'Warm' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                      {inquiry.priority}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{STAGE_LABELS[inquiry.stage] ?? inquiry.stage}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {inquiry.type === 'Borrower' && inquiry.borrowerDetails?.loanAmount != null
                        ? formatLoanAmount(Number(inquiry.borrowerDetails.loanAmount))
                        : '—'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{formatTurnover(inquiry.turnover)}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{inquiry.city || '—'}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/inquiries/${inquiry.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        type="button"
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
