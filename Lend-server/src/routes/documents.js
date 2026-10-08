import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import {
  uploadInquiryDocument,
  listInquiryDocuments,
  deleteInquiryDocument,
  regenerateDocumentSummary,
  fetchDocumentBytes,
  generateCombinedReportForInquiry,
} from '../services/documentService.js';
import { generateProfileScore } from '../services/grokService.js';
import Inquiry from '../models/Inquiry.js';
import Document from '../models/Document.js';
import { isValidId, ID_PATTERNS, sanitizeLog } from '../utils/security.js';

const router = Router({ mergeParams: true });

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.json',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

// 15 MB in-memory buffer limit to mitigate memory exhaustion DoS while supporting standard loan documents
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
      return cb(new Error('Invalid file type. Only PDF, Word, Excel, text, CSV, and image documents are accepted.'));
    }
    cb(null, true);
  },
});

/**
 * Validate binary file magic numbers where applicable
 */
function validateFileSignature(buffer, mimetype, ext) {
  if (!buffer || buffer.length === 0) return false;

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (mimetype === 'application/pdf' || ext === '.pdf') {
    return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  // PNG: 0x89 0x50 0x4E 0x47
  if (mimetype === 'image/png' || ext === '.png') {
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  // JPEG: 0xFF 0xD8 0xFF
  if (mimetype === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  // ZIP-based Office docs (.docx, .xlsx): PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === '.docx' ||
    ext === '.xlsx'
  ) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  // Legacy Office (.doc, .xls) OLE2 (0xD0 0xCF 0x11 0xE0) or ZIP
  if (mimetype === 'application/msword' || mimetype === 'application/vnd.ms-excel' || ext === '.doc' || ext === '.xls') {
    return (
      (buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) ||
      (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04)
    );
  }
  // WebP: RIFF....WEBP
  if (mimetype === 'image/webp' || ext === '.webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  // Text, CSV, JSON: ensure no null bytes
  if (mimetype.startsWith('text/') || mimetype === 'application/json' || ext === '.txt' || ext === '.csv' || ext === '.json') {
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  }
  return true;
}

/**
 * GET /api/inquiries/:inquiryId/documents
 */
router.get('/', async (req, res) => {
  try {
    const { inquiryId } = req.params;
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and server logs.' });
    }
    const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    const docs = await listInquiryDocuments(inquiryId);
    res.json(JSON.parse(JSON.stringify(docs)));
  } catch (err) {
    console.error('GET documents error:', sanitizeLog(err));
    if (!res.headersSent) res.status(500).json({ error: 'Unable to retrieve documents' });
  }
});

/**
 * POST /api/inquiries/:inquiryId/documents
 * multipart/form-data, field name: file
 */
router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds maximum allowed limit of 15MB' });
        }
        return res.status(400).json({ error: err.message || 'File upload rejected' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { inquiryId } = req.params;
      if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
        return res.status(400).json({ error: 'Invalid inquiry ID format' });
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if (!validateFileSignature(req.file.buffer, req.file.mimetype, ext)) {
        return res.status(400).json({ error: 'File content does not match expected file format' });
      }

      const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
      if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

      const doc = await uploadInquiryDocument(inquiryId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });
      res.status(201).json(doc);
    } catch (err) {
      console.error('Document upload error:', sanitizeLog(err));
      if (!res.headersSent) res.status(500).json({ error: 'Unable to upload document' });
    }
  }
);

/**
 * POST /api/inquiries/:inquiryId/documents/combined-report
 * Generate one combined AI report and a CIBIL-like profile score; save both on the inquiry.
 */
router.post('/combined-report', async (req, res) => {
  try {
    const { inquiryId } = req.params;
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    const markdown = await generateCombinedReportForInquiry(inquiryId);
    let profileScore = null;
    let profileScoreRating = null;
    try {
      const scoreResult = await generateProfileScore(markdown);
      if (scoreResult) {
        profileScore = scoreResult.score;
        profileScoreRating = scoreResult.rating;
      }
    } catch (scoreErr) {
      console.warn('Profile score generation failed:', sanitizeLog(scoreErr?.message || scoreErr));
    }
    await Inquiry.findOneAndUpdate(
      { id: inquiryId },
      {
        $set: {
          combinedReportMarkdown: markdown,
          combinedReportGeneratedAt: new Date(),
          ...(profileScore != null && { profileScore }),
          ...(profileScoreRating != null && { profileScoreRating }),
        },
      }
    );
    res.json({ markdown, profileScore, profileScoreRating });
  } catch (err) {
    console.error('Combined report error:', sanitizeLog(err));
    if (!res.headersSent) res.status(500).json({ error: 'Unable to generate combined report' });
  }
});

/**
 * GET /api/inquiries/:inquiryId/documents/:docId/view
 * Stream document from Cloudinary with inline headers so it can be shown in an iframe.
 */
router.get('/:docId/view', async (req, res) => {
  try {
    const { inquiryId, docId } = req.params;
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (!isValidId(docId, ID_PATTERNS.document)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    const doc = await Document.findOne({ _id: docId, inquiryId }).lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.cloudinaryUrl || !doc.cloudinaryUrl.startsWith('http')) {
      return res.status(502).json({ error: 'Document URL not available' });
    }
    const buffer = await fetchDocumentBytes(doc.cloudinaryUrl);
    const mimeType = doc.mimeType || 'application/pdf';
    const fileName = doc.fileName || 'document.pdf';
    res.setHeader('Content-Type', mimeType);
    const safeName = String(fileName).replace(/["\r\n]/g, "'");
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Document view error:', sanitizeLog(err));
    if (!res.headersSent) {
      res.status(err.message?.includes('Cannot reach') ? 502 : 500).json({ error: 'Unable to retrieve document content' });
    }
  }
});

/**
 * POST /api/inquiries/:inquiryId/documents/:docId/summary
 * Regenerate AI summary for this document.
 */
router.post('/:docId/summary', async (req, res) => {
  try {
    const { inquiryId, docId } = req.params;
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (!isValidId(docId, ID_PATTERNS.document)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    const doc = await regenerateDocumentSummary(inquiryId, docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    console.error('Regenerate summary error:', sanitizeLog(err));
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to regenerate document summary' });
    }
  }
});

/**
 * DELETE /api/inquiries/:inquiryId/documents/:docId
 */
router.delete('/:docId', async (req, res) => {
  try {
    const { inquiryId, docId } = req.params;
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (!isValidId(docId, ID_PATTERNS.document)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    const deleted = await deleteInquiryDocument(inquiryId, docId);
    if (!deleted) return res.status(404).json({ error: 'Document not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete document error:', sanitizeLog(err));
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to delete document' });
    }
  }
});

export default router;
