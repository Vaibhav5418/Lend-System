import { Router } from 'express';
import Proposal from '../models/Proposal.js';
import Inquiry from '../models/Inquiry.js';

const router = Router();

async function nextProposalId() {
  const last = await Proposal.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'PROP-001';
  const num = parseInt(last.id.replace('PROP-', ''), 10) + 1;
  return `PROP-${String(num).padStart(3, '0')}`;
}

// GET all proposals (optionally filter by inquiryId)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.inquiryId) filter.inquiryId = req.query.inquiryId;
    const proposals = await Proposal.find(filter).sort({ createdAt: -1 }).lean();
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single proposal
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ id: req.params.id }).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Send a new proposal to borrower
router.post('/', async (req, res) => {
  try {
    const id = await nextProposalId();
    const body = { ...req.body, id };

    // Store initial terms in history
    body.history = [
      {
        proposedLoanAmount: body.proposedLoanAmount,
        proposedInterestRate: body.proposedInterestRate,
        proposedTenure: body.proposedTenure,
        notes: body.notes || '',
        action: 'Sent',
        timestamp: new Date(),
      },
    ];

    const proposal = await Proposal.create(body);

    // Update inquiry: sync proposed terms into borrowerDetails and move stage to PROPOSED
    // Only apply to Borrower inquiries — PROPOSED stage does not exist for Investor inquiries
    if (body.inquiryId) {
      const inquiry = await Inquiry.findOne({ id: body.inquiryId }).select('type').lean();
      if (inquiry && inquiry.type === 'Borrower') {
        await Inquiry.findOneAndUpdate(
          { id: body.inquiryId },
          {
            $set: {
              stage: 'PROPOSED',
              lastActivityAt: new Date(),
              lastActivity: `Proposal sent (${id})`,
              'borrowerDetails.loanAmount': body.proposedLoanAmount,
              'borrowerDetails.proposedInterest': body.proposedInterestRate,
              'borrowerDetails.tenure': body.proposedTenure,
            },
            $push: { activityLogs: { action: `Proposal ${id} sent`, newStage: 'PROPOSED', changedAt: new Date() } },
          }
        );
      }
    }

    res.status(201).json(proposal.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH — Update proposal status (Accept / Reject / Counter)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, proposedLoanAmount, proposedInterestRate, proposedTenure, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const proposal = await Proposal.findOne({ id: req.params.id });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    proposal.status = status;
    proposal.respondedAt = new Date();

    if (status === 'Counter' && proposedLoanAmount) {
      proposal.proposedLoanAmount = proposedLoanAmount;
      proposal.proposedInterestRate = proposedInterestRate ?? proposal.proposedInterestRate;
      proposal.proposedTenure = proposedTenure ?? proposal.proposedTenure;
    }

    proposal.history.push({
      proposedLoanAmount: proposal.proposedLoanAmount,
      proposedInterestRate: proposal.proposedInterestRate,
      proposedTenure: proposal.proposedTenure,
      notes: notes || '',
      action: status,
      timestamp: new Date(),
    });

    await proposal.save();

    // Look up inquiry type once for the stage-update guards below
    const linkedInquiry = proposal.inquiryId
      ? await Inquiry.findOne({ id: proposal.inquiryId }).select('type').lean()
      : null;

    // If accepted, lock terms on inquiry and set stage to APPROVED.
    // Only apply to Borrower inquiries — APPROVED stage does not exist for Investor inquiries.
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

    // If counter-proposed, also sync the revised terms to inquiry (borrower only)
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
    res.status(400).json({ error: err.message });
  }
});

// DELETE proposal
router.delete('/:id', async (req, res) => {
  try {
    const result = await Proposal.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Proposal not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
