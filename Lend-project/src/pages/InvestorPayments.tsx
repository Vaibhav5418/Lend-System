import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { api } from '../api/client';
import type { InvestorPayment } from '../types';

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

export default function InvestorPayments() {
  const [payments, setPayments] = useState<InvestorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const payData = await api.getInvestorPayments();
      setPayments(payData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const filtered = payments
    .filter((p) => statusFilter === 'All' || p.status === statusFilter)
    .filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.investorName.toLowerCase().includes(q) || p.investmentId.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });

  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amountPaid, 0);
  const totalPending = payments.filter(p => p.status === 'Pending' || p.status === 'Overdue').reduce((s, p) => s + p.pendingInterest, 0);

  if (loading) return <div className="p-6 text-slate-500">Loading investor payments...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Investor Payments</h1>
        <p className="text-slate-600 mt-1 text-sm">Track payouts to investors</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Total Paid Out</p>
          <p className="text-lg font-bold text-emerald-700">{formatAmount(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Pending Interest</p>
          <p className="text-lg font-bold text-amber-700">{formatAmount(totalPending)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>
          <input
            type="text"
            placeholder="Search investor name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-auto min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          >
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Investment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Principal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-violet-600">{p.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.investmentId}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{p.investorName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700 font-medium">{formatAmount(p.interestPaid)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatAmount(p.principalPaid)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatAmount(p.amountPaid)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.paymentMode}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                      p.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
