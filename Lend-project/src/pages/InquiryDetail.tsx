import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Phone, Mail, MapPin, User, Flag, TrendingUp, Clock, Edit2, Trash2, FileText, Upload, ExternalLink, Sparkles } from 'lucide-react';
import { api, type InquiryDocument } from '../api/client';
import { useInquiryCache } from '../context/InquiryCacheContext';
import type { Inquiry } from '../types';
import { STAGE_LABELS, type Priority } from '../types';
import { formatCurrencyShort } from '../utils/formatters';

export default function InquiryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refetch } = useInquiryCache();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [documents, setDocuments] = useState<InquiryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{ docId: string; name: string } | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfLoading, setViewingPdfLoading] = useState(false);
  const [viewingPdfError, setViewingPdfError] = useState<string | null>(null);
  const [combinedReport, setCombinedReport] = useState<string | null>(null);
  const [profileScore, setProfileScore] = useState<number | null>(null);
  const [profileScoreRating, setProfileScoreRating] = useState<string | null>(null);
  const [combinedReportLoading, setCombinedReportLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'summary'>('overview');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const isPdf = (doc: InquiryDocument) => doc.mimeType === 'application/pdf' || (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf'));

  useEffect(() => {
    if (!id) return;
    api
      .getInquiry(id)
      .then((data) => {
        setInquiry(data);
        if (data.combinedReportMarkdown) setCombinedReport(data.combinedReportMarkdown);
        if (data.profileScore != null) setProfileScore(data.profileScore);
        if (data.profileScoreRating) setProfileScoreRating(data.profileScoreRating);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.getInquiryDocuments(id).then(setDocuments).catch(() => setDocuments([]));
  }, [id]);

  useEffect(() => {
    if (!viewingPdf || !id) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setViewingPdfUrl(null);
      setViewingPdfLoading(false);
      setViewingPdfError(null);
      return;
    }
    setViewingPdfLoading(true);
    setViewingPdfError(null);
    api
      .getDocumentViewBlob(id, viewingPdf.docId)
      .then((blob) => {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setViewingPdfUrl(url);
        setViewingPdfError(null);
      })
      .catch((e) => setViewingPdfError(e instanceof Error ? e.message : 'Failed to load document'))
      .finally(() => setViewingPdfLoading(false));
  }, [id, viewingPdf?.docId]);

  const MAX_FILE_SIZE_MB = 100; // Files ≤10 MB → Cloudinary; >10 MB → Supabase
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !id) return;
    setUploadError(null);
    const fileList = Array.from(files);
    const tooLarge = fileList.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (tooLarge.length > 0) {
      setUploadError(`Max ${MAX_FILE_SIZE_MB} MB per file. ${tooLarge.length} file(s) skipped (too large).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      await Promise.all(fileList.map((file) => api.uploadInquiryDocument(id, file)));
      const list = await api.getInquiryDocuments(id);
      setDocuments(list);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id) return;
    if (!window.confirm('Confirm? Delete this document? This cannot be undone.')) return;
    try {
      await api.deleteInquiryDocument(id, docId);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleGenerateSummary = async (docId: string) => {
    if (!id) return;
    setUploadError(null);
    setGeneratingDocId(docId);
    try {
      const updated = await api.regenerateDocumentSummary(id, docId);
      setDocuments((prev) => prev.map((d) => (d._id === docId ? updated : d)));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGeneratingDocId(null);
    }
  };

  const handleGenerateCombinedReport = async () => {
    if (!id || documents.length === 0) return;
    setUploadError(null);
    setCombinedReportLoading(true);
    try {
      const { markdown, profileScore: resScore, profileScoreRating: resRating } = await api.getCombinedReport(id);
      setCombinedReport(markdown);
      if (resScore != null) setProfileScore(resScore);
      if (resRating) setProfileScoreRating(resRating);
      setActiveSection('summary');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to generate combined report');
    } finally {
      setCombinedReportLoading(false);
    }
  };

  const handleChangePriority = async (priority: Priority) => {
    if (!id || !inquiry) return;
    setUpdatingPriority(true);
    try {
      const updated = await api.updateInquiry(id, { priority });
      setInquiry(updated);
      await refetch();
      setShowPriorityPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleDeleteInquiry = async () => {
    if (!id) return;
    if (!window.confirm('Delete this inquiry? Click OK to delete. This cannot be undone.')) return;
    try {
      await api.deleteInquiry(id);
      await refetch();
      navigate('/inquiries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inquiry');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50/80 flex items-center justify-center"><p className="text-slate-600 font-medium">Loading…</p></div>;
  if (error) return <div className="min-h-screen bg-slate-50/80 flex items-center justify-center"><p className="text-rose-600 font-semibold">Error: {error}</p></div>;
  if (!inquiry) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600 font-medium">Inquiry not found</p>
        <button
          onClick={() => navigate('/inquiries')}
          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
        >
          Back to Inquiries
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 to-slate-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:gap-4 pb-4 sm:pb-6 border-b-2 border-sky-200/60">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sky-700 hover:text-sky-900 text-sm font-medium transition-colors w-fit -ml-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 flex-1 sm:pl-0">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 truncate">{inquiry.name}</h1>
              <p className="text-xs sm:text-sm text-sky-600/90 mt-0.5 font-mono font-medium">{inquiry.id}</p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/inquiries/${id}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-sky-300 bg-sky-50 text-sky-800 text-sm font-medium hover:bg-sky-100 hover:border-sky-400 transition-colors shadow-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteInquiry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium hover:bg-rose-100 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Main content: 2/3 Inquiry Overview + 1/3 Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Overview / Summary slider (2/3) */}
          <div className="lg:col-span-2 min-w-0">
            <div className="bg-white rounded-xl border border-violet-200/80 shadow-md overflow-hidden ring-1 ring-violet-100/50 h-full">
              {/* Tab bar: Overview | Summary (Summary hidden for Investor type) */}
              <div className="flex border-b border-violet-100 bg-gradient-to-r from-violet-50/80 to-white overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px shrink-0 ${activeSection === 'overview'
                    ? 'border-violet-600 text-violet-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-violet-50/50'
                    }`}
                >
                  Overview
                </button>
                {inquiry.type !== 'Investor' && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('summary')}
                    className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 ${activeSection === 'summary'
                      ? 'border-violet-600 text-violet-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-violet-50/50'
                      }`}
                  >
                    Summary
                    {combinedReport && <span className="w-2 h-2 rounded-full bg-violet-500" title="Has summary" />}
                  </button>
                )}
              </div>

              {activeSection === 'overview' && (
                <div className="p-4 sm:p-6 lg:p-8">
                  {/* All sections horizontally, line by line */}
                  <div className="space-y-4 sm:space-y-6">
                    {/* 1. Contact Information */}
                    <div className="bg-white rounded-xl border border-sky-200/80 shadow-sm overflow-hidden border-l-4 border-l-sky-500">
                      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sky-100 bg-sky-50/50">
                        <h2 className="text-xs sm:text-sm font-semibold text-sky-800 uppercase tracking-wider">Contact Information</h2>
                      </div>
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-wrap gap-x-6 sm:gap-x-12 gap-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                              <Phone className="w-5 h-5 text-sky-600" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mobile</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.mobile}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <Mail className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</p>
                              <p className="text-sm font-medium text-slate-900 break-all">{inquiry.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">City</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.city}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Inquiry Details */}
                    <div className="bg-white rounded-xl border border-violet-200/80 shadow-sm overflow-hidden border-l-4 border-l-violet-500">
                      <div className="px-6 py-4 border-b border-violet-100 bg-violet-50/50">
                        <h2 className="text-sm font-semibold text-violet-800 uppercase tracking-wider">Inquiry Details</h2>
                      </div>
                      <div className="p-6">
                        <div className="flex flex-wrap gap-x-10 gap-y-4">
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Type</p>
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${inquiry.type === 'Borrower' ? 'bg-sky-50 text-sky-800 border border-sky-200/80' : 'bg-violet-50 text-violet-800 border border-violet-200/80'
                              }`}>
                              {inquiry.type}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Priority</p>
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${inquiry.priority === 'Hot' ? 'bg-rose-50 text-rose-800 border border-rose-200/80' :
                              inquiry.priority === 'Warm' ? 'bg-amber-50 text-amber-800 border border-amber-200/80' :
                                'bg-slate-100 text-slate-700 border border-slate-200/80'
                              }`}>
                              {inquiry.priority}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Source</p>
                            <p className="text-sm font-medium text-slate-900">{inquiry.source}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Stage</p>
                            <p className="text-sm font-medium text-slate-900">{STAGE_LABELS[inquiry.stage] ?? inquiry.stage}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Created At</p>
                            <p className="text-sm font-medium text-slate-900">{inquiry.createdAt}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Last Activity</p>
                            <p className="text-sm font-medium text-slate-900">{inquiry.lastActivity}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Loan Details or Investment Details */}
                    {inquiry.type === 'Borrower' && inquiry.borrowerDetails && (
                      <div className="bg-white rounded-xl border border-emerald-200/80 shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
                        <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50/50">
                          <h2 className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">Loan Details</h2>
                        </div>
                        <div className="p-6">
                          <div className="flex flex-wrap gap-x-12 gap-y-4">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Loan Amount</p>
                              <p className="text-xl font-semibold text-slate-900">{formatCurrencyShort(inquiry.borrowerDetails.loanAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tenure</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.borrowerDetails.tenure} months</p>
                            </div>
                            {inquiry.turnover && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Turnover</p>
                                <p className="text-sm font-medium text-slate-900">{inquiry.turnover}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Proposed Interest</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.borrowerDetails.proposedInterest}% p.a.</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Repayment Frequency</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.borrowerDetails.frequency || 'Monthly'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {inquiry.type === 'Investor' && inquiry.investorDetails && (
                      <div className="bg-white rounded-xl border border-amber-200/80 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                        <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                          <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider">Investment Details</h2>
                        </div>
                        <div className="p-6">
                          <div className="flex flex-wrap gap-x-12 gap-y-4">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Investment Amount</p>
                              <p className="text-xl font-semibold text-slate-900">{formatCurrencyShort(inquiry.investorDetails.investmentAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Expected Interest</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.investorDetails.expectedInterest}% p.a.</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tenure</p>
                              <p className="text-sm font-medium text-slate-900">{inquiry.investorDetails.tenure} months</p>
                            </div>
                            {inquiry.investorDetails.frequency && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Frequency</p>
                                <p className="text-sm font-medium text-slate-900">{inquiry.investorDetails.frequency}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Notes */}
                    <div className="bg-white rounded-xl border border-amber-200/80 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                      <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                        <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider">Notes</h2>
                      </div>
                      <div className="p-6">
                        <p className="text-sm text-slate-700 leading-relaxed">{inquiry.notes}</p>
                      </div>
                    </div>

                    {/* 5. Activity Timeline – from activityLogs (stage changes) + created */}
                    <div className="bg-white rounded-xl border border-sky-200/80 shadow-sm overflow-hidden border-l-4 border-l-sky-500">
                      <div className="px-6 py-4 border-b border-sky-100 bg-sky-50/50">
                        <h2 className="text-sm font-semibold text-sky-800 uppercase tracking-wider">Activity Timeline</h2>
                      </div>
                      <div className="p-6">
                        <div className="flex flex-col gap-0">
                          {/* Inquiry Created (first event) */}
                          <div className="flex gap-5">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-sky-700" />
                              </div>
                              <div className="w-px flex-1 min-h-[28px] bg-slate-200 my-2" />
                            </div>
                            <div className="flex-1 pb-6">
                              <p className="text-sm font-semibold text-slate-900">Inquiry Created</p>
                              <p className="text-xs text-slate-500 mt-1">{inquiry.createdAt}</p>
                              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">Initial inquiry from {inquiry.source}</p>
                            </div>
                          </div>
                          {/* Stage changes from activityLogs (newest first in API, show chronological = reverse) */}
                          {inquiry.activityLogs && inquiry.activityLogs.length > 0
                            ? [...inquiry.activityLogs]
                              .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                              .map((log, idx) => (
                                <div key={idx} className="flex gap-5">
                                  <div className="flex flex-col items-center flex-shrink-0">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200/80 flex items-center justify-center">
                                      <TrendingUp className="w-5 h-5 text-violet-700" />
                                    </div>
                                    <div className="w-px flex-1 min-h-[28px] bg-slate-200 my-2" />
                                  </div>
                                  <div className="flex-1 pb-6">
                                    <p className="text-sm font-semibold text-slate-900">
                                      Stage: {log.oldStage ? `${STAGE_LABELS[log.oldStage] ?? log.oldStage} → ` : ''}
                                      {STAGE_LABELS[log.newStage ?? ''] ?? log.newStage}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {typeof log.changedAt === 'string' ? new Date(log.changedAt).toLocaleString() : log.changedAt}
                                    </p>
                                  </div>
                                </div>
                              ))
                            : null}
                          {/* Current stage (if no logs or as final state) */}
                          <div className="flex gap-5">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center">
                                <User className="w-5 h-5 text-emerald-700" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">Current: {STAGE_LABELS[inquiry.stage] ?? inquiry.stage}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'summary' && (
                <div className="p-4 sm:p-6 lg:p-8">
                  {combinedReport ? (
                    <>
                      {profileScore != null && (
                        <div className="mb-6 rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm ring-1 ring-sky-100/50">
                          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">Profile Score</p>
                          <p className="text-slate-500 text-sm mb-3">Based on Financial report</p>
                          <div className="flex flex-wrap items-baseline gap-3">
                            <span className="text-4xl sm:text-5xl font-bold text-sky-700 tabular-nums">{profileScore}</span>
                            <span className="text-lg font-semibold text-sky-600">/ 900</span>
                            {profileScoreRating && (
                              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
                                {profileScoreRating}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="prose prose-slate max-w-none [&_table]:w-full [&_table]:border-collapse [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:border [&_th]:border-slate-300 [&_th]:text-left [&_th]:font-semibold [&_th]:text-sm [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-slate-200 [&_td]:text-sm [&_p]:my-2 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4]:mt-3 [&_h4]:mb-1.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{combinedReport}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Sparkles className="w-12 h-12 text-violet-300 mb-4" />
                      <p className="text-slate-600 font-medium mb-2">No summary yet</p>
                      <p className="text-sm text-slate-500 mb-6 max-w-sm">
                        Click the AI button in the Documents panel to generate a table-based summary from all uploaded documents, or generate below.
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerateCombinedReport}
                        disabled={combinedReportLoading || documents.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-violet-300 bg-violet-50 text-violet-800 text-sm font-semibold hover:bg-violet-100 hover:border-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="w-4 h-4" />
                        {combinedReportLoading ? 'Generating…' : 'Generate summary'}
                      </button>
                      {documents.length === 0 && (
                        <p className="text-xs text-slate-400 mt-3">Upload at least one document first.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Actions + Documents (1/3) */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6 min-w-0">
            {/* Quick Actions above Documents */}
            <div className="bg-white rounded-xl border border-violet-200/80 shadow-md overflow-hidden ring-1 ring-violet-100/50">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-violet-100 bg-violet-50/50">
                <h2 className="text-xs sm:text-sm font-semibold text-violet-800 uppercase tracking-wider">Quick Actions</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                {showPriorityPicker ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 mb-2">Select priority</p>
                    {(['Hot', 'Warm', 'Cold'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleChangePriority(p)}
                        disabled={updatingPriority || inquiry?.priority === p}
                        className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${inquiry?.priority === p
                          ? 'border-amber-400 bg-amber-100 text-amber-900 cursor-default'
                          : p === 'Hot'
                            ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                            : p === 'Warm'
                              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowPriorityPicker(false)}
                      className="w-full mt-2 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPriorityPicker(true)}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 hover:border-amber-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Flag className="w-4 h-4" />
                    Change Priority
                  </button>
                )}
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-sky-200/80 shadow-md overflow-hidden ring-1 ring-sky-100/50">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white flex items-center justify-between gap-2 sm:gap-3">
                <h2 className="text-xs sm:text-sm font-semibold text-sky-800 uppercase tracking-wider flex items-center gap-2 min-w-0">
                  <span className="w-1 h-5 rounded-full bg-sky-500 flex-shrink-0" />
                  <span className="truncate">Documents</span>
                </h2>
                {documents.length > 0 && inquiry.type !== 'Investor' && (
                  <button
                    type="button"
                    onClick={handleGenerateCombinedReport}
                    disabled={combinedReportLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200/80 transition-colors disabled:opacity-50"
                    title="Generate combined table report below (Company Profile, Financial Snapshot, GST Turnover, Funding Readiness)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {combinedReportLoading ? 'Generating…' : 'AI'}
                  </button>
                )}
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {/* Upload Document – top of section */}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-sky-300 bg-sky-50/50 text-sky-700 text-sm font-semibold hover:bg-sky-100 hover:border-sky-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Uploading…' : 'Upload Document'}
                  </button>
                  <p className="text-xs text-slate-500 mt-1.5 text-center">PDF, Word, Excel, text or images. Max {MAX_FILE_SIZE_MB} MB per file (larger files stored in Supabase). Multiple files allowed.</p>
                </div>
                {uploadError && <p className="text-sm text-rose-600 font-medium">{uploadError}</p>}

                {/* List of uploaded documents */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Uploaded documents ({documents.length})
                  </h3>
                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6 rounded-lg bg-slate-50/50 border border-slate-100">
                      No documents yet. Use &quot;Upload Document&quot; above to add files.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {documents.map((doc) => (
                        <li key={doc._id} className="border-l-4 border-l-sky-400 border border-slate-200 rounded-lg p-3 bg-sky-50/30 hover:bg-sky-50/60 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {isPdf(doc) ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingPdf({ docId: doc._id, name: doc.fileName })}
                                  className="flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline text-left w-full"
                                  title="View PDF in browser"
                                >
                                  <FileText className="w-4 h-4 flex-shrink-0 text-slate-600" />
                                  <span className="truncate">{doc.fileName}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </button>
                              ) : (
                                <a
                                  href={doc.cloudinaryUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                                  title="Open in new tab"
                                >
                                  <FileText className="w-4 h-4 flex-shrink-0 text-slate-600" />
                                  <span className="truncate">{doc.fileName}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              )}
                              {doc.summary ? (
                                <div className="mt-2 text-xs text-slate-700 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:text-left [&_th]:font-semibold [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-slate-200 [&_p]:my-1 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4]:mt-2 [&_h4]:mb-1">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.summary}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">No summary yet. Click ✨ to generate.</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {inquiry.type !== 'Investor' && (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateSummary(doc._id)}
                                  disabled={generatingDocId !== null}
                                  className="p-1.5 text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Generate AI summary for this document"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {generatingDocId === doc._id && (
                            <p className="text-xs text-violet-600 mt-2 font-medium">Generating summary…</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PDF viewer modal – fetch with auth then show via blob URL */}
        {viewingPdf && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setViewingPdf(null)}
            role="dialog"
            aria-modal="true"
            aria-label="View PDF"
          >
            <div
              className="bg-white rounded-xl shadow-xl flex flex-col max-w-4xl w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                <span className="text-sm font-semibold text-slate-800 truncate">{viewingPdf.name}</span>
                <button
                  type="button"
                  onClick={() => setViewingPdf(null)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {viewingPdfError && (
                <div className="p-4 text-center text-rose-600 font-medium">{viewingPdfError}</div>
              )}
              {viewingPdfLoading && (
                <div className="flex-1 flex items-center justify-center min-h-[70vh] text-slate-500">
                  Loading document…
                </div>
              )}
              {!viewingPdfLoading && !viewingPdfError && viewingPdfUrl && (
                <iframe
                  src={viewingPdfUrl}
                  title={viewingPdf.name}
                  className="w-full flex-1 min-h-[70vh] rounded-b-xl"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
