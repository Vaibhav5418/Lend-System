import { useState, useEffect } from 'react';
import { Filter, Eye, Calendar, TrendingUp, Users, AlertTriangle, Receipt } from 'lucide-react';
import { api } from '../api/client';
import type { BorrowerLoan, UpcomingDue, PaymentMode, CollectionStatus } from '../types';
import { formatIndianShort, formatCurrencyShort } from '../utils/formatters';

const PAYMENT_MODES: PaymentMode[] = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other'];

function formatAmount(amount: number): string {
  return formatCurrencyShort(amount);
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BorrowerLended() {
  const [loans, setLoans] = useState<BorrowerLoan[]>([]);
  const [upcomingDues, setUpcomingDues] = useState<UpcomingDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<BorrowerLoan | null>(null);
  const [collectionLoan, setCollectionLoan] = useState<BorrowerLoan | null>(null);
  const [submittingCol, setSubmittingCol] = useState(false);
  const [colForm, setColForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    scheduleMonth: '',
    interestPaid: '',
    principalPaid: '',
    pendingAmount: '',
    penalty: '',
    paymentMode: 'Bank Transfer' as PaymentMode,
    status: 'Received' as CollectionStatus,
    remarks: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [loanData, dues] = await Promise.all([
        api.getBorrowerLoans(),
        api.getUpcomingDues(),
      ]);
      setLoans(loanData);
      setUpcomingDues(dues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const openCollectionModal = (loan: BorrowerLoan) => {
    setColForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      scheduleMonth: '',
      interestPaid: String(loan.monthlyInterest || ''),
      principalPaid: '',
      pendingAmount: '',
      penalty: '',
      paymentMode: 'Bank Transfer',
      status: 'Received',
      remarks: '',
    });
    setCollectionLoan(loan);
  };

  const handleRecordCollection = async () => {
    if (!collectionLoan) return;
    setSubmittingCol(true);
    try {
      await api.createBorrowerCollection({
        loanId: collectionLoan.id,
        borrowerName: collectionLoan.borrowerName,
        paymentDate: colForm.paymentDate,
        dueDate: colForm.dueDate || undefined,
        scheduleMonth: Number(colForm.scheduleMonth) || undefined,
        interestPaid: Number(colForm.interestPaid) || 0,
        principalPaid: Number(colForm.principalPaid) || 0,
        pendingAmount: Number(colForm.pendingAmount) || 0,
        penalty: Number(colForm.penalty) || 0,
        paymentMode: colForm.paymentMode,
        status: colForm.status,
        remarks: colForm.remarks,
      });
      await loadData();
      setCollectionLoan(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record collection');
    } finally {
      setSubmittingCol(false);
    }
  };

  const filtered = loans
    .filter((l) => statusFilter === 'All' || l.status === statusFilter)
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return l.borrowerName.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.companyName?.toLowerCase().includes(q);
    });

  const totals = {
    deployed: loans.filter(l => l.status === 'Active').reduce((s, l) => s + l.approvedAmount, 0),
    monthlyIncome: loans.filter(l => l.status === 'Active').reduce((s, l) => s + l.monthlyInterest, 0),
    active: loans.filter(l => l.status === 'Active').length,
    defaulted: loans.filter(l => l.status === 'Defaulted').length,
  };

  const overdueDues = upcomingDues.filter(d => d.isOverdue);

  if (loading) return <div className="p-6 text-slate-500">Loading loans...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lended (Active Loans)</h1>
        <p className="text-slate-600 mt-1 text-sm">Active borrower loans with repayment tracking</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-sky-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Total Deployed</p>
          <p className="text-lg font-bold text-slate-900">{formatAmount(totals.deployed)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Monthly Interest Income</p>
          <p className="text-lg font-bold text-slate-900">{formatAmount(totals.monthlyIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-medium">Active Loans</p>
          <p className="text-lg font-bold text-slate-900">{totals.active}</p>
        </div>
        {totals.defaulted > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-red-500 uppercase font-medium">Defaulted</p>
            <p className="text-lg font-bold text-red-700">{totals.defaulted}</p>
          </div>
        )}
      </div>

      {/* Upcoming Dues Widget */}
      {upcomingDues.length > 0 && (
        <div className={`bg-white rounded-xl shadow-sm border p-4 ${overdueDues.length > 0 ? 'border-red-200' : 'border-amber-200'}`}>
          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${overdueDues.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            <Calendar className="w-4 h-4" />
            Upcoming Interest Dues (Next 30 Days)
            {overdueDues.length > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overdueDues.length} Overdue</span>}
          </h3>
          <div className="flex flex-wrap gap-3">
            {upcomingDues.slice(0, 6).map((d, i) => (
              <div key={i} className={`border rounded-lg px-3 py-2 text-sm ${d.isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`font-medium ${d.isOverdue ? 'text-red-900' : 'text-amber-900'}`}>{d.borrowerName}</span>
                <span className={`ml-2 ${d.isOverdue ? 'text-red-700' : 'text-amber-700'}`}>{formatAmount(d.totalDue)}</span>
                <span className={`ml-2 text-xs ${d.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{formatDate(d.dueDate)}</span>
                {d.isOverdue && <span className="ml-1 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">Overdue</span>}
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
          <input type="text" placeholder="Search borrower, loan ID, company..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-auto min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
            <option value="Defaulted">Defaulted</option>
          </select>
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Borrower</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tenure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Monthly Int.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((loan) => (
                <tr key={loan.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-sky-600">{loan.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{loan.borrowerName}</p>
                    {loan.companyName && <p className="text-xs text-slate-500">{loan.companyName}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatAmount(loan.approvedAmount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{loan.interestRate}% <span className="text-xs text-slate-500">({loan.interestRateType})</span></td>
                  <td className="px-4 py-3 text-sm text-slate-900">{loan.tenureMonths} mo</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{loan.repaymentType}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700 font-medium">{formatAmount(loan.monthlyInterest)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(loan.endDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${loan.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                      loan.status === 'Defaulted' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{loan.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedLoan(loan)}
                        className="text-slate-600 hover:text-slate-900 text-sm flex items-center gap-1">
                        <Eye className="w-4 h-4" />Details
                      </button>
                      {loan.status === 'Active' && (
                        <button onClick={() => openCollectionModal(loan)}
                          className="text-sky-600 hover:text-sky-800 text-sm flex items-center gap-1">
                          <Receipt className="w-4 h-4" />Collect
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No loans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal with Repayment Schedule */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Loan {selectedLoan.id}</h3>
              <button onClick={() => setSelectedLoan(null)} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
              <div><span className="text-slate-500">Borrower:</span> <span className="font-medium">{selectedLoan.borrowerName}</span></div>
              {selectedLoan.companyName && <div><span className="text-slate-500">Company:</span> {selectedLoan.companyName}</div>}
              <div><span className="text-slate-500">Amount:</span> <span className="font-semibold">{formatAmount(selectedLoan.approvedAmount)}</span></div>
              <div><span className="text-slate-500">Rate:</span> {selectedLoan.interestRate}% ({selectedLoan.interestRateType})</div>
              <div><span className="text-slate-500">Tenure:</span> {selectedLoan.tenureMonths} months</div>
              <div><span className="text-slate-500">Repayment:</span> {selectedLoan.repaymentFrequency}</div>
              <div><span className="text-slate-500">Type:</span> {selectedLoan.repaymentType}</div>
              <div><span className="text-slate-500">Monthly Int:</span> <span className="text-emerald-700">{formatAmount(selectedLoan.monthlyInterest)}</span></div>
              <div><span className="text-slate-500">Total Interest:</span> {formatAmount(selectedLoan.totalInterest)}</div>
              <div><span className="text-slate-500">Total Repayable:</span> <span className="font-semibold">{formatAmount(selectedLoan.totalRepayable)}</span></div>
              <div><span className="text-slate-500">Start:</span> {formatDate(selectedLoan.startDate)}</div>
              <div><span className="text-slate-500">End:</span> {formatDate(selectedLoan.endDate)}</div>
              {selectedLoan.loanPurpose && <div className="col-span-2"><span className="text-slate-500">Purpose:</span> {selectedLoan.loanPurpose}</div>}
            </div>

            {/* Repayment Schedule */}
            {selectedLoan.repaymentSchedule.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Repayment Schedule</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Month</th>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Due Date</th>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Interest</th>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Principal</th>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Total</th>
                        <th className="px-3 py-2 text-left text-xs text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLoan.repaymentSchedule.map((entry) => (
                        <tr key={entry.month} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700">{entry.month}</td>
                          <td className="px-3 py-2 text-slate-700">{formatDate(entry.dueDate)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatAmount(entry.interestDue)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatAmount(entry.principalDue)}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{formatAmount(entry.totalDue)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              entry.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{entry.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedLoan.investorMapping.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Investor Mapping</h4>
                <div className="space-y-1">
                  {selectedLoan.investorMapping.map((m, i) => (
                    <div key={i} className="text-sm text-slate-600">Investment {m.investmentId} — {formatAmount(m.allocatedAmount)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Collection Modal */}
      {collectionLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Receipt className="w-5 h-5" />Record Collection
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {collectionLoan.borrowerName} &mdash; {collectionLoan.id} ({formatAmount(collectionLoan.approvedAmount)})
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                  <input type="date" value={colForm.paymentDate} onChange={(e) => setColForm({ ...colForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Month</label>
                  <input type="number" value={colForm.scheduleMonth} onChange={(e) => setColForm({ ...colForm, scheduleMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. 3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Paid (₹)</label>
                  <input type="number" value={colForm.interestPaid} onChange={(e) => setColForm({ ...colForm, interestPaid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  {colForm.interestPaid && (
                    <p className="mt-1 text-xs text-sky-600 font-medium ml-1">
                      {formatIndianShort(colForm.interestPaid)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Principal Paid (₹)</label>
                  <input type="number" value={colForm.principalPaid} onChange={(e) => setColForm({ ...colForm, principalPaid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="0" />
                  {colForm.principalPaid && (
                    <p className="mt-1 text-xs text-sky-600 font-medium ml-1">
                      {formatIndianShort(colForm.principalPaid)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Penalty (₹)</label>
                  <input type="number" value={colForm.penalty} onChange={(e) => setColForm({ ...colForm, penalty: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="0" />
                  {colForm.penalty && (
                    <p className="mt-1 text-xs text-rose-600 font-medium ml-1">
                      {formatIndianShort(colForm.penalty)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                  <select value={colForm.paymentMode} onChange={(e) => setColForm({ ...colForm, paymentMode: e.target.value as PaymentMode })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={colForm.status} onChange={(e) => setColForm({ ...colForm, status: e.target.value as CollectionStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="Received">Received</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pending Amount (₹)</label>
                  <input type="number" value={colForm.pendingAmount} onChange={(e) => setColForm({ ...colForm, pendingAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="0" />
                  {colForm.pendingAmount && (
                    <p className="mt-1 text-xs text-amber-600 font-medium ml-1">
                      {formatIndianShort(colForm.pendingAmount)}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea value={colForm.remarks} onChange={(e) => setColForm({ ...colForm, remarks: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCollectionLoan(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium">Cancel</button>
              <button onClick={handleRecordCollection} disabled={submittingCol}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:opacity-50">
                {submittingCol ? 'Recording...' : 'Record Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
