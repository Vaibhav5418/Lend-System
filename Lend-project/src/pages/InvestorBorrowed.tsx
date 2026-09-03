import { useState, useEffect } from 'react';
import { Filter, Eye, Calendar, TrendingUp, Users, CreditCard } from 'lucide-react';
import { api } from '../api/client';
import type { InvestorInvestment, InvestorPayment, UpcomingPayout, PaymentMode } from '../types';
import { formatIndianShort, formatCurrencyShort } from '../utils/formatters';

const PAYMENT_MODES: PaymentMode[] = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other'];

function formatAmount(amount: number): string {
  return formatCurrencyShort(amount);
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvestorBorrowed() {
  const [investments, setInvestments] = useState<InvestorInvestment[]>([]);
  const [upcomingPayouts, setUpcomingPayouts] = useState<UpcomingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInv, setSelectedInv] = useState<InvestorInvestment | null>(null);
  const [paymentInv, setPaymentInv] = useState<InvestorInvestment | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [payForm, setPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    interestPaid: '',
    principalPaid: '',
    pendingInterest: '',
    paymentMode: 'Bank Transfer' as PaymentMode,
    status: 'Paid' as string,
    remarks: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [invData, payouts] = await Promise.all([
        api.getInvestorInvestments(),
        api.getUpcomingPayouts(),
      ]);
      setInvestments(invData);
      setUpcomingPayouts(payouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const openPaymentModal = (inv: InvestorInvestment) => {
    setPayForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      interestPaid: String(inv.monthlyInterest || ''),
      principalPaid: '',
      pendingInterest: '',
      paymentMode: 'Bank Transfer',
      status: 'Paid',
      remarks: '',
    });
    setPaymentInv(inv);
  };

  const handleRecordPayment = async () => {
    if (!paymentInv) return;
    setSubmittingPayment(true);
    try {
      await api.createInvestorPayment({
        investmentId: paymentInv.id,
        investorName: paymentInv.investorName,
        paymentDate: payForm.paymentDate,
        dueDate: payForm.dueDate || undefined,
        amountPaid: (Number(payForm.interestPaid) || 0) + (Number(payForm.principalPaid) || 0),
        interestPaid: Number(payForm.interestPaid) || 0,
        principalPaid: Number(payForm.principalPaid) || 0,
        pendingInterest: Number(payForm.pendingInterest) || 0,
        paymentFrequency: paymentInv.payoutFrequency || 'monthly',
        paymentMode: payForm.paymentMode,
        status: payForm.status as InvestorPayment['status'],
        remarks: payForm.remarks,
      });
      await loadData();
      setPaymentInv(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filtered = investments
    .filter((i) => statusFilter === 'All' || i.status === statusFilter)
    .filter((i) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return i.investorName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
    });

  const totals = {
    invested: investments.filter(i => i.status === 'Active').reduce((s, i) => s + i.investedAmount, 0),
    monthlyInterest: investments.filter(i => i.status === 'Active').reduce((s, i) => s + i.monthlyInterest, 0),
    active: investments.filter(i => i.status === 'Active').length,
  };

  if (loading) return <div className="p-6 text-slate-500">Loading active investments...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Borrowed (Active Investments)</h1>
        <p className="text-slate-600 mt-1 text-sm">Investors whose funds are deployed</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Total Active Invested</p>
          <p className="text-lg font-bold text-slate-900">{formatAmount(totals.invested)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Monthly Interest Outflow</p>
          <p className="text-lg font-bold text-slate-900">{formatAmount(totals.monthlyInterest)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Active Investors</p>
          <p className="text-lg font-bold text-slate-900">{totals.active}</p>
        </div>
      </div>

      {/* Upcoming Payouts Widget */}
      {upcomingPayouts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming Payouts (Next 30 Days)
          </h3>
          <div className="flex flex-wrap gap-3">
            {upcomingPayouts.slice(0, 5).map((p, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-amber-900">{p.investorName}</span>
                <span className="text-amber-700 ml-2">{formatAmount(p.payoutAmount)}</span>
                <span className="text-amber-600 ml-2 text-xs">{formatDate(p.nextPayoutDate)}</span>
                {p.isMaturity && <span className="ml-1 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Maturity</span>}
              </div>
            ))}
          </div>
        </div>
      )}

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
            className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Matured">Matured</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invested</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tenure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Monthly Int.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payout Freq.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Maturity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-violet-50/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-violet-600">{inv.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{inv.investorName}</p>
                    <p className="text-xs text-slate-500">{inv.email}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-900">{formatAmount(inv.investedAmount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {inv.interestRate}% <span className="text-xs text-slate-500">({inv.interestRateType})</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{inv.tenureMonths} mo</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-emerald-700 font-medium">{formatAmount(inv.monthlyInterest)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 capitalize">{inv.payoutFrequency?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{formatDate(inv.maturityDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                      inv.status === 'Matured' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInv(inv)}
                        className="text-slate-600 hover:text-slate-900 text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />Details
                      </button>
                      {inv.status === 'Active' && (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="text-violet-600 hover:text-violet-800 text-sm flex items-center gap-1"
                        >
                          <CreditCard className="w-4 h-4" />Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">No investments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Investment {selectedInv.id}</h3>
              <button onClick={() => setSelectedInv(null)} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><span className="text-slate-500">Investor:</span> <span className="font-medium">{selectedInv.investorName}</span></div>
              <div><span className="text-slate-500">Amount:</span> <span className="font-semibold">{formatAmount(selectedInv.investedAmount)}</span></div>
              <div><span className="text-slate-500">Rate:</span> {selectedInv.interestRate}% ({selectedInv.interestRateType})</div>
              <div><span className="text-slate-500">Tenure:</span> {selectedInv.tenureMonths} months</div>
              <div><span className="text-slate-500">Monthly Interest:</span> <span className="text-emerald-700 font-medium">{formatAmount(selectedInv.monthlyInterest)}</span></div>
              <div><span className="text-slate-500">Total Interest:</span> {formatAmount(selectedInv.totalInterest)}</div>
              <div><span className="text-slate-500">Total Payout:</span> <span className="font-semibold">{formatAmount(selectedInv.totalPayout)}</span></div>
              <div><span className="text-slate-500">Payout Frequency:</span> <span className="capitalize">{selectedInv.payoutFrequency?.replace('_', ' ')}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedInv.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{selectedInv.status}</span></div>
              <div><span className="text-slate-500">Start Date:</span> {formatDate(selectedInv.startDate)}</div>
              <div><span className="text-slate-500">Maturity Date:</span> {formatDate(selectedInv.maturityDate)}</div>
              <div><span className="text-slate-500">Inquiry ID:</span> {selectedInv.inquiryId}</div>
            </div>

            {/* Payout Schedule */}
            {(() => {
              const schedule: { month: number; dueDate: Date; interest: number; principal: number; total: number; isMaturity: boolean }[] = [];
              const start = new Date(selectedInv.startDate);
              const freq = selectedInv.payoutFrequency || 'monthly';
              const intervalMonths = freq === 'quarterly' ? 3 : freq === 'on_maturity' ? selectedInv.tenureMonths : 1;
              const interestPerMonth = selectedInv.monthlyInterest;
              const steps = Math.ceil(selectedInv.tenureMonths / intervalMonths);

              for (let i = 1; i <= steps; i++) {
                const monthNum = i * intervalMonths;
                const dueDate = new Date(start);
                dueDate.setMonth(dueDate.getMonth() + monthNum);
                const isLast = i === steps;
                const interest = Math.round(interestPerMonth * intervalMonths * 100) / 100;
                const principal = isLast ? selectedInv.investedAmount : 0;
                schedule.push({
                  month: monthNum,
                  dueDate,
                  interest,
                  principal,
                  total: Math.round((interest + principal) * 100) / 100,
                  isMaturity: isLast,
                });
              }

              return schedule.length > 0 ? (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Payout Schedule</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">#</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">Due Date</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">Interest</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">Principal</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">Total Payout</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {schedule.map((entry, idx) => {
                          const now = new Date();
                          const isPast = entry.dueDate < now;
                          return (
                            <tr key={idx} className={`hover:bg-slate-50 ${entry.isMaturity ? 'bg-violet-50/50' : ''}`}>
                              <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                              <td className="px-3 py-2 text-slate-700">{formatDate(entry.dueDate.toISOString())}</td>
                              <td className="px-3 py-2 text-emerald-700 font-medium">{formatAmount(entry.interest)}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.principal > 0 ? formatAmount(entry.principal) : '—'}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{formatAmount(entry.total)}</td>
                              <td className="px-3 py-2">
                                {entry.isMaturity ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">Maturity</span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isPast ? 'Due' : 'Upcoming'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-600" colSpan={2}>Total</td>
                          <td className="px-3 py-2 text-xs font-semibold text-emerald-700">{formatAmount(selectedInv.totalInterest)}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatAmount(selectedInv.investedAmount)}</td>
                          <td className="px-3 py-2 text-xs font-bold text-slate-900">{formatAmount(selectedInv.totalPayout)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null;
            })()}

            {selectedInv.linkedBorrowers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Linked Borrowers</h4>
                <div className="space-y-1">
                  {selectedInv.linkedBorrowers.map((lb, i) => (
                    <div key={i} className="text-sm text-slate-600">Loan {lb.loanId} — {formatAmount(lb.allocatedAmount)}</div>
                  ))}
                </div>
              </div>
            )}
            {selectedInv.notes && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes</h4>
                <p className="text-sm text-slate-600">{selectedInv.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />Record Payment
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {paymentInv.investorName} &mdash; {paymentInv.id} ({formatAmount(paymentInv.investedAmount)})
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                  <input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="date" value={payForm.dueDate} onChange={(e) => setPayForm({ ...payForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Paid (₹)</label>
                  <input type="number" value={payForm.interestPaid} onChange={(e) => setPayForm({ ...payForm, interestPaid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  {payForm.interestPaid && (
                    <p className="mt-1 text-xs text-violet-600 font-medium ml-1">
                      {formatIndianShort(payForm.interestPaid)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Principal Paid (₹)</label>
                  <input type="number" value={payForm.principalPaid} onChange={(e) => setPayForm({ ...payForm, principalPaid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="0 (on maturity)" />
                  {payForm.principalPaid && (
                    <p className="mt-1 text-xs text-violet-600 font-medium ml-1">
                      {formatIndianShort(payForm.principalPaid)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                  <select value={payForm.paymentMode} onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value as PaymentMode })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={payForm.status} onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setPaymentInv(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium">Cancel</button>
              <button onClick={handleRecordPayment} disabled={submittingPayment}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50">
                {submittingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
