import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import Document from '../models/Document.js';
import { summarizeWithGrok, generateCombinedReport } from './grokService.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

/** Cloudinary free plan limit for raw upload (bytes). Files above this go to Supabase bucket. */
const CLOUDINARY_RAW_LIMIT = 10 * 1024 * 1024; // 10 MB

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_DOCUMENTS || 'lendflow-documents';

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return { cloudName, apiKey, apiSecret };
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

const FOLDER = 'lendflow-inquiries';

function sanitizeStorageName(name) {
  const base = path.basename(name);
  return base.replace(/[^\w.\-]/g, '_').replace(/_+/g, '_').slice(0, 200) || 'file';
}

/** MIME types that must use raw/upload so browser can open (e.g. PDF with correct Content-Type). */
const RAW_RESOURCE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

function useRawUpload(mimetype) {
  return mimetype && RAW_RESOURCE_TYPES.has(mimetype);
}

/**
 * Ensure PDF/raw docs on Cloudinary use /raw/upload/ URL with fl_inline so browser opens inline.
 * Supabase docs are returned as-is (URL already points to storage).
 */
function ensureInlinePdfUrl(doc, config) {
  if (doc.storageProvider === 'supabase') return doc;

  const isPdfOrRaw = doc.mimeType === 'application/pdf' || doc.resourceType === 'raw';
  if (!isPdfOrRaw) return doc;

  let rawUrl = doc.cloudinaryUrl || '';
  if (doc.cloudinaryUrl && doc.cloudinaryUrl.includes('/image/upload/') && config.cloudName) {
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey || '', api_secret: config.apiSecret || '' });
    rawUrl = cloudinary.url(doc.publicId, { resource_type: 'raw', secure: true });
  } else if (!rawUrl) return doc;

  if (rawUrl.includes('/raw/upload/') && !rawUrl.includes('/raw/upload/fl_inline/')) {
    rawUrl = rawUrl.replace('/raw/upload/', '/raw/upload/fl_inline/');
  }
  return { ...doc, cloudinaryUrl: rawUrl };
}

/**
 * Extract text from buffer for summarization. Supports PDF, Word (.docx), Excel (.xls/.xlsx), text/*, CSV, JSON.
 * Used when user clicks AI button (per-doc or combined report) for all document types we can read.
 */
async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      return data.text || null;
    } catch (e) {
      console.error('PDF parse error:', e.message);
      return null;
    }
  }
  // Word .docx
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return (result?.value && result.value.trim()) ? result.value.trim() : null;
    } catch (e) {
      console.error('Word (.docx) parse error:', e.message);
      return null;
    }
  }
  // Excel .xls / .xlsx
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const parts = [];
      for (const name of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) parts.push(`--- Sheet: ${name} ---\n${csv.trim()}`);
      }
      return parts.length ? parts.join('\n\n') : null;
    } catch (e) {
      console.error('Excel parse error:', e.message);
      return null;
    }
  }
  if (mimeType?.startsWith('text/') || mimeType === 'text/csv' || mimeType === 'application/json') {
    return buffer.toString('utf8');
  }
  return null;
}

/**
 * Upload file buffer to Cloudinary and save document in DB. No summary is generated on upload;
 * summary/table is generated only when the user clicks the AI button (per-doc or combined report).
 * @param {string} inquiryId
 * @param {{ buffer: Buffer; originalname: string; mimetype: string }} file
 */
export async function uploadInquiryDocument(inquiryId, file) {
  const { buffer, originalname, mimetype } = file;
  const isRaw = useRawUpload(mimetype);
  const resourceType = isRaw ? 'raw' : 'auto';
  const useSupabase = buffer.length > CLOUDINARY_RAW_LIMIT;

  if (useSupabase) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error(
        'Files over 10 MB require Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env'
      );
    }
    const storagePath = `${inquiryId}/${Date.now()}-${sanitizeStorageName(originalname)}`;
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, { contentType: mimetype || 'application/octet-stream', upsert: false });
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(error.message || 'Failed to upload large file to Supabase');
    }
    const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(data.path);
    const doc = await Document.create({
      inquiryId,
      fileName: originalname,
      mimeType: mimetype,
      cloudinaryUrl: urlData.publicUrl,
      publicId: data.path,
      resourceType,
      storageProvider: 'supabase',
      summary: '',
    });
    return doc.toObject();
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env'
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const uploadResult = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        resource_type: resourceType,
        folder: FOLDER,
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });

  const doc = await Document.create({
    inquiryId,
    fileName: originalname,
    mimeType: mimetype,
    cloudinaryUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    resourceType,
    storageProvider: 'cloudinary',
    summary: '',
  });
  return doc.toObject();
}

/**
 * List documents for an inquiry.
 * PDFs/raw docs are returned with /raw/upload/ URLs so they open inline in the browser (no fl_attachment).
 */
export async function listInquiryDocuments(inquiryId) {
  const docs = await Document.find({ inquiryId }).sort({ uploadedAt: -1 }).lean();
  const config = getCloudinaryConfig();
  return docs.map((doc) => ensureInlinePdfUrl(doc, config));
}

/**
 * Fetch document bytes from Cloudinary. Throws on network error (e.g. ENOTFOUND) or bad response.
 */
export async function fetchDocumentBytes(cloudinaryUrl) {
  let res;
  try {
    res = await fetch(cloudinaryUrl);
  } catch (err) {
    const msg = err.cause?.code === 'ENOTFOUND'
      ? 'Cannot reach Cloudinary. Check your network or DNS.'
      : err.message || 'Network error';
    throw new Error(msg);
  }
  if (!res.ok) throw new Error('Failed to fetch document from storage');
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Regenerate AI summary for a document: fetch file from Cloudinary, extract text, call Grok, update doc.
 */
export async function regenerateDocumentSummary(inquiryId, docId) {
  const doc = await Document.findOne({ _id: docId, inquiryId });
  if (!doc) return null;

  const buffer = await fetchDocumentBytes(doc.cloudinaryUrl);
  const mimeType = doc.mimeType || 'application/pdf';

  const text = await extractTextFromBuffer(buffer, mimeType);
  let summary;
  if (text && text.trim().length >= 10) {
    summary = await summarizeWithGrok(text);
  } else {
    summary =
      'No extractable text from this file (e.g. image or unsupported format). Summary works for PDF, Word (.docx), Excel (.xls/.xlsx), text, CSV, and JSON.';
  }

  const updated = await Document.findByIdAndUpdate(
    docId,
    { $set: { summary } },
    { new: true }
  ).lean();
  const config = getCloudinaryConfig();
  return ensureInlinePdfUrl(updated, config);
}

/**
 * Build combined text from all inquiry documents for AI combined report. Includes every document:
 * uses existing summary or fetches file and extracts text (PDF, text, CSV, JSON, etc.); if no text
 * can be extracted (e.g. image), adds a short placeholder so the report is still "for all documents".
 */
async function getCombinedDocumentContent(inquiryId) {
  const docs = await Document.find({ inquiryId }).sort({ uploadedAt: 1 }).lean();
  const parts = [];
  for (const doc of docs) {
    let content = (doc.summary || '').trim();
    const isPlaceholder =
      !content ||
      content.startsWith('Document uploaded.') ||
      content.startsWith('Document has little or no') ||
      content.includes('Summary available only for PDF') ||
      content.includes('Summary unavailable');
    if (isPlaceholder && doc.cloudinaryUrl && doc.cloudinaryUrl.startsWith('http')) {
      try {
        const buffer = await fetchDocumentBytes(doc.cloudinaryUrl);
        const mimeType = doc.mimeType || 'application/pdf';
        const text = await extractTextFromBuffer(buffer, mimeType);
        if (text && text.trim().length >= 10) content = text.trim();
      } catch (e) {
        console.error('Fetch/extract for combined report:', e.message);
      }
    }
    const fileName = doc.fileName || 'Unnamed';
    if (content) {
      parts.push(`--- Document: ${fileName} ---\n\n${content}`);
    } else {
      parts.push(`--- Document: ${fileName} ---\n\n[No text could be extracted from this file (e.g. image or unsupported format). Include in report if other documents provide context.]`);
    }
  }
  return parts.join('\n\n');
}

/**
 * Generate one combined AI report (four tables) from all documents of an inquiry.
 * @param {string} inquiryId
 * @returns {Promise<string>} Markdown with Company Profile, Financial Snapshot, GST Turnover Summary, Funding Readiness Assessment.
 */
export async function generateCombinedReportForInquiry(inquiryId) {
  const combinedContent = await getCombinedDocumentContent(inquiryId);
  return generateCombinedReport(combinedContent);
}

/**
 * Delete a document (DB + Cloudinary or Supabase storage).
 */
export async function deleteInquiryDocument(inquiryId, docId) {
  const doc = await Document.findOne({ _id: docId, inquiryId });
  if (!doc) return null;

  if (doc.storageProvider === 'supabase' && doc.publicId) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.storage.from(SUPABASE_BUCKET).remove([doc.publicId]);
      } catch (e) {
        console.error('Supabase storage remove error:', e.message);
      }
    }
  } else {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }
    const resourceType = doc.resourceType || (doc.mimeType && useRawUpload(doc.mimeType) ? 'raw' : 'auto');
    try {
      await new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(doc.publicId, { resource_type: resourceType }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    } catch (e) {
      console.error('Cloudinary destroy error:', e.message);
    }
  }

  await Document.deleteOne({ _id: docId, inquiryId });
  return true;
}
