import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { useInquiryCache } from '../context/InquiryCacheContext';
import { DEFAULT_STAGE, InquiryType, Priority, Source } from '../types';
import { formatIndianShort } from '../utils/formatters';

export default function NewInquiry() {
  const navigate = useNavigate();
  const { refetch } = useInquiryCache();
  const [inquiryType, setInquiryType] = useState<InquiryType>('Borrower');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    source: 'Website' as Source,
    priority: 'Warm' as Priority,
    notes: '',
    loanAmount: '',
    tenure: '',
    turnover: '',
    proposedInterest: '',
    investmentAmount: '',
    expectedInterest: '',
    investorTenure: '',
    investorFrequency: 'Monthly' as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly',
    borrowerFrequency: 'Monthly' as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const now = new Date().toISOString().slice(0, 10);
    const body = {
      type: inquiryType,
      name: formData.name || '',
      mobile: formData.mobile || '',
      email: formData.email || '',
      city: formData.city || '',
      source: formData.source,
      priority: formData.priority,
      assignedTo: '',
      stage: DEFAULT_STAGE,
      lastActivity: 'Just now',
      createdAt: now,
      notes: formData.notes,
      turnover: formData.turnover || undefined,
      ...(inquiryType === 'Borrower'
        ? {
          borrowerDetails: {
            loanAmount: Number(formData.loanAmount) || 0,
            tenure: Number(formData.tenure) || 0,
            proposedInterest: Number(formData.proposedInterest) || 0,
            frequency: formData.borrowerFrequency,
          },
        }
        : {
          investorDetails: {
            investmentAmount: Number(formData.investmentAmount) || 0,
            expectedInterest: Number(formData.expectedInterest) || 0,
            tenure: Number(formData.investorTenure) || 0,
            frequency: formData.investorFrequency,
          },
        }),
    };
    try {
      await api.createInquiry(body);
      await refetch();
      navigate('/inquiries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <button
          onClick={() => navigate('/inquiries')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 -ml-1"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm sm:text-base">Back to Inquiries</span>
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">New Inquiry</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Add a new borrower or investor inquiry</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Inquiry Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Inquiry Type</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setInquiryType('Borrower')}
                className={`flex-1 px-6 py-3 rounded-lg border-2 transition-all ${inquiryType === 'Borrower'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
              >
                Borrower
              </button>
              <button
                type="button"
                onClick={() => setInquiryType('Investor')}
                className={`flex-1 px-6 py-3 rounded-lg border-2 transition-all ${inquiryType === 'Investor'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
              >
                Investor
              </button>
            </div>
          </div>

          {/* Basic Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+91 xxxxx xxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as Source })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Agent">Agent</option>
                  <option value="Existing Client">Existing Client</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>

            </div>
          </div>

          {/* Borrower/Investor Specific Fields */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {inquiryType === 'Borrower' ? 'Loan Details' : 'Investment Details'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inquiryType === 'Borrower' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Loan Amount Required (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.loanAmount}
                      onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="500000"
                    />
                    {formData.loanAmount && (
                      <p className="mt-1 text-xs text-blue-600 font-medium ml-1">
                        {formatIndianShort(formData.loanAmount)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tenure (months)
                    </label>
                    <input
                      type="number"
                      value={formData.tenure}
                      onChange={(e) => setFormData({ ...formData, tenure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Turnover (₹)</label>
                    <input
                      type="text"
                      value={formData.turnover}
                      onChange={(e) => setFormData({ ...formData, turnover: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 5000000"
                    />
                    {formData.turnover && (
                      <p className="mt-1 text-xs text-slate-500 font-medium ml-1">
                        {formatIndianShort(formData.turnover)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proposed Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.proposedInterest}
                      onChange={(e) => setFormData({ ...formData, proposedInterest: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Repayment Frequency</label>
                    <select
                      value={formData.borrowerFrequency}
                      onChange={(e) => setFormData({ ...formData, borrowerFrequency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Investment Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.investmentAmount}
                      onChange={(e) => setFormData({ ...formData, investmentAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1000000"
                    />
                    {formData.investmentAmount && (
                      <p className="mt-1 text-xs text-purple-600 font-medium ml-1">
                        {formatIndianShort(formData.investmentAmount)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.expectedInterest}
                      onChange={(e) => setFormData({ ...formData, expectedInterest: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tenure (months)
                    </label>
                    <input
                      type="number"
                      value={formData.investorTenure}
                      onChange={(e) => setFormData({ ...formData, investorTenure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency
                    </label>
                    <select
                      value={formData.investorFrequency}
                      onChange={(e) => setFormData({ ...formData, investorFrequency: e.target.value as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any additional notes or comments..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Inquiry'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/inquiries')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
