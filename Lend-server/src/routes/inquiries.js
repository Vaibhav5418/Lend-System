import { Router } from 'express';
import mongoose from 'mongoose';
import Inquiry from '../models/Inquiry.js';
import { updateInquiryStage } from '../services/stageService.js';
import { BORROWER_STAGES, INVESTOR_STAGES, DEFAULT_STAGE, isStageAllowed } from '../constants/stages.js';
import {
  isValidId,
  ID_PATTERNS,
  sanitizeLog,
  parsePositiveNumber,
  parsePositiveInteger,
  sanitizeString,
} from '../utils/security.js';

const router = Router();

const ALLOWED_INQUIRY_TYPES = Object.freeze(['Borrower', 'Investor']);
const ALLOWED_SOURCES = Object.freeze(['Website', 'Referral', 'Walk-in', 'Social Media', 'Agent', 'Existing Client']);
const ALLOWED_PRIORITIES = Object.freeze(['Hot', 'Warm', 'Cold']);
const ALLOWED_FREQUENCIES = Object.freeze(['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly']);

async function getNextInquiryId() {
  const last = await Inquiry.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last || typeof last.id !== 'string') return 'INQ-001';
  const num = Number.parseInt(last.id.replace('INQ-', ''), 10) + 1;
  return `INQ-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
}

router.get('/', async (_req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ id: 1 }).lean();
    res.json(inquiries);
  } catch (err) {
    console.error('Fetch inquiries error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch inquiries' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and server logs.' });
    }
    const inquiry = await Inquiry.findOne({ id }).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(inquiry);
  } catch (err) {
    console.error('GET inquiry error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch inquiry' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      type,
      name,
      mobile,
      email,
      city,
      source,
      priority,
      assignedTo,
      referenceAgent,
      stage: requestedStage,
      nextFollowUp,
      turnover,
      notes,
      borrowerDetails,
      investorDetails,
    } = req.body;

    if (!ALLOWED_INQUIRY_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Valid inquiry type (Borrower or Investor) is required' });
    }
    if (!ALLOWED_SOURCES.includes(source)) {
      return res.status(400).json({ error: 'Valid source is required' });
    }
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Valid priority is required' });
    }

    const allowedStages = type === 'Borrower' ? BORROWER_STAGES : INVESTOR_STAGES;
    const stage = isStageAllowed(requestedStage, allowedStages) ? requestedStage : DEFAULT_STAGE;

    let cleanBorrowerDetails;
    if (type === 'Borrower' && borrowerDetails && typeof borrowerDetails === 'object') {
      cleanBorrowerDetails = {
        loanAmount: parsePositiveNumber(borrowerDetails.loanAmount, true) ?? 0,
        tenure: parsePositiveInteger(borrowerDetails.tenure, true) ?? 0,
        proposedInterest: parsePositiveNumber(borrowerDetails.proposedInterest, true) ?? 0,
      };
    }

    let cleanInvestorDetails;
    if (type === 'Investor' && investorDetails && typeof investorDetails === 'object') {
      cleanInvestorDetails = {
        investmentAmount: parsePositiveNumber(investorDetails.investmentAmount, true) ?? 0,
        expectedInterest: parsePositiveNumber(investorDetails.expectedInterest, true) ?? 0,
        tenure: parsePositiveInteger(investorDetails.tenure, true) ?? 0,
        frequency: ALLOWED_FREQUENCIES.includes(investorDetails.frequency) ? investorDetails.frequency : 'Monthly',
      };
    }

    let inquiry;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await getNextInquiryId();
      const now = new Date();

      // Explicit allowlist construction — protect activityLogs, id, timestamps, AI summaries
      const inquiryData = {
        id,
        type,
        name: sanitizeString(name, 200),
        mobile: sanitizeString(mobile, 50),
        email: sanitizeString(email, 100),
        city: sanitizeString(city, 100),
        source,
        priority,
        assignedTo: sanitizeString(assignedTo, 200),
        referenceAgent: sanitizeString(referenceAgent, 200),
        stage,
        nextFollowUp: sanitizeString(nextFollowUp, 100),
        turnover: sanitizeString(turnover, 100),
        lastActivity: 'Inquiry created',
        lastActivityAt: now,
        createdAt: now.toISOString(),
        notes: sanitizeString(notes, 2000),
        activityLogs: [
          {
            action: 'Inquiry created',
            newStage: stage,
            changedAt: now,
          },
        ],
        ...(cleanBorrowerDetails ? { borrowerDetails: cleanBorrowerDetails } : {}),
        ...(cleanInvestorDetails ? { investorDetails: cleanInvestorDetails } : {}),
      };

      try {
        inquiry = await Inquiry.create(inquiryData);
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }
    res.status(201).json(inquiry.toObject());
  } catch (err) {
    console.error('Create inquiry error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to create inquiry' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }

    const existing = await Inquiry.findOne({ id });
    if (!existing) return res.status(404).json({ error: 'Inquiry not found' });

    // Explicit field allowlist — protect id, _id, type, stage, activityLogs, profileScore, etc.
    const updateFields = {};

    if (req.body.name !== undefined) updateFields.name = sanitizeString(req.body.name, 200);
    if (req.body.mobile !== undefined) updateFields.mobile = sanitizeString(req.body.mobile, 50);
    if (req.body.email !== undefined) updateFields.email = sanitizeString(req.body.email, 100);
    if (req.body.city !== undefined) updateFields.city = sanitizeString(req.body.city, 100);
    if (req.body.source !== undefined && ALLOWED_SOURCES.includes(req.body.source)) {
      updateFields.source = req.body.source;
    }
    if (req.body.priority !== undefined && ALLOWED_PRIORITIES.includes(req.body.priority)) {
      updateFields.priority = req.body.priority;
    }
    if (req.body.assignedTo !== undefined) updateFields.assignedTo = sanitizeString(req.body.assignedTo, 200);
    if (req.body.referenceAgent !== undefined) updateFields.referenceAgent = sanitizeString(req.body.referenceAgent, 200);
    if (req.body.nextFollowUp !== undefined) updateFields.nextFollowUp = sanitizeString(req.body.nextFollowUp, 100);
    if (req.body.turnover !== undefined) updateFields.turnover = sanitizeString(req.body.turnover, 100);
    if (req.body.notes !== undefined) updateFields.notes = sanitizeString(req.body.notes, 2000);

    if (existing.type === 'Borrower' && req.body.borrowerDetails && typeof req.body.borrowerDetails === 'object') {
      const bd = {};
      if (req.body.borrowerDetails.loanAmount !== undefined) {
        bd.loanAmount = parsePositiveNumber(req.body.borrowerDetails.loanAmount, true) ?? 0;
      }
      if (req.body.borrowerDetails.tenure !== undefined) {
        bd.tenure = parsePositiveInteger(req.body.borrowerDetails.tenure, true) ?? 0;
      }
      if (req.body.borrowerDetails.proposedInterest !== undefined) {
        bd.proposedInterest = parsePositiveNumber(req.body.borrowerDetails.proposedInterest, true) ?? 0;
      }
      const existingBd = existing.borrowerDetails?.toObject?.() || existing.borrowerDetails || {};
      updateFields.borrowerDetails = { ...existingBd, ...bd };
    }

    if (existing.type === 'Investor' && req.body.investorDetails && typeof req.body.investorDetails === 'object') {
      const invd = {};
      if (req.body.investorDetails.investmentAmount !== undefined) {
        invd.investmentAmount = parsePositiveNumber(req.body.investorDetails.investmentAmount, true) ?? 0;
      }
      if (req.body.investorDetails.expectedInterest !== undefined) {
        invd.expectedInterest = parsePositiveNumber(req.body.investorDetails.expectedInterest, true) ?? 0;
      }
      if (req.body.investorDetails.tenure !== undefined) {
        invd.tenure = parsePositiveInteger(req.body.investorDetails.tenure, true) ?? 0;
      }
      if (req.body.investorDetails.frequency !== undefined && ALLOWED_FREQUENCIES.includes(req.body.investorDetails.frequency)) {
        invd.frequency = req.body.investorDetails.frequency;
      }
      const existingInvd = existing.investorDetails?.toObject?.() || existing.investorDetails || {};
      updateFields.investorDetails = { ...existingInvd, ...invd };
    }

    updateFields.lastActivityAt = new Date();
    updateFields.lastActivity = 'Details updated';

    const inquiry = await Inquiry.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    res.json(inquiry);
  } catch (err) {
    console.error('Update inquiry error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update inquiry' });
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
    if (!isValidId(id, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    const result = await updateInquiryStage(id, req.body?.stage);
    if (!result.success) {
      return res.status(result.status).json({ error: result.message });
    }
    res.json(result.inquiry);
  } catch (err) {
    console.error('Update inquiry stage error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to update inquiry stage' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    const result = await Inquiry.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Inquiry not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete inquiry error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete inquiry' });
  }
});

export default router;
