import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Inquiry, Proposal } from '../types';

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ProposalModalProps {
  inquiry: Inquiry;
  onClose: () => void;
  onAccepted?: () => void;
  /** Called when any proposal action updates the inquiry (send / accept / counter). Parent should refetch. */
  onDataChanged?: () => void;
}

export default function ProposalModal({ inquiry, onClose, onAccepted, onDataChanged }: ProposalModalProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    proposedLoanAmount: String(inquiry.borrowerDetails?.loanAmount || ''),
    proposedInterestRate: String(inquiry.borrowerDetails?.proposedInterest || ''),
    proposedTenure: String(inquiry.borrowerDetails?.tenure || ''),
    proposedFrequency: inquiry.borrowerDetails?.frequency || 'Monthly',
    notes: '',
  });
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    try {
      const data = await api.getProposals(inquiry.id);
      setProposals(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const handleSendProposal = async () => {
    setSubmitting(true);
    try {
      await api.createProposal({
        inquiryId: inquiry.id,
        borrowerName: inquiry.name,
        originalLoanAmount: inquiry.borrowerDetails?.loanAmount || 0,
        proposedLoanAmount: Number(form.proposedLoanAmount) || 0,
        proposedInterestRate: Number(form.proposedInterestRate) || 0,
        proposedTenure: Number(form.proposedTenure) || 0,
        originalFrequency: inquiry.borrowerDetails?.frequency,
        proposedFrequency: form.proposedFrequency as any,
        notes: form.notes,
      });
      await loadProposals();
      setActiveTab('history');
      // Refresh parent so proposed terms appear in the inquiry table
      onDataChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    setSubmitting(true);
    try {
      await api.updateProposalStatus(proposalId, { status: 'Accepted' });
      await loadProposals();
      // Refresh parent so stage updates to APPROVED and terms are locked
      onDataChanged?.();
      onAccepted?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setSubmitting(true);
    try {
      await api.updateProposalStatus(proposalId, { status: 'Rejected' });
      await loadProposals();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor: Record<string, string> = {
    Sent: 'bg-blue-100 text-blue-700',
    Accepted: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Counter: 'bg-amber-100 text-amber-700',
    Expired: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Proposal / Negotiation</h3>
            <p className="text-sm text-slate-500">{inquiry.name} ({inquiry.id})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
        </div>

        {/* Original terms summary */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
          <p className="font-medium text-slate-700 mb-1">Original Request</p>
          <div className="flex gap-6 text-slate-600 flex-wrap">
            <span>Amount: <strong>₹ {(inquiry.borrowerDetails?.loanAmount || 0).toLocaleString('en-IN')}</strong></span>
            <span>Rate: <strong>{inquiry.borrowerDetails?.proposedInterest || 0}%</strong></span>
            <span>Tenure: <strong>{inquiry.borrowerDetails?.tenure || 0} mo</strong></span>
            {inquiry.borrowerDetails?.frequency && <span>Freq: <strong>{inquiry.borrowerDetails.frequency}</strong></span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
          >New Proposal</button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
          >History ({proposals.length})</button>
        </div>

        {activeTab === 'new' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proposed Amount (₹)</label>
                <input type="number" value={form.proposedLoanAmount}
                  onChange={(e) => setForm({ ...form, proposedLoanAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                <input type="number" step="0.1" value={form.proposedInterestRate}
                  onChange={(e) => setForm({ ...form, proposedInterestRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tenure (months)</label>
                <input type="number" value={form.proposedTenure}
                  onChange={(e) => setForm({ ...form, proposedTenure: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                <select
                  value={form.proposedFrequency}
                  onChange={(e) => setForm({ ...form, proposedFrequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium">Cancel</button>
              <button onClick={handleSendProposal} disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                {submitting ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <p className="text-slate-500 text-sm">Loading proposals...</p>
            ) : proposals.length === 0 ? (
              <p className="text-slate-500 text-sm">No proposals sent yet.</p>
            ) : (
              proposals.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900">{p.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status] || 'bg-slate-100 text-slate-700'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                    <div><span className="text-slate-500">Amount:</span> ₹ {p.proposedLoanAmount.toLocaleString('en-IN')}</div>
                    <div><span className="text-slate-500">Rate:</span> {p.proposedInterestRate}%</div>
                    <div><span className="text-slate-500">Tenure:</span> {p.proposedTenure} mo</div>
                    {p.proposedFrequency && <div><span className="text-slate-500">Freq:</span> {p.proposedFrequency}</div>}
                  </div>
                  <p className="text-xs text-slate-500">Sent: {formatDate(p.sentAt)}</p>
                  {p.notes && <p className="text-xs text-slate-600 mt-1 italic">{p.notes}</p>}

                  {/* Proposal history */}
                  {p.history.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-1">Negotiation History</p>
                      {p.history.map((h, i) => (
                        <div key={i} className="text-xs text-slate-600 flex items-center gap-2 py-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor[h.action] || 'bg-slate-100 text-slate-600'}`}>{h.action}</span>
                          <span>₹ {h.proposedLoanAmount?.toLocaleString('en-IN')} @ {h.proposedInterestRate}% / {h.proposedTenure} mo</span>
                          <span className="text-slate-400">{formatDate(h.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {p.status === 'Sent' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleAcceptProposal(p.id)} disabled={submitting}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                        Accept Proposal
                      </button>
                      <button onClick={() => handleRejectProposal(p.id)} disabled={submitting}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
