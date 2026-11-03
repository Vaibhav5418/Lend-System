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

export interface RequestOptions extends RequestInit {
  ttl?: number;
  skipCache?: boolean;
}

interface ClientCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const clientCache = new Map<string, ClientCacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export function clearClientCache(pattern?: string | RegExp): void {
  if (!pattern) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
      clientCache.delete(key);
    }
  }
}

async function doFetch<T>(path: string, options?: RequestOptions): Promise<T> {
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

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  if (!isGet) {
    clearClientCache();
    return doFetch<T>(path, options);
  }

  if (options?.skipCache) {
    return doFetch<T>(path, options);
  }

  const cacheKey = path;

  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as T;
  }

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const ttl = options?.ttl ?? 15_000;
  const promise = doFetch<T>(path, options)
    .then((data) => {
      if (data !== undefined) {
        clientCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttl,
        });
      }
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export const api = {
  clearCache: clearClientCache,
  getInquiries: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    stage?: string;
    priority?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> => {
    if (!params) return request<import('../types').Inquiry[]>('/inquiries');
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.type && params.type !== 'All') searchParams.set('type', params.type);
    if (params.stage && params.stage !== 'All') searchParams.set('stage', params.stage);
    if (params.priority && params.priority !== 'All') searchParams.set('priority', params.priority);
    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    return request<import('../types').PaginatedResult<import('../types').Inquiry>>(`/inquiries?${searchParams.toString()}`);
  },
  getDashboardStats: () =>
    request<import('../types').DashboardStatsData>('/inquiries/dashboard-stats'),
  getStageSummary: (type: 'Borrower' | 'Investor') =>
    request<import('../types').StageSummaryItem[]>(`/inquiries/stage-summary?type=${type}`),
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
  getInvestorInvestments: (params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<any> => {
    if (!params) return request<import('../types').InvestorInvestment[]>('/investor/investments');
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    return request<import('../types').PaginatedInvestmentsResult>(`/investor/investments?${searchParams.toString()}`);
  },


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
  getInvestorPayments: (params?: { page?: number; limit?: number; status?: string; search?: string; investmentId?: string } | string): Promise<any> => {
    if (typeof params === 'string') {
      return request<import('../types').InvestorPayment[]>(`/investor/payments?investmentId=${encodeURIComponent(params)}`);
    }
    if (!params) return request<import('../types').InvestorPayment[]>('/investor/payments');
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.investmentId) searchParams.set('investmentId', params.investmentId);
    return request<import('../types').PaginatedPaymentsResult>(`/investor/payments?${searchParams.toString()}`);
  },


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
  getBorrowerLoans: (params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<any> => {
    if (!params) return request<import('../types').BorrowerLoan[]>('/borrower/loans');
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    return request<import('../types').PaginatedLoansResult>(`/borrower/loans?${searchParams.toString()}`);
  },


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
  getBorrowerCollections: (params?: { page?: number; limit?: number; status?: string; search?: string; loanId?: string } | string): Promise<any> => {
    if (typeof params === 'string') {
      return request<import('../types').BorrowerCollection[]>(`/borrower/collections?loanId=${encodeURIComponent(params)}`);
    }
    if (!params) return request<import('../types').BorrowerCollection[]>('/borrower/collections');
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.loanId) searchParams.set('loanId', params.loanId);
    return request<import('../types').PaginatedCollectionsResult>(`/borrower/collections?${searchParams.toString()}`);
  },


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
