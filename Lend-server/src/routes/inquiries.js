import { Router } from 'express';
import mongoose from 'mongoose';
import Inquiry from '../models/Inquiry.js';
import { updateInquiryStage } from '../services/stageService.js';

const router = Router();

async function getNextInquiryId() {
  const last = await Inquiry.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'INQ-001';
  const num = parseInt(last.id.replace('INQ-', ''), 10) + 1;
  return `INQ-${String(num).padStart(3, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ id: 1 }).lean();
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and server logs.' });
    }
    const inquiry = await Inquiry.findOne({ id: req.params.id }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(JSON.parse(JSON.stringify(inquiry)));
  } catch (err) {
    console.error('GET inquiry error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const id = await getNextInquiryId();
    const body = { ...req.body, id };
    if (body.stage === undefined || body.stage === '') body.stage = 'NEW';
    const inquiry = await Inquiry.create(body);
    res.status(201).json(inquiry.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const inquiry = await Inquiry.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(inquiry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/inquiries/:id/stage
 * Body: { stage: string }
 * Validates stage against inquiry type (Borrower → BORROWER_STAGES, Investor → INVESTOR_STAGES).
 * Updates stage, lastActivityAt, and appends to activityLogs.
 */
router.patch('/:id/stage', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateInquiryStage(id, req.body?.stage);
    if (!result.success) {
      return res.status(result.status).json({ error: result.message });
    }
    res.json(result.inquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Inquiry.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Inquiry not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
