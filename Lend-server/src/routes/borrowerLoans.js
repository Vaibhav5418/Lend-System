import { Router } from 'express';
import BorrowerLoan from '../models/BorrowerLoan.js';
import BorrowerCollection from '../models/BorrowerCollection.js';
import Inquiry from '../models/Inquiry.js';
import { generateRepaymentSchedule, toAnnualRate } from '../utils/financialCalc.js';

const router = Router();

// ─── ID generators ───────────────────────────────────────────────
async function nextLoanId() {
  const last = await BorrowerLoan.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'LOAN-001';
  const num = parseInt(last.id.replace('LOAN-', ''), 10) + 1;
  return `LOAN-${String(num).padStart(3, '0')}`;
}

async function nextCollectionId() {
  const last = await BorrowerCollection.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'COL-001';
  const num = parseInt(last.id.replace('COL-', ''), 10) + 1;
  return `COL-${String(num).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════
// LOANS  (Lended / Approved Loans)
// ═══════════════════════════════════════════════════════════════════

// GET all loans
router.get('/loans', async (_req, res) => {
  try {
    const loans = await BorrowerLoan.find().sort({ createdAt: -1 }).lean();
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single loan
router.get('/loans/:id', async (req, res) => {
  try {
    const loan = await BorrowerLoan.findOne({ id: req.params.id }).lean();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Accept inquiry / proposal → Create loan
router.post('/loans', async (req, res) => {
  try {
    const id = await nextLoanId();
    const body = { ...req.body, id };
    if (!body.startDate) body.startDate = new Date();

    // Generate repayment schedule
    const annualRate = toAnnualRate(body.interestRate, body.interestRateType || 'yearly');
    body.repaymentSchedule = generateRepaymentSchedule(
      body.approvedAmount,
      annualRate,
      body.tenureMonths,
      body.repaymentType || 'Interest-Only',
      body.startDate
    );

    const loan = new BorrowerLoan(body);
    await loan.save(); // triggers pre-save auto-calc

    // If inquiryId provided, update inquiry stage to DISBURSED
    if (body.inquiryId) {
      await Inquiry.findOneAndUpdate(
        { id: body.inquiryId },
        {
          $set: { stage: 'DISBURSED', lastActivityAt: new Date(), lastActivity: 'Loan disbursed' },
          $push: { activityLogs: { action: 'Loan created & disbursed', newStage: 'DISBURSED', changedAt: new Date() } },
        }
      );
    }

    res.status(201).json(loan.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT — Update loan
router.put('/loans/:id', async (req, res) => {
  try {
    const loan = await BorrowerLoan.findOne({ id: req.params.id });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    Object.assign(loan, req.body);
    await loan.save();
    res.json(loan.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE loan
router.delete('/loans/:id', async (req, res) => {
  try {
    const result = await BorrowerLoan.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Loan not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// COLLECTIONS  (Repayments from borrowers)
// ═══════════════════════════════════════════════════════════════════

// GET all collections (optionally filter by loanId)
router.get('/collections', async (req, res) => {
  try {
    const filter = {};
    if (req.query.loanId) filter.loanId = req.query.loanId;
    const cols = await BorrowerCollection.find(filter).sort({ paymentDate: -1 }).lean();
    res.json(cols);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single collection
router.get('/collections/:id', async (req, res) => {
  try {
    const col = await BorrowerCollection.findOne({ id: req.params.id }).lean();
    if (!col) return res.status(404).json({ error: 'Collection not found' });
    res.json(col);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Record a collection / repayment
router.post('/collections', async (req, res) => {
  try {
    const id = await nextCollectionId();
    const body = { ...req.body, id };
    if (!body.paymentDate) body.paymentDate = new Date();

    const collection = new BorrowerCollection(body);
    await collection.save();

    // Update loan's repayment schedule if scheduleMonth is specified
    if (body.loanId && body.scheduleMonth) {
      const loan = await BorrowerLoan.findOne({ id: body.loanId });
      if (loan) {
        const entry = loan.repaymentSchedule.find(s => s.month === body.scheduleMonth);
        if (entry) {
          const totalCollected = (collection.interestPaid || 0) + (collection.principalPaid || 0);
          entry.status = totalCollected >= entry.totalDue ? 'Paid' : 'Partial';
        }
        await loan.save();
      }
    }

    res.status(201).json(collection.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT — Update collection (use findOne + save to trigger pre-save hooks)
router.put('/collections/:id', async (req, res) => {
  try {
    const col = await BorrowerCollection.findOne({ id: req.params.id });
    if (!col) return res.status(404).json({ error: 'Collection not found' });
    Object.assign(col, req.body);
    await col.save(); // triggers pre-save hook for totalPaid & overdueDays
    res.json(col.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE collection
router.delete('/collections/:id', async (req, res) => {
  try {
    const result = await BorrowerCollection.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Collection not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Upcoming Interest dues widget ──────────────────────────────
router.get('/upcoming-dues', async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const activeLoans = await BorrowerLoan.find({ status: 'Active' }).lean();
    const upcoming = [];

    for (const loan of activeLoans) {
      for (const entry of loan.repaymentSchedule) {
        const dueDate = new Date(entry.dueDate);
        if (entry.status === 'Pending' && dueDate <= thirtyDaysLater) {
          upcoming.push({
            loanId: loan.id,
            borrowerName: loan.borrowerName,
            month: entry.month,
            dueDate: entry.dueDate,
            totalDue: entry.totalDue,
            interestDue: entry.interestDue,
            principalDue: entry.principalDue,
            isOverdue: dueDate < now,
          });
        }
      }
    }

    upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
