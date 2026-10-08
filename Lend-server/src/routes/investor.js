import { Router } from 'express';
import InvestorInvestment from '../models/InvestorInvestment.js';
import InvestorPayment from '../models/InvestorPayment.js';
import Inquiry from '../models/Inquiry.js';
import { toAnnualRate, calcMonthlyInterest } from '../utils/financialCalc.js';
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

const ALLOWED_INVESTMENT_STATUSES = Object.freeze(['Active', 'Matured', 'Closed', 'Withdrawn']);
const ALLOWED_RATE_TYPES = Object.freeze(['monthly', 'yearly']);
const ALLOWED_PAYOUT_FREQUENCIES = Object.freeze(['monthly', 'quarterly', 'on_maturity']);
const ALLOWED_INVESTMENT_PLANS = Object.freeze(['1', '3', '6', '12', 'custom']);
const ALLOWED_PAYMENT_STATUSES = Object.freeze(['Paid', 'Pending', 'Overdue', 'Partial']);
const ALLOWED_PAYMENT_MODES = Object.freeze(['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other']);

// ─── ID generators ───────────────────────────────────────────────
async function nextInvestmentId() {
  const last = await InvestorInvestment.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last || typeof last.id !== 'string') return 'INV-001';
  const num = Number.parseInt(last.id.replace('INV-', ''), 10) + 1;
  return `INV-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
}

async function nextPaymentId() {
  const last = await InvestorPayment.findOne().sort({ _id: -1 }).select('id').lean();
  if (!last || typeof last.id !== 'string') return 'IPAY-001';
  const num = Number.parseInt(last.id.replace('IPAY-', ''), 10) + 1;
  return `IPAY-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
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
    console.error('Fetch investments error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch investments' });
  }
});

// GET single investment
router.get('/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.investment)) {
      return res.status(400).json({ error: 'Invalid investment ID format' });
    }
    const inv = await InvestorInvestment.findOne({ id }).lean();
    if (!inv) return res.status(404).json({ error: 'Investment not found' });
    res.json(inv);
  } catch (err) {
    console.error('Fetch investment error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch investment' });
  }
});

// POST — Accept inquiry → Create investment
router.post('/investments', async (req, res) => {
  try {
    const {
      inquiryId,
      investorName,
      investedAmount,
      interestRate,
      interestRateType,
      tenureMonths,
      investmentPlan,
      payoutFrequency,
      startDate,
      mobile,
      email,
      notes,
      linkedBorrowers,
      status,
    } = req.body;

    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Valid inquiryId (e.g. INQ-001) is required' });
    }

    const cleanInvestorName = sanitizeString(investorName, 200);
    if (!cleanInvestorName) {
      return res.status(400).json({ error: 'investorName is required' });
    }

    const cleanInvestedAmount = parsePositiveNumber(investedAmount);
    if (!cleanInvestedAmount) {
      return res.status(400).json({ error: 'Valid positive investedAmount is required' });
    }

    const cleanInterestRate = parsePositiveNumber(interestRate);
    if (!cleanInterestRate) {
      return res.status(400).json({ error: 'Valid positive interestRate is required' });
    }

    const cleanRateType = ALLOWED_RATE_TYPES.includes(interestRateType) ? interestRateType : 'yearly';
    const cleanTenureMonths = parsePositiveInteger(tenureMonths);
    if (!cleanTenureMonths) {
      return res.status(400).json({ error: 'Valid positive tenureMonths is required' });
    }

    const cleanPlan = ALLOWED_INVESTMENT_PLANS.includes(investmentPlan) ? investmentPlan : 'custom';
    const cleanPayoutFrequency = ALLOWED_PAYOUT_FREQUENCIES.includes(payoutFrequency) ? payoutFrequency : 'monthly';
    const cleanStartDate = startDate && !Number.isNaN(new Date(startDate).getTime())
      ? new Date(startDate)
      : new Date();

    const cleanStatus = ALLOWED_INVESTMENT_STATUSES.includes(status) ? status : 'Active';

    const safeLinkedBorrowers = [];
    if (Array.isArray(linkedBorrowers)) {
      for (const b of linkedBorrowers) {
        if (b && isValidId(b.loanId, ID_PATTERNS.loan)) {
          const alloc = parsePositiveNumber(b.allocatedAmount, true);
          if (alloc !== null) {
            safeLinkedBorrowers.push({ loanId: b.loanId.trim(), allocatedAmount: alloc });
          }
        }
      }
    }

    let investment;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextInvestmentId();
      const investmentData = {
        id,
        inquiryId: inquiryId.trim(),
        investorName: cleanInvestorName,
        mobile: sanitizeString(mobile, 50),
        email: sanitizeString(email, 100),
        investedAmount: cleanInvestedAmount,
        interestRate: cleanInterestRate,
        interestRateType: cleanRateType,
        tenureMonths: cleanTenureMonths,
        investmentPlan: cleanPlan,
        payoutFrequency: cleanPayoutFrequency,
        startDate: cleanStartDate,
        notes: sanitizeString(notes, 2000),
        linkedBorrowers: safeLinkedBorrowers,
        status: cleanStatus,
      };

      investment = new InvestorInvestment(investmentData);
      try {
        await investment.save(); // triggers pre-save auto-calc for monthlyInterest, totalInterest, totalPayout, maturityDate
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }

    // Update inquiry stage to FUND_RECEIVED
    await Inquiry.findOneAndUpdate(
      { id: investmentData.inquiryId },
      {
        $set: { stage: 'FUND_RECEIVED', lastActivityAt: new Date(), lastActivity: 'Moved to Active Investment' },
        $push: { activityLogs: { action: 'Accepted as investment', newStage: 'FUND_RECEIVED', changedAt: new Date() } },
      }
    );

    res.status(201).json(investment.toObject());
  } catch (err) {
    console.error('Create investment error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to create investment' });
  }
});

// PUT — Update investment
router.put('/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.investment)) {
      return res.status(400).json({ error: 'Invalid investment ID format' });
    }

    const inv = await InvestorInvestment.findOne({ id });
    if (!inv) return res.status(404).json({ error: 'Investment not found' });

    if (req.body.investorName !== undefined) {
      const name = sanitizeString(req.body.investorName, 200);
      if (name) inv.investorName = name;
    }
    if (req.body.mobile !== undefined) inv.mobile = sanitizeString(req.body.mobile, 50);
    if (req.body.email !== undefined) inv.email = sanitizeString(req.body.email, 100);
    if (req.body.notes !== undefined) inv.notes = sanitizeString(req.body.notes, 2000);
    if (req.body.status !== undefined && ALLOWED_INVESTMENT_STATUSES.includes(req.body.status)) {
      inv.status = req.body.status;
    }
    if (req.body.investmentPlan !== undefined && ALLOWED_INVESTMENT_PLANS.includes(req.body.investmentPlan)) {
      inv.investmentPlan = req.body.investmentPlan;
    }
    if (req.body.payoutFrequency !== undefined && ALLOWED_PAYOUT_FREQUENCIES.includes(req.body.payoutFrequency)) {
      inv.payoutFrequency = req.body.payoutFrequency;
    }

    if (req.body.investedAmount !== undefined) {
      const amt = parsePositiveNumber(req.body.investedAmount);
      if (amt) inv.investedAmount = amt;
    }
    if (req.body.interestRate !== undefined) {
      const rate = parsePositiveNumber(req.body.interestRate);
      if (rate) inv.interestRate = rate;
    }
    if (req.body.interestRateType !== undefined && ALLOWED_RATE_TYPES.includes(req.body.interestRateType)) {
      inv.interestRateType = req.body.interestRateType;
    }
    if (req.body.tenureMonths !== undefined) {
      const tenure = parsePositiveInteger(req.body.tenureMonths);
      if (tenure) inv.tenureMonths = tenure;
    }
    if (req.body.startDate !== undefined && !Number.isNaN(new Date(req.body.startDate).getTime())) {
      inv.startDate = new Date(req.body.startDate);
    }

    if (Array.isArray(req.body.linkedBorrowers)) {
      const safeBorrowers = [];
      for (const b of req.body.linkedBorrowers) {
        if (b && isValidId(b.loanId, ID_PATTERNS.loan)) {
          const alloc = parsePositiveNumber(b.allocatedAmount, true);
          if (alloc !== null) safeBorrowers.push({ loanId: b.loanId.trim(), allocatedAmount: alloc });
        }
      }
      inv.linkedBorrowers = safeBorrowers;
    }

    await inv.save(); // re-triggers auto-calc
    res.json(inv.toObject());
  } catch (err) {
    console.error('Update investment error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update investment' });
  }
});

// DELETE investment
router.delete('/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.investment)) {
      return res.status(400).json({ error: 'Invalid investment ID format' });
    }
    const result = await InvestorInvestment.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Investment not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete investment error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete investment' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS  (Payouts to investors)
// ═══════════════════════════════════════════════════════════════════

// GET all payments (optionally filter by investmentId)
router.get('/payments', async (req, res) => {
  try {
    const filter = {};
    if (req.query.investmentId !== undefined) {
      const parsedInvId = parseQueryId(req.query.investmentId, ID_PATTERNS.investment, 'investmentId');
      if (!parsedInvId.valid) {
        return res.status(400).json({ error: parsedInvId.error });
      }
      if (parsedInvId.value) {
        filter.investmentId = parsedInvId.value;
      }
    }
    const payments = await InvestorPayment.find(filter).sort({ paymentDate: -1 }).lean();
    res.json(payments);
  } catch (err) {
    console.error('Fetch payments error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch payments' });
  }
});

// GET single payment
router.get('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.payment)) {
      return res.status(400).json({ error: 'Invalid payment ID format' });
    }
    const payment = await InvestorPayment.findOne({ id }).lean();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    console.error('Fetch payment error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch payment' });
  }
});

// POST — Record a payout
router.post('/payments', async (req, res) => {
  try {
    const {
      investmentId,
      investorName,
      paymentDate,
      dueDate,
      interestPaid,
      principalPaid,
      pendingInterest,
      paymentFrequency,
      paymentMode,
      status,
      remarks,
    } = req.body;

    if (!isValidId(investmentId, ID_PATTERNS.investment)) {
      return res.status(400).json({ error: 'Valid investmentId (e.g. INV-001) is required' });
    }

    const cleanPaymentDate = paymentDate && !Number.isNaN(new Date(paymentDate).getTime())
      ? new Date(paymentDate)
      : new Date();
    const cleanDueDate = dueDate && !Number.isNaN(new Date(dueDate).getTime())
      ? new Date(dueDate)
      : undefined;

    const cleanInterestPaid = parsePositiveNumber(interestPaid, true) ?? 0;
    const cleanPrincipalPaid = parsePositiveNumber(principalPaid, true) ?? 0;
    const cleanPendingInterest = parsePositiveNumber(pendingInterest, true) ?? 0;
    const cleanPaymentFrequency = ALLOWED_PAYOUT_FREQUENCIES.includes(paymentFrequency) ? paymentFrequency : 'monthly';
    const cleanPaymentMode = ALLOWED_PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Bank Transfer';
    const cleanStatus = ALLOWED_PAYMENT_STATUSES.includes(status) ? status : 'Pending';

    let payment;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextPaymentId();
      const paymentData = {
        id,
        investmentId: investmentId.trim(),
        investorName: sanitizeString(investorName, 200),
        paymentDate: cleanPaymentDate,
        ...(cleanDueDate ? { dueDate: cleanDueDate } : {}),
        interestPaid: cleanInterestPaid,
        principalPaid: cleanPrincipalPaid,
        pendingInterest: cleanPendingInterest,
        paymentFrequency: cleanPaymentFrequency,
        paymentMode: cleanPaymentMode,
        status: cleanStatus,
        remarks: sanitizeString(remarks, 1000),
      };

      payment = new InvestorPayment(paymentData);
      try {
        await payment.save(); // triggers pre-save hook for amountPaid
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }
    res.status(201).json(payment.toObject());
  } catch (err) {
    console.error('Create payment error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to record payment' });
  }
});

// PUT — Update payment
router.put('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.payment)) {
      return res.status(400).json({ error: 'Invalid payment ID format' });
    }

    const payment = await InvestorPayment.findOne({ id });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (req.body.investorName !== undefined) payment.investorName = sanitizeString(req.body.investorName, 200);
    if (req.body.paymentDate !== undefined && !Number.isNaN(new Date(req.body.paymentDate).getTime())) {
      payment.paymentDate = new Date(req.body.paymentDate);
    }
    if (req.body.dueDate !== undefined && !Number.isNaN(new Date(req.body.dueDate).getTime())) {
      payment.dueDate = new Date(req.body.dueDate);
    }
    if (req.body.interestPaid !== undefined) {
      const ip = parsePositiveNumber(req.body.interestPaid, true);
      if (ip !== null) payment.interestPaid = ip;
    }
    if (req.body.principalPaid !== undefined) {
      const pp = parsePositiveNumber(req.body.principalPaid, true);
      if (pp !== null) payment.principalPaid = pp;
    }
    if (req.body.pendingInterest !== undefined) {
      const pi = parsePositiveNumber(req.body.pendingInterest, true);
      if (pi !== null) payment.pendingInterest = pi;
    }
    if (req.body.paymentFrequency !== undefined && ALLOWED_PAYOUT_FREQUENCIES.includes(req.body.paymentFrequency)) {
      payment.paymentFrequency = req.body.paymentFrequency;
    }
    if (req.body.paymentMode !== undefined && ALLOWED_PAYMENT_MODES.includes(req.body.paymentMode)) {
      payment.paymentMode = req.body.paymentMode;
    }
    if (req.body.status !== undefined && ALLOWED_PAYMENT_STATUSES.includes(req.body.status)) {
      payment.status = req.body.status;
    }
    if (req.body.remarks !== undefined) payment.remarks = sanitizeString(req.body.remarks, 1000);

    await payment.save(); // triggers pre-save hook for amountPaid
    res.json(payment.toObject());
  } catch (err) {
    console.error('Update payment error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update payment' });
  }
});

// DELETE payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.payment)) {
      return res.status(400).json({ error: 'Invalid payment ID format' });
    }
    const result = await InvestorPayment.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Payment not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete payment error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete payment' });
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
      if (Number.isNaN(start.getTime())) continue;

      const rawInterval = inv.payoutFrequency === 'quarterly'
        ? 3
        : inv.payoutFrequency === 'on_maturity'
          ? inv.tenureMonths
          : 1;
      const intervalMonths = Number.isInteger(rawInterval) && rawInterval > 0 ? rawInterval : 1;

      let nextPayout = new Date(start.getTime());
      const nowTime = now.getTime();
      while (nextPayout.getTime() <= nowTime) {
        const advanced = new Date(nextPayout.getTime());
        advanced.setMonth(advanced.getMonth() + intervalMonths);
        // Guard against non-advancing dates to prevent infinite loops
        if (advanced.getTime() <= nextPayout.getTime()) {
          break;
        }
        nextPayout = advanced;
      }

      if (nextPayout.getTime() <= thirtyDaysLater.getTime()) {
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
    console.error('Fetch upcoming payouts error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch upcoming payouts' });
  }
});

export default router;
