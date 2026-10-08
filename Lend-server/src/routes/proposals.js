import { Router } from 'express';
import Proposal from '../models/Proposal.js';
import Inquiry from '../models/Inquiry.js';
import {
  isValidId,
  parseQueryId,
  ID_PATTERNS,
  sanitizeLog,
  parsePositiveNumber,
  parsePositiveInteger,
  sanitizeString,
} from '../utils/security.js';

const router = Router();

const ALLOWED_PATCH_STATUSES = Object.freeze(['Accepted', 'Rejected', 'Counter']);

async function nextProposalId() {
  const last = await Proposal.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last || typeof last.id !== 'string') return 'PROP-001';
  const num = Number.parseInt(last.id.replace('PROP-', ''), 10) + 1;
  return `PROP-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
}

// GET all proposals (optionally filter by inquiryId)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.inquiryId !== undefined) {
      const parsedInqId = parseQueryId(req.query.inquiryId, ID_PATTERNS.inquiry, 'inquiryId');
      if (!parsedInqId.valid) {
        return res.status(400).json({ error: parsedInqId.error });
      }
      if (parsedInqId.value) {
        filter.inquiryId = parsedInqId.value;
      }
    }
    const proposals = await Proposal.find(filter).sort({ createdAt: -1 }).lean();
    res.json(proposals);
  } catch (err) {
    console.error('Fetch proposals error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch proposals' });
  }
});

// GET single proposal
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.proposal)) {
      return res.status(400).json({ error: 'Invalid proposal ID format' });
    }
    const proposal = await Proposal.findOne({ id }).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    console.error('Fetch proposal error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch proposal' });
  }
});

// POST — Send a new proposal to borrower
router.post('/', async (req, res) => {
  try {
    const {
      inquiryId,
      borrowerName,
      originalLoanAmount,
      originalInterestRate,
      originalTenure,
      proposedLoanAmount,
      proposedInterestRate,
      proposedTenure,
      notes,
    } = req.body;

    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Valid inquiryId (e.g. INQ-001) is required' });
    }

    const cleanProposedLoanAmount = parsePositiveNumber(proposedLoanAmount);
    if (!cleanProposedLoanAmount) {
      return res.status(400).json({ error: 'Valid positive proposedLoanAmount is required' });
    }

    const cleanProposedInterestRate = parsePositiveNumber(proposedInterestRate);
    if (!cleanProposedInterestRate) {
      return res.status(400).json({ error: 'Valid positive proposedInterestRate is required' });
    }

    const cleanProposedTenure = parsePositiveInteger(proposedTenure);
    if (!cleanProposedTenure) {
      return res.status(400).json({ error: 'Valid positive proposedTenure is required' });
    }

    const cleanOriginalLoanAmount = parsePositiveNumber(originalLoanAmount, true) ?? 0;
    const cleanOriginalInterestRate = parsePositiveNumber(originalInterestRate, true) ?? 0;
    const cleanOriginalTenure = parsePositiveInteger(originalTenure, true) ?? 0;
    const cleanNotes = sanitizeString(notes, 2000);

    let proposal;
    let finalId;
    for (let attempt = 0; attempt < 5; attempt++) {
      finalId = await nextProposalId();

      // Server-controlled history construction
      const history = [
        {
          proposedLoanAmount: cleanProposedLoanAmount,
          proposedInterestRate: cleanProposedInterestRate,
          proposedTenure: cleanProposedTenure,
          notes: cleanNotes,
          action: 'Sent',
          timestamp: new Date(),
        },
      ];

      const proposalData = {
        id: finalId,
        inquiryId: inquiryId.trim(),
        borrowerName: sanitizeString(borrowerName, 200),
        originalLoanAmount: cleanOriginalLoanAmount,
        originalInterestRate: cleanOriginalInterestRate,
        originalTenure: cleanOriginalTenure,
        proposedLoanAmount: cleanProposedLoanAmount,
        proposedInterestRate: cleanProposedInterestRate,
        proposedTenure: cleanProposedTenure,
        notes: cleanNotes,
        status: 'Sent',
        sentAt: new Date(),
        history,
      };

      try {
        proposal = await Proposal.create(proposalData);
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }

    // Sync proposed terms to Inquiry if Borrower type
    const inquiry = await Inquiry.findOne({ id: proposal.inquiryId }).select('type').lean();
    if (inquiry && inquiry.type === 'Borrower') {
      await Inquiry.findOneAndUpdate(
        { id: proposal.inquiryId },
        {
          $set: {
            stage: 'PROPOSED',
            lastActivityAt: new Date(),
            lastActivity: `Proposal sent (${proposal.id})`,
            'borrowerDetails.loanAmount': proposal.proposedLoanAmount,
            'borrowerDetails.proposedInterest': proposal.proposedInterestRate,
            'borrowerDetails.tenure': proposal.proposedTenure,
          },
          $push: { activityLogs: { action: `Proposal ${proposal.id} sent`, newStage: 'PROPOSED', changedAt: new Date() } },
        }
      );
    }

    res.status(201).json(proposal.toObject());
  } catch (err) {
    console.error('Create proposal error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to create proposal' });
  }
});

// PATCH — Update proposal status (Accept / Reject / Counter)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.proposal)) {
      return res.status(400).json({ error: 'Invalid proposal ID format' });
    }

    const { status, proposedLoanAmount, proposedInterestRate, proposedTenure, notes } = req.body;
    if (!status || !ALLOWED_PATCH_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be Accepted, Rejected, or Counter' });
    }

    const proposal = await Proposal.findOne({ id });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    proposal.status = status;
    proposal.respondedAt = new Date();

    if (status === 'Counter') {
      if (proposedLoanAmount !== undefined) {
        const amt = parsePositiveNumber(proposedLoanAmount);
        if (amt) proposal.proposedLoanAmount = amt;
      }
      if (proposedInterestRate !== undefined) {
        const rate = parsePositiveNumber(proposedInterestRate);
        if (rate) proposal.proposedInterestRate = rate;
      }
      if (proposedTenure !== undefined) {
        const tenure = parsePositiveInteger(proposedTenure);
        if (tenure) proposal.proposedTenure = tenure;
      }
    }

    proposal.history.push({
      proposedLoanAmount: proposal.proposedLoanAmount,
      proposedInterestRate: proposal.proposedInterestRate,
      proposedTenure: proposal.proposedTenure,
      notes: sanitizeString(notes, 2000),
      action: status,
      timestamp: new Date(),
    });

    await proposal.save();

    // Look up inquiry type once for the stage-update guards below
    const linkedInquiry = isValidId(proposal.inquiryId, ID_PATTERNS.inquiry)
      ? await Inquiry.findOne({ id: proposal.inquiryId }).select('type').lean()
      : null;

    if (status === 'Accepted' && linkedInquiry && linkedInquiry.type === 'Borrower') {
      await Inquiry.findOneAndUpdate(
        { id: proposal.inquiryId },
        {
          $set: {
            stage: 'APPROVED',
            lastActivityAt: new Date(),
            lastActivity: `Proposal ${proposal.id} accepted`,
            'borrowerDetails.loanAmount': proposal.proposedLoanAmount,
            'borrowerDetails.proposedInterest': proposal.proposedInterestRate,
            'borrowerDetails.tenure': proposal.proposedTenure,
          },
          $push: { activityLogs: { action: `Proposal ${proposal.id} accepted`, newStage: 'APPROVED', changedAt: new Date() } },
        }
      );
    }

    if (status === 'Counter' && linkedInquiry && linkedInquiry.type === 'Borrower') {
      await Inquiry.findOneAndUpdate(
        { id: proposal.inquiryId },
        {
          $set: {
            lastActivityAt: new Date(),
            lastActivity: `Counter-proposal on ${proposal.id}`,
            'borrowerDetails.loanAmount': proposal.proposedLoanAmount,
            'borrowerDetails.proposedInterest': proposal.proposedInterestRate,
            'borrowerDetails.tenure': proposal.proposedTenure,
          },
          $push: { activityLogs: { action: `Counter-proposal on ${proposal.id}`, changedAt: new Date() } },
        }
      );
    }

    res.json(proposal.toObject());
  } catch (err) {
    console.error('Update proposal status error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update proposal status' });
  }
});

// DELETE proposal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.proposal)) {
      return res.status(400).json({ error: 'Invalid proposal ID format' });
    }
    const result = await Proposal.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Proposal not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete proposal error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete proposal' });
  }
});

export default router;
