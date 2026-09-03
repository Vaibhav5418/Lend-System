export type InquiryType = 'Borrower' | 'Investor';
export type Priority = 'Hot' | 'Warm' | 'Cold';
export type Source = 'Website' | 'Referral' | 'Walk-in' | 'Social Media' | 'Agent' | 'Existing Client';

/** Backend uses uppercase stage codes. Use these for API and filtering. */
export const BORROWER_STAGES = [
  'NEW',
  'CONTACTED',
  'DOCS_PENDING',
  'VERIFIED',
  'APPROVED',
  'DISBURSED',
] as const;
export type BorrowerStage = (typeof BORROWER_STAGES)[number];

export const INVESTOR_STAGES = [
  'NEW',
  'CONTACTED',
  'RATE_DISCUSSED',
  'AGREEMENT_DONE',
  'FUND_RECEIVED',
] as const;
export type InvestorStage = (typeof INVESTOR_STAGES)[number];

export const DEFAULT_STAGE = 'NEW' as const;

/** Human-readable labels for pipeline stages */
export const STAGE_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  DOCS_PENDING: 'Docs Pending',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  DISBURSED: 'Disbursed',
  RATE_DISCUSSED: 'Rate Discussed',
  AGREEMENT_DONE: 'Agreement Done',
  FUND_RECEIVED: 'Fund Received',
};

export interface ActivityLog {
  action: string;
  oldStage?: string;
  newStage?: string;
  changedAt: string;
}

export interface Inquiry {
  id: string;
  type: InquiryType;
  name: string;
  mobile: string;
  email: string;
  city: string;
  source: Source;
  priority: Priority;
  assignedTo: string;
  referenceAgent?: string;
  stage: string;
  nextFollowUp?: string;
  turnover?: string;
  lastActivity: string;
  lastActivityAt?: string;
  createdAt: string;
  notes: string;
  activityLogs?: ActivityLog[];
  combinedReportMarkdown?: string;
  combinedReportGeneratedAt?: string;
  profileScore?: number;
  profileScoreRating?: string;
  borrowerDetails?: {
    loanAmount: number;
    tenure: number;
    proposedInterest: number;
    frequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  };
  investorDetails?: {
    investmentAmount: number;
    expectedInterest: number;
    tenure: number;
    frequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  };
}

// ═══════════════════════════════════════════════════════════════════
// Lending Lifecycle Types
// ═══════════════════════════════════════════════════════════════════

export type InvestmentStatus = 'Active' | 'Matured' | 'Closed' | 'Withdrawn';
export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partial';
export type PaymentMode = 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'NEFT' | 'RTGS' | 'Other';
export type LoanStatus = 'Active' | 'Closed' | 'Defaulted' | 'Restructured';
export type CollectionStatus = 'Received' | 'Pending' | 'Overdue' | 'Partial' | 'Defaulted';
export type ProposalStatus = 'Sent' | 'Accepted' | 'Rejected' | 'Counter' | 'Expired';
export type RepaymentType = 'Interest-Only' | 'Bullet';
export type PayoutFrequency = 'monthly' | 'quarterly' | 'on_maturity';
export type RateType = 'monthly' | 'yearly';

export interface LinkedBorrower {
  loanId: string;
  allocatedAmount: number;
}

export interface InvestorInvestment {
  id: string;
  inquiryId: string;
  investorName: string;
  mobile: string;
  email: string;
  investedAmount: number;
  interestRate: number;
  interestRateType: RateType;
  tenureMonths: number;
  investmentPlan: string;
  payoutFrequency: PayoutFrequency;
  monthlyInterest: number;
  totalInterest: number;
  totalPayout: number;
  startDate: string;
  maturityDate: string;
  linkedBorrowers: LinkedBorrower[];
  status: InvestmentStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorPayment {
  id: string;
  investmentId: string;
  investorName: string;
  paymentDate: string;
  dueDate?: string;
  amountPaid: number;
  interestPaid: number;
  principalPaid: number;
  pendingInterest: number;
  paymentFrequency: PayoutFrequency;
  paymentMode: PaymentMode;
  status: PaymentStatus;
  remarks: string;
  createdAt: string;
}

export interface RepaymentScheduleEntry {
  month: number;
  dueDate: string;
  interestDue: number;
  principalDue: number;
  totalDue: number;
  status: string;
}

export interface InvestorMapping {
  investmentId: string;
  allocatedAmount: number;
}

export interface BorrowerLoan {
  id: string;
  inquiryId: string;
  borrowerName: string;
  companyName: string;
  mobile: string;
  email: string;
  approvedAmount: number;
  interestRate: number;
  interestRateType: RateType;
  tenureMonths: number;
  repaymentType: RepaymentType;
  repaymentFrequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  monthlyInterest: number;
  totalInterest: number;
  totalRepayable: number;
  startDate: string;
  endDate: string;
  repaymentSchedule: RepaymentScheduleEntry[];
  investorMapping: InvestorMapping[];
  loanPurpose: string;
  status: LoanStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BorrowerCollection {
  id: string;
  loanId: string;
  borrowerName: string;
  paymentDate: string;
  dueDate?: string;
  scheduleMonth?: number;
  interestPaid: number;
  principalPaid: number;
  totalPaid: number;
  pendingAmount: number;
  overdueDays: number;
  penalty: number;
  paymentMode: PaymentMode;
  status: CollectionStatus;
  remarks: string;
  createdAt: string;
}

export interface ProposalHistory {
  proposedLoanAmount: number;
  proposedInterestRate: number;
  proposedTenure: number;
  proposedFrequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  notes: string;
  action: string;
  timestamp: string;
}

export interface Proposal {
  id: string;
  inquiryId: string;
  borrowerName: string;
  originalLoanAmount: number;
  originalInterestRate: number;
  originalTenure: number;
  proposedLoanAmount: number;
  proposedInterestRate: number;
  proposedTenure: number;
  originalFrequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  proposedFrequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  notes: string;
  status: ProposalStatus;
  sentAt: string;
  respondedAt?: string;
  history: ProposalHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfitDashboardData {
  totalInvestedFunds: number;
  activeInvestedFunds: number;
  totalDeployedFunds: number;
  activeDeployedFunds: number;
  totalInterestPayable: number;
  interestPaidToInvestors: number;
  totalInterestReceivable: number;
  interestCollectedFromBorrowers: number;
  netSpreadProfit: number;
  realizedProfit: number;
  avgInvestorRate: number;
  avgBorrowerRate: number;
  avgSpread: number;
  activeInvestors: number;
  activeLoans: number;
  defaultedLoans: number;
  monthlyProfit: { month: string; interestCollected: number; interestPaid: number; netProfit: number }[];
}

export interface UpcomingPayout {
  investmentId: string;
  investorName: string;
  nextPayoutDate: string;
  payoutAmount: number;
  frequency: string;
  isMaturity: boolean;
}

export interface UpcomingDue {
  loanId: string;
  borrowerName: string;
  month: number;
  dueDate: string;
  totalDue: number;
  interestDue: number;
  principalDue: number;
  isOverdue: boolean;
}
