import { useNavigate } from 'react-router-dom';
import { Phone, Mail, Calendar, TrendingUp } from 'lucide-react';
import { useInquiryCache } from '../context/InquiryCacheContext';
import { BORROWER_STAGES, STAGE_LABELS, type BorrowerStage } from '../types';

const stages = [...BORROWER_STAGES];

export default function BorrowerPipeline() {
  const navigate = useNavigate();
  const { inquiries, loading, error } = useInquiryCache();

  const borrowerInquiries = inquiries.filter((inq) => inq.type === 'Borrower');

  const getInquiriesByStage = (stage: BorrowerStage) => {
    return borrowerInquiries.filter((inq) => inq.stage === stage);
  };

  const getTotalAmount = (stage: BorrowerStage) => {
    return getInquiriesByStage(stage).reduce(
      (sum, inq) => sum + (inq.borrowerDetails?.loanAmount || 0),
      0
    );
  };

  if (loading) return <div className="p-6 text-gray-500">Loading pipeline...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Borrower Pipeline</h1>
        <p className="text-gray-600 mt-1">Track borrower inquiries through the lending process</p>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Borrowers</p>
          <p className="text-2xl font-bold text-gray-900">{borrowerInquiries.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-600">
            {borrowerInquiries.filter((inq) => inq.stage !== 'APPROVED' && inq.stage !== 'DISBURSED').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {borrowerInquiries.filter((inq) => inq.stage === 'APPROVED').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Disbursed</p>
          <p className="text-2xl font-bold text-purple-600">
            {borrowerInquiries.filter((inq) => inq.stage === 'DISBURSED').length}
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => {
            const stageInquiries = getInquiriesByStage(stage);
            const totalAmount = getTotalAmount(stage);

            return (
              <div
                key={stage}
                className="flex-shrink-0 w-80 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Stage Header */}
                <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{STAGE_LABELS[stage] ?? stage}</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                      {stageInquiries.length}
                    </span>
                  </div>
                  {totalAmount > 0 && (
                    <p className="text-xs text-gray-600">
                      ₹{totalAmount.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {stageInquiries.map((inquiry) => (
                    <div
                      key={inquiry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/inquiries/${inquiry.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/inquiries/${inquiry.id}`)}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm">{inquiry.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            inquiry.priority === 'Hot'
                              ? 'bg-red-100 text-red-700'
                              : inquiry.priority === 'Warm'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {inquiry.priority}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 mb-3">{inquiry.city}</p>

                      {inquiry.borrowerDetails && (
                        <div className="mb-3 p-2 bg-blue-50 rounded">
                          <div className="flex items-center gap-1 text-blue-700">
                            <TrendingUp className="w-3 h-3" />
                            <span className="text-xs font-semibold">
                              ₹{inquiry.borrowerDetails.loanAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            {inquiry.borrowerDetails.tenure}m @ {inquiry.borrowerDetails.proposedInterest}%
                          </p>
                        </div>
                      )}

                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="w-3 h-3" />
                          <span>{inquiry.mobile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{inquiry.email}</span>
                        </div>
                      </div>

                      {inquiry.nextFollowUp && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                          <Calendar className="w-3 h-3" />
                          <span>{inquiry.nextFollowUp}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">{inquiry.assignedTo}</span>
                        <span className="text-xs text-gray-400">{inquiry.lastActivity}</span>
                      </div>
                    </div>
                  ))}

                  {stageInquiries.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No inquiries in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
