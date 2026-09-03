import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
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

const router = Router({ mergeParams: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB; files >10 MB stored in Supabase
});

/**
 * GET /api/inquiries/:inquiryId/documents
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and server logs.' });
    }
    const { inquiryId } = req.params;
    if (!inquiryId) {
      return res.status(400).json({ error: 'inquiryId required' });
    }
    const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    const docs = await listInquiryDocuments(inquiryId);
    res.json(JSON.parse(JSON.stringify(docs)));
  } catch (err) {
    console.error('GET documents error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inquiries/:inquiryId/documents
 * multipart/form-data, field name: file
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { inquiryId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    const doc = await uploadInquiryDocument(inquiryId, {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('Document upload error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inquiries/:inquiryId/documents/combined-report
 * Generate one combined AI report and a CIBIL-like profile score; save both on the inquiry.
 */
router.post('/combined-report', async (req, res) => {
  try {
    const { inquiryId } = req.params;
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
      console.warn('Profile score generation failed:', scoreErr.message);
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
    console.error('Combined report error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/** Validate MongoDB ObjectId (24 hex chars). */
function isValidDocId(id) {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
}

/**
 * GET /api/inquiries/:inquiryId/documents/:docId/view
 * Stream document from Cloudinary with inline headers so it can be shown in an iframe (avoids X-Frame-Options).
 */
router.get('/:docId/view', async (req, res) => {
  try {
    const { inquiryId, docId } = req.params;
    if (!isValidDocId(docId)) {
      return res.status(400).json({ error: 'Invalid document id' });
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
    const safeName = String(fileName).replace(/"/g, "'");
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Document view error:', err);
    if (!res.headersSent) {
      res.status(err.message?.includes('Cannot reach') ? 502 : 500).json({ error: err.message });
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
    if (!isValidDocId(docId)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }
    const doc = await regenerateDocumentSummary(inquiryId, docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    console.error('Regenerate summary error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * DELETE /api/inquiries/:inquiryId/documents/:docId
 */
router.delete('/:docId', async (req, res) => {
  try {
    const { inquiryId, docId } = req.params;
    if (!isValidDocId(docId)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }
    const deleted = await deleteInquiryDocument(inquiryId, docId);
    if (!deleted) return res.status(404).json({ error: 'Document not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete document error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
