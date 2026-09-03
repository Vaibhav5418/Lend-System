import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Phone, Mail, Pencil, GripVertical } from 'lucide-react';
import { useInquiryCache } from '../context/InquiryCacheContext';
import { api } from '../api/client';
import type { Inquiry } from '../types';

function formatAmount(amount: number): string {
  if (amount >= 1_00_00_000) return `₹ ${(amount / 1_00_00_000).toFixed(1)} Cr`;
  if (amount >= 1_00_000) return `₹ ${(amount / 1_00_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹ ${(amount / 1_000).toFixed(1)} K`;
  return `₹ ${amount.toLocaleString('en-IN')}`;
}

const STAGE_COLUMNS: { key: string; label: string; color: string; dot: string; cardBorder: string }[] = [
  { key: 'NEW', label: 'New', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', cardBorder: 'border-l-blue-500' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500', cardBorder: 'border-l-sky-500' },
  { key: 'MEETING', label: 'Meeting', color: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500', cardBorder: 'border-l-cyan-500' },
  { key: 'RATE_DISCUSSED', label: 'Rate Discussed', color: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', cardBorder: 'border-l-violet-500' },
  { key: 'AGREEMENT_DONE', label: 'Accept / Agreement Done', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', cardBorder: 'border-l-amber-500' },
  { key: 'FUND_RECEIVED', label: 'Fund Received', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', cardBorder: 'border-l-emerald-500' },
];

export default function InvestorInquiries() {
  const navigate = useNavigate();
  const { inquiries, loading, error, refetch } = useInquiryCache();
  const [searchQuery, setSearchQuery] = useState('');
  const [accepting, setAccepting] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState<Inquiry | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [stageUpdating, setStageUpdating] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});
  const [acceptForm, setAcceptForm] = useState({
    interestRate: '',
    interestRateType: 'yearly' as 'monthly' | 'yearly',
    tenureMonths: '',
    investmentPlan: 'custom',
    payoutFrequency: 'monthly' as 'monthly' | 'quarterly' | 'on_maturity',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const investorInquiries = inquiries
    .filter((i) => i.type === 'Investor')
    .filter((i) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.mobile.includes(q) || i.email.toLowerCase().includes(q);
    });

  const handleAccept = async () => {
    if (!showAcceptModal) return;
    setAccepting(showAcceptModal.id);
    try {
      await api.createInvestorInvestment({
        inquiryId: showAcceptModal.id,
        investorName: showAcceptModal.name,
        mobile: showAcceptModal.mobile,
        email: showAcceptModal.email,
        investedAmount: showAcceptModal.investorDetails?.investmentAmount || 0,
        interestRate: Number(acceptForm.interestRate) || showAcceptModal.investorDetails?.expectedInterest || 0,
        interestRateType: acceptForm.interestRateType,
        tenureMonths: Number(acceptForm.tenureMonths) || showAcceptModal.investorDetails?.tenure || 0,
        investmentPlan: acceptForm.investmentPlan,
        payoutFrequency: acceptForm.payoutFrequency,
        startDate: acceptForm.startDate,
        notes: acceptForm.notes,
      });
      await refetch();
      setShowAcceptModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setAccepting(null);
    }
  };

  const openAcceptModal = (inq: Inquiry) => {
    const freqMap: Record<string, 'monthly' | 'quarterly' | 'on_maturity'> = {
      'Monthly': 'monthly',
      'Quarterly': 'quarterly',
      'Half-Yearly': 'on_maturity',
      'Yearly': 'on_maturity',
    };
    setAcceptForm({
      interestRate: String(inq.investorDetails?.expectedInterest || ''),
      interestRateType: 'yearly',
      tenureMonths: String(inq.investorDetails?.tenure || ''),
      investmentPlan: 'custom',
      payoutFrequency: freqMap[inq.investorDetails?.frequency || ''] || 'monthly',
      startDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowAcceptModal(inq);
  };

  // ─── Drag & Drop handlers ─────────────────────────────────
  const handleDragStart = (e: React.DragEvent, inqId: string) => {
    setDraggingId(inqId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', inqId);
  };

  const handleDragEnter = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) + 1;
    setDragOverCol(colKey);
  };

  const handleDragLeave = (_e: React.DragEvent, colKey: string) => {
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) - 1;
    if (dragCounter.current[colKey] <= 0) {
      dragCounter.current[colKey] = 0;
      if (dragOverCol === colKey) setDragOverCol(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverCol(null);
    dragCounter.current = {};
    const inqId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    if (!inqId) return;
    const inq = investorInquiries.find((i) => i.id === inqId);
    if (!inq || inq.stage === targetStage) return;

    // Dropping on "Accept / Agreement Done" → open accept modal to create investment
    if (targetStage === 'AGREEMENT_DONE') {
      openAcceptModal(inq);
      return;
    }

    setStageUpdating(inqId);
    try {
      await api.updateInquiryStage(inqId, targetStage);
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update stage');
    } finally {
      setStageUpdating(null);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
  };

  if (loading) return <div className="p-6 text-slate-500">Loading investor inquiries...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Investor Inquiries</h1>
        <p className="text-slate-600 mt-1 text-sm">Manage investor intent and fund acceptance</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <input
          type="text"
          placeholder="Search name, mobile, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STAGE_COLUMNS.map((col) => {
          const items = investorInquiries.filter((i) => i.stage === col.key);
          const colTotal = items.reduce((s, i) => s + (i.investorDetails?.investmentAmount || 0), 0);
          return (
            <div
              key={col.key}
              onDragEnter={(e) => handleDragEnter(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`flex-shrink-0 w-[300px] rounded-xl border ${col.color} flex flex-col max-h-[75vh] transition-all duration-150 ${dragOverCol === col.key && draggingId ? 'ring-2 ring-violet-400 ring-offset-2 scale-[1.01]' : ''
                }`}
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                    <span className="text-xs bg-white/80 text-slate-600 font-medium px-1.5 py-0.5 rounded-full border border-slate-200">{items.length}</span>
                  </div>
                  {colTotal > 0 && <span className="text-xs font-semibold text-slate-600">{formatAmount(colTotal)}</span>}
                </div>
              </div>
              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {items.length === 0 && (
                  <p className={`text-xs text-center py-6 ${dragOverCol === col.key && draggingId ? 'text-violet-500 font-medium' : 'text-slate-400'}`}>
                    {dragOverCol === col.key && draggingId ? 'Drop here' : 'No inquiries'}
                  </p>
                )}
                {items.map((inq) => (
                  <div
                    key={inq.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, inq.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border border-l-4 ${col.cardBorder} shadow-sm hover:shadow-md transition-all p-3 ${draggingId === inq.id ? 'opacity-40 scale-95' : ''
                      } ${stageUpdating === inq.id ? 'opacity-60 pointer-events-none' : ''} cursor-grab active:cursor-grabbing`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="flex items-start gap-1 min-w-0">
                        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{inq.name}</p>
                          <p className="text-xs text-violet-600 font-mono">{inq.id}</p>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${inq.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                        inq.priority === 'Warm' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{inq.priority}</span>
                    </div>
                    {stageUpdating === inq.id && (
                      <p className="text-xs text-violet-600 font-medium mb-1">Moving...</p>
                    )}

                    {/* Contact */}
                    <div className="flex flex-col gap-0.5 mb-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 truncate"><Phone className="w-3 h-3 flex-shrink-0" />{inq.mobile}</span>
                      <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{inq.email}</span>
                    </div>

                    {/* Details */}
                    {inq.investorDetails && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
                        <div><span className="text-slate-400">Amount:</span> <span className="text-slate-800 font-semibold">{formatAmount(inq.investorDetails.investmentAmount)}</span></div>
                        <div><span className="text-slate-400">Rate:</span> <span className="text-slate-700">{inq.investorDetails.expectedInterest}%</span></div>
                        <div><span className="text-slate-400">Tenure:</span> <span className="text-slate-700">{inq.investorDetails.tenure} mo</span></div>
                        {inq.investorDetails.frequency && (
                          <div><span className="text-slate-400">Freq:</span> <span className="text-slate-700">{inq.investorDetails.frequency}</span></div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => navigate(`/inquiries/${inq.id}`)}
                        className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />View
                      </button>
                      <button
                        onClick={() => navigate(`/inquiries/${inq.id}/edit`)}
                        className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Accept Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Accept Investment</h3>
            <p className="text-sm text-slate-500 mb-4">
              Accept <span className="font-medium">{showAcceptModal.name}</span>&apos;s investment and move to active.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={acceptForm.interestRate}
                  onChange={(e) => setAcceptForm({ ...acceptForm, interestRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate Type</label>
                <select
                  value={acceptForm.interestRateType}
                  onChange={(e) => setAcceptForm({ ...acceptForm, interestRateType: e.target.value as 'monthly' | 'yearly' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tenure (months)</label>
                <input
                  type="number"
                  value={acceptForm.tenureMonths}
                  onChange={(e) => setAcceptForm({ ...acceptForm, tenureMonths: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payout Frequency</label>
                <select
                  value={acceptForm.payoutFrequency}
                  onChange={(e) => setAcceptForm({ ...acceptForm, payoutFrequency: e.target.value as 'monthly' | 'quarterly' | 'on_maturity' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="on_maturity">On Maturity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Investment Plan</label>
                <select
                  value={acceptForm.investmentPlan}
                  onChange={(e) => setAcceptForm({ ...acceptForm, investmentPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                >
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={acceptForm.startDate}
                  onChange={(e) => setAcceptForm({ ...acceptForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={acceptForm.notes}
                onChange={(e) => setAcceptForm({ ...acceptForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAcceptModal(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium"
              >Cancel</button>
              <button
                onClick={handleAccept}
                disabled={!!accepting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
              >{accepting ? 'Accepting...' : 'Accept & Activate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
