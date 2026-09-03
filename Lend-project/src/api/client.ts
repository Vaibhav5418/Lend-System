const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'lendflow_token';

/** Ping backend health to keep Render (and similar) from cold-starting. No auth. */
export async function pingHealth(): Promise<void> {
  try {
    await fetch(`${API_BASE}/health`, { method: 'GET' });
  } catch {
    // Ignore; keep-alive is best-effort
  }
}

export type InquiryDocument = {
  _id: string;
  inquiryId: string;
  fileName: string;
  mimeType?: string;
  cloudinaryUrl: string;
  publicId: string;
  resourceType?: string;
  summary: string;
  uploadedAt: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isForm = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(isForm ? (options?.headers as Record<string, string> ?? {}) : { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) }),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getInquiries: () => request<import('../types').Inquiry[]>('/inquiries'),
  getInquiry: (id: string) => request<import('../types').Inquiry>(`/inquiries/${id}`),
  createInquiry: (body: Omit<import('../types').Inquiry, 'id'>) =>
    request<import('../types').Inquiry>('/inquiries', { method: 'POST', body: JSON.stringify(body) }),
  updateInquiry: (id: string, body: Partial<import('../types').Inquiry>) =>
    request<import('../types').Inquiry>(`/inquiries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInquiry: (id: string) => request<void>(`/inquiries/${id}`, { method: 'DELETE' }),
  /** PATCH /api/inquiries/:id/stage – validates stage against inquiry type, updates stage & lastActivityAt, appends to activityLogs */
  updateInquiryStage: (id: string, stage: string) =>
    request<import('../types').Inquiry>(`/inquiries/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  getStaff: () => request<string[]>('/staff'),
  getAgents: () =>
    request<{ id: string; name: string; totalInquiries: number; conversions: number }[]>('/agents'),

  getInquiryDocuments: (inquiryId: string) =>
    request<InquiryDocument[]>(`/inquiries/${inquiryId}/documents`),
  uploadInquiryDocument: (inquiryId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<InquiryDocument>(`/inquiries/${inquiryId}/documents`, {
      method: 'POST',
      body: form,
    });
  },
  deleteInquiryDocument: (inquiryId: string, docId: string) =>
    request<void>(`/inquiries/${inquiryId}/documents/${docId}`, { method: 'DELETE' }),
  /** Fetch document for inline view (with auth). Returns blob so it can be shown in iframe via object URL. */
  getDocumentViewBlob: (inquiryId: string, docId: string): Promise<Blob> => {
    return fetch(`${API_BASE}/inquiries/${inquiryId}/documents/${docId}/view`, {
      headers: getAuthHeaders(),
    }).then((res) => {
      if (!res.ok) throw new Error(res.status === 401 ? 'Authentication required' : 'Failed to load document');
      return res.blob();
    });
  },
  regenerateDocumentSummary: (inquiryId: string, docId: string) =>
    request<InquiryDocument>(`/inquiries/${inquiryId}/documents/${docId}/summary`, {
      method: 'POST',
    }),
  /** Generate one combined AI report and profile score from all documents. */
  getCombinedReport: (inquiryId: string) =>
    request<{ markdown: string; profileScore?: number; profileScoreRating?: string }>(
      `/inquiries/${inquiryId}/documents/combined-report`,
      { method: 'POST' }
    ),

  // ═══════════════════════════════════════════════════════════════
  // INVESTOR INVESTMENTS
  // ═══════════════════════════════════════════════════════════════
  getInvestorInvestments: () =>
    request<import('../types').InvestorInvestment[]>('/investor/investments'),
  getInvestorInvestment: (id: string) =>
    request<import('../types').InvestorInvestment>(`/investor/investments/${id}`),
  createInvestorInvestment: (body: Partial<import('../types').InvestorInvestment>) =>
    request<import('../types').InvestorInvestment>('/investor/investments', { method: 'POST', body: JSON.stringify(body) }),
  updateInvestorInvestment: (id: string, body: Partial<import('../types').InvestorInvestment>) =>
    request<import('../types').InvestorInvestment>(`/investor/investments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInvestorInvestment: (id: string) =>
    request<void>(`/investor/investments/${id}`, { method: 'DELETE' }),

  // ═══════════════════════════════════════════════════════════════
  // INVESTOR PAYMENTS
  // ═══════════════════════════════════════════════════════════════
  getInvestorPayments: (investmentId?: string) =>
    request<import('../types').InvestorPayment[]>(`/investor/payments${investmentId ? `?investmentId=${investmentId}` : ''}`),
  createInvestorPayment: (body: Partial<import('../types').InvestorPayment>) =>
    request<import('../types').InvestorPayment>('/investor/payments', { method: 'POST', body: JSON.stringify(body) }),
  updateInvestorPayment: (id: string, body: Partial<import('../types').InvestorPayment>) =>
    request<import('../types').InvestorPayment>(`/investor/payments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInvestorPayment: (id: string) =>
    request<void>(`/investor/payments/${id}`, { method: 'DELETE' }),

  getUpcomingPayouts: () =>
    request<import('../types').UpcomingPayout[]>('/investor/upcoming-payouts'),

  // ═══════════════════════════════════════════════════════════════
  // BORROWER LOANS
  // ═══════════════════════════════════════════════════════════════
  getBorrowerLoans: () =>
    request<import('../types').BorrowerLoan[]>('/borrower/loans'),
  getBorrowerLoan: (id: string) =>
    request<import('../types').BorrowerLoan>(`/borrower/loans/${id}`),
  createBorrowerLoan: (body: Partial<import('../types').BorrowerLoan>) =>
    request<import('../types').BorrowerLoan>('/borrower/loans', { method: 'POST', body: JSON.stringify(body) }),
  updateBorrowerLoan: (id: string, body: Partial<import('../types').BorrowerLoan>) =>
    request<import('../types').BorrowerLoan>(`/borrower/loans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBorrowerLoan: (id: string) =>
    request<void>(`/borrower/loans/${id}`, { method: 'DELETE' }),

  // ═══════════════════════════════════════════════════════════════
  // BORROWER COLLECTIONS
  // ═══════════════════════════════════════════════════════════════
  getBorrowerCollections: (loanId?: string) =>
    request<import('../types').BorrowerCollection[]>(`/borrower/collections${loanId ? `?loanId=${loanId}` : ''}`),
  createBorrowerCollection: (body: Partial<import('../types').BorrowerCollection>) =>
    request<import('../types').BorrowerCollection>('/borrower/collections', { method: 'POST', body: JSON.stringify(body) }),
  updateBorrowerCollection: (id: string, body: Partial<import('../types').BorrowerCollection>) =>
    request<import('../types').BorrowerCollection>(`/borrower/collections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBorrowerCollection: (id: string) =>
    request<void>(`/borrower/collections/${id}`, { method: 'DELETE' }),

  getUpcomingDues: () =>
    request<import('../types').UpcomingDue[]>('/borrower/upcoming-dues'),

  // ═══════════════════════════════════════════════════════════════
  // PROPOSALS
  // ═══════════════════════════════════════════════════════════════
  getProposals: (inquiryId?: string) =>
    request<import('../types').Proposal[]>(`/proposals${inquiryId ? `?inquiryId=${inquiryId}` : ''}`),
  getProposal: (id: string) =>
    request<import('../types').Proposal>(`/proposals/${id}`),
  createProposal: (body: Partial<import('../types').Proposal>) =>
    request<import('../types').Proposal>('/proposals', { method: 'POST', body: JSON.stringify(body) }),
  updateProposalStatus: (id: string, body: { status: string; proposedLoanAmount?: number; proposedInterestRate?: number; proposedTenure?: number; notes?: string }) =>
    request<import('../types').Proposal>(`/proposals/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProposal: (id: string) =>
    request<void>(`/proposals/${id}`, { method: 'DELETE' }),

  // ═══════════════════════════════════════════════════════════════
  // PROFIT ENGINE
  // ═══════════════════════════════════════════════════════════════
  getProfitDashboard: () =>
    request<import('../types').ProfitDashboardData>('/profit/dashboard'),
};
