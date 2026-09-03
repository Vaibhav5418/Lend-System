import { Router } from 'express';
import InvestorInvestment from '../models/InvestorInvestment.js';
import InvestorPayment from '../models/InvestorPayment.js';
import Inquiry from '../models/Inquiry.js';
import { toAnnualRate, calcMonthlyInterest } from '../utils/financialCalc.js';

const router = Router();

// ─── ID generators ───────────────────────────────────────────────
async function nextInvestmentId() {
  const last = await InvestorInvestment.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'INV-001';
  const num = parseInt(last.id.replace('INV-', ''), 10) + 1;
  return `INV-${String(num).padStart(3, '0')}`;
}

async function nextPaymentId() {
  const last = await InvestorPayment.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last) return 'IPAY-001';
  const num = parseInt(last.id.replace('IPAY-', ''), 10) + 1;
  return `IPAY-${String(num).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════
// INVESTMENTS  (Borrowed / Active Investments)
// ═══════════════════════════════════════════════════════════════════

// GET all investments
router.get('/investments', async (_req, res) => {
  try {
    const investments = await InvestorInvestment.find().sort({ createdAt: -1 }).lean();
    res.json(investments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single investment
router.get('/investments/:id', async (req, res) => {
  try {
    const inv = await InvestorInvestment.findOne({ id: req.params.id }).lean();
    if (!inv) return res.status(404).json({ error: 'Investment not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Accept inquiry → Create investment
router.post('/investments', async (req, res) => {
  try {
    const id = await nextInvestmentId();
    const body = { ...req.body, id };

    // Ensure startDate is present
    if (!body.startDate) body.startDate = new Date();

    const investment = new InvestorInvestment(body);
    await investment.save(); // triggers pre-save auto-calc

    // If inquiryId is provided, update inquiry stage to FUND_RECEIVED
    if (body.inquiryId) {
      await Inquiry.findOneAndUpdate(
        { id: body.inquiryId },
        {
          $set: { stage: 'FUND_RECEIVED', lastActivityAt: new Date(), lastActivity: 'Moved to Active Investment' },
          $push: { activityLogs: { action: 'Accepted as investment', newStage: 'FUND_RECEIVED', changedAt: new Date() } },
        }
      );
    }

    res.status(201).json(investment.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT — Update investment
router.put('/investments/:id', async (req, res) => {
  try {
    const inv = await InvestorInvestment.findOne({ id: req.params.id });
    if (!inv) return res.status(404).json({ error: 'Investment not found' });
    Object.assign(inv, req.body);
    await inv.save(); // re-triggers auto-calc
    res.json(inv.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE investment
router.delete('/investments/:id', async (req, res) => {
  try {
    const result = await InvestorInvestment.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Investment not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS  (Payouts to investors)
// ═══════════════════════════════════════════════════════════════════

// GET all payments (optionally filter by investmentId)
router.get('/payments', async (req, res) => {
  try {
    const filter = {};
    if (req.query.investmentId) filter.investmentId = req.query.investmentId;
    const payments = await InvestorPayment.find(filter).sort({ paymentDate: -1 }).lean();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single payment
router.get('/payments/:id', async (req, res) => {
  try {
    const payment = await InvestorPayment.findOne({ id: req.params.id }).lean();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Record a payout
router.post('/payments', async (req, res) => {
  try {
    const id = await nextPaymentId();
    const body = { ...req.body, id };
    if (!body.paymentDate) body.paymentDate = new Date();
    const payment = new InvestorPayment(body);
    await payment.save(); // triggers pre-save hook for amountPaid
    res.status(201).json(payment.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT — Update payment (use findOne + save to trigger pre-save hook for amountPaid)
router.put('/payments/:id', async (req, res) => {
  try {
    const payment = await InvestorPayment.findOne({ id: req.params.id });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    Object.assign(payment, req.body);
    await payment.save(); // triggers pre-save hook for amountPaid
    res.json(payment.toObject());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const result = await InvestorPayment.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ error: 'Payment not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Upcoming payouts widget ────────────────────────────────────
router.get('/upcoming-payouts', async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const activeInvestments = await InvestorInvestment.find({ status: 'Active' }).lean();

    const upcoming = [];
    for (const inv of activeInvestments) {
      const annualRate = toAnnualRate(inv.interestRate, inv.interestRateType);
      const monthlyPayout = calcMonthlyInterest(inv.investedAmount, annualRate);

      // Determine next payout date based on frequency
      const start = new Date(inv.startDate);
      const intervalMonths = inv.payoutFrequency === 'quarterly' ? 3 : inv.payoutFrequency === 'on_maturity' ? inv.tenureMonths : 1;

      // Guard against zero intervalMonths to prevent infinite loop
      if (intervalMonths <= 0) continue;

      let nextPayout = new Date(start);
      while (nextPayout <= now) {
        nextPayout.setMonth(nextPayout.getMonth() + intervalMonths);
      }

      if (nextPayout <= thirtyDaysLater) {
        const payoutAmount = inv.payoutFrequency === 'quarterly'
          ? monthlyPayout * 3
          : inv.payoutFrequency === 'on_maturity'
            ? inv.totalPayout
            : monthlyPayout;

        upcoming.push({
          investmentId: inv.id,
          investorName: inv.investorName,
          nextPayoutDate: nextPayout,
          payoutAmount: Math.round(payoutAmount * 100) / 100,
          frequency: inv.payoutFrequency,
          isMaturity: nextPayout.getTime() >= new Date(inv.maturityDate).getTime(),
        });
      }
    }

    upcoming.sort((a, b) => new Date(a.nextPayoutDate).getTime() - new Date(b.nextPayoutDate).getTime());
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
