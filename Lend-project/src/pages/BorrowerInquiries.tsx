import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Phone, Mail, Pencil, GripVertical } from 'lucide-react';
import { useInquiryCache } from '../context/InquiryCacheContext';
import { api } from '../api/client';
import type { Inquiry } from '../types';
import ProposalModal from '../components/ProposalModal';
import { formatCurrencyShort } from '../utils/formatters';

function formatAmount(amount: number): string {
  return formatCurrencyShort(amount);
}

const STAGE_COLUMNS: { key: string; label: string; color: string; dot: string; cardBorder: string }[] = [
  { key: 'NEW', label: 'New', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', cardBorder: 'border-l-blue-500' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500', cardBorder: 'border-l-sky-500' },
  { key: 'MEETING', label: 'Meeting', color: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500', cardBorder: 'border-l-cyan-500' },
  { key: 'DOCS_PENDING', label: 'Docs Pending', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', cardBorder: 'border-l-amber-500' },
  { key: 'VERIFIED', label: 'Verified', color: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', cardBorder: 'border-l-violet-500' },
  { key: 'PROPOSED', label: 'Proposed', color: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500', cardBorder: 'border-l-indigo-500' },
  { key: 'APPROVED', label: 'Approved', color: 'bg-teal-50 border-teal-200', dot: 'bg-teal-500', cardBorder: 'border-l-teal-500' },
  { key: 'DISBURSED', label: 'Disbursed', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', cardBorder: 'border-l-emerald-500' },
];

export default function BorrowerInquiries() {
  const navigate = useNavigate();
  const { inquiries, loading, error, refetch } = useInquiryCache();
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [stageUpdating, setStageUpdating] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // Proposal modal state (drag → PROPOSED)
  const [proposalInquiry, setProposalInquiry] = useState<Inquiry | null>(null);

  // Approve & Lend modal state (drag → APPROVED)
  const [approveInquiry, setApproveInquiry] = useState<Inquiry | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveForm, setApproveForm] = useState({
    interestRate: '',
    interestRateType: 'yearly' as 'monthly' | 'yearly',
    tenureMonths: '',
    repaymentType: 'Interest-Only' as 'Interest-Only' | 'Bullet',
    repaymentFrequency: 'Monthly' as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const borrowerInquiries = inquiries
    .filter((i) => i.type === 'Borrower')
    .filter((i) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.mobile.includes(q) || i.email.toLowerCase().includes(q);
    });

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

  // Open Approve modal and pre-fill from inquiry
  const openApproveModal = (inq: Inquiry) => {
    setApproveForm({
      interestRate: String(inq.borrowerDetails?.proposedInterest || ''),
      interestRateType: 'yearly',
      tenureMonths: String(inq.borrowerDetails?.tenure || ''),
      repaymentType: 'Interest-Only',
      repaymentFrequency: inq.borrowerDetails?.frequency || 'Monthly',
      startDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setApproveInquiry(inq);
  };

  // Create BorrowerLoan and move to Lended
  const handleApproveLoan = async () => {
    if (!approveInquiry) return;
    setApproving(true);
    try {
      await api.createBorrowerLoan({
        inquiryId: approveInquiry.id,
        borrowerName: approveInquiry.name,
        companyName: (approveInquiry as any).companyName || '',
        mobile: approveInquiry.mobile,
        email: approveInquiry.email,
        approvedAmount: approveInquiry.borrowerDetails?.loanAmount || 0,
        interestRate: Number(approveForm.interestRate) || approveInquiry.borrowerDetails?.proposedInterest || 0,
        interestRateType: approveForm.interestRateType,
        tenureMonths: Number(approveForm.tenureMonths) || approveInquiry.borrowerDetails?.tenure || 0,
        repaymentType: approveForm.repaymentType,
        repaymentFrequency: approveForm.repaymentFrequency,
        startDate: approveForm.startDate,
        loanPurpose: approveInquiry.notes || '',
        notes: approveForm.notes,
      });
      await refetch();
      setApproveInquiry(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve loan');
    } finally {
      setApproving(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverCol(null);
    dragCounter.current = {};
    const inqId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    if (!inqId) return;
    const inq = borrowerInquiries.find((i) => i.id === inqId);
    if (!inq || inq.stage === targetStage) return;

    // Dropping on "Proposed" → open Proposal modal
    if (targetStage === 'PROPOSED') {
      setProposalInquiry(inq);
      return;
    }

    // Dropping on "Approved" → open Approve & Lend modal (creates BorrowerLoan → moves to Lended)
    if (targetStage === 'APPROVED') {
      openApproveModal(inq);
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

  if (loading) return <div className="p-6 text-slate-500">Loading borrower inquiries...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Borrower Inquiries</h1>
        <p className="text-slate-600 mt-1 text-sm">Manage loan demands, proposals, and approvals</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <input
          type="text"
          placeholder="Search name, mobile, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STAGE_COLUMNS.map((col) => {
          const items = borrowerInquiries.filter((i) => i.stage === col.key);
          const colTotal = items.reduce((s, i) => s + (i.borrowerDetails?.loanAmount || 0), 0);
          return (
            <div
              key={col.key}
              onDragEnter={(e) => handleDragEnter(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`flex-shrink-0 w-[300px] rounded-xl border ${col.color} flex flex-col max-h-[75vh] transition-all duration-150 ${dragOverCol === col.key && draggingId ? 'ring-2 ring-sky-400 ring-offset-2 scale-[1.01]' : ''
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
                  <p className={`text-xs text-center py-6 ${dragOverCol === col.key && draggingId ? 'text-sky-500 font-medium' : 'text-slate-400'}`}>
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
                          <p className="text-xs text-sky-600 font-mono">{inq.id}</p>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${inq.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                        inq.priority === 'Warm' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{inq.priority}</span>
                    </div>
                    {stageUpdating === inq.id && (
                      <p className="text-xs text-sky-600 font-medium mb-1">Moving...</p>
                    )}

                    {/* Contact */}
                    <div className="flex flex-col gap-0.5 mb-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 truncate"><Phone className="w-3 h-3 flex-shrink-0" />{inq.mobile}</span>
                      <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{inq.email}</span>
                    </div>

                    {/* Details */}
                    {inq.borrowerDetails && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
                        <div><span className="text-slate-400">Amount:</span> <span className="text-slate-800 font-semibold">{formatAmount(inq.borrowerDetails.loanAmount)}</span></div>
                        <div><span className="text-slate-400">Interest:</span> <span className="text-slate-700">{inq.borrowerDetails.proposedInterest}%</span></div>
                        <div><span className="text-slate-400">Tenure:</span> <span className="text-slate-700">{inq.borrowerDetails.tenure} mo</span></div>
                        <div><span className="text-slate-400">Freq:</span> <span className="text-slate-700">{inq.borrowerDetails.frequency || 'Monthly'}</span></div>
                        {inq.turnover && (
                          <div className="col-span-2"><span className="text-slate-400">Turnover:</span> <span className="text-slate-700">{inq.turnover}</span></div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t border-slate-100 flex-wrap">
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

      {/* Proposal Modal — opened when dragging to PROPOSED */}
      {proposalInquiry && (
        <ProposalModal
          inquiry={proposalInquiry}
          onClose={() => setProposalInquiry(null)}
          onDataChanged={() => refetch()}
        />
      )}

      {/* Approve & Lend Modal — opened when dragging to APPROVED */}
      {approveInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Approve & Create Loan</h3>
            <p className="text-sm text-slate-500 mb-4">
              Approve <span className="font-medium">{approveInquiry.name}</span>&apos;s inquiry and create a borrower loan.
              Amount: <span className="font-semibold">₹ {(approveInquiry.borrowerDetails?.loanAmount || 0).toLocaleString('en-IN')}</span>
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={approveForm.interestRate}
                  onChange={(e) => setApproveForm({ ...approveForm, interestRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate Type</label>
                <select
                  value={approveForm.interestRateType}
                  onChange={(e) => setApproveForm({ ...approveForm, interestRateType: e.target.value as 'monthly' | 'yearly' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tenure (months)</label>
                <input
                  type="number"
                  value={approveForm.tenureMonths}
                  onChange={(e) => setApproveForm({ ...approveForm, tenureMonths: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Repayment Type</label>
                <select
                  value={approveForm.repaymentType}
                  onChange={(e) => setApproveForm({ ...approveForm, repaymentType: e.target.value as 'Interest-Only' | 'Bullet' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                >
                  <option value="Interest-Only">Interest-Only</option>
                  <option value="Bullet">Bullet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Repayment Frequency</label>
                <select
                  value={approveForm.repaymentFrequency}
                  onChange={(e) => setApproveForm({ ...approveForm, repaymentFrequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={approveForm.startDate}
                  onChange={(e) => setApproveForm({ ...approveForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={approveForm.notes}
                onChange={(e) => setApproveForm({ ...approveForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setApproveInquiry(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium"
              >Cancel</button>
              <button
                onClick={handleApproveLoan}
                disabled={approving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
              >{approving ? 'Approving...' : 'Approve & Create Loan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
