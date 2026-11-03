import { Router } from 'express';
import { query } from '../db/index.js';
import BorrowerLoan, { mapRowToLoan } from '../models/BorrowerLoan.js';
import BorrowerCollection, { mapRowToCollection } from '../models/BorrowerCollection.js';
import Inquiry from '../models/Inquiry.js';
import { generateRepaymentSchedule, toAnnualRate } from '../utils/financialCalc.js';
import {
  isValidId,
  parseQueryId,
  ID_PATTERNS,
  sanitizeLog,
  parsePositiveNumber,
  parsePositiveInteger,
  sanitizeString,
} from '../utils/security.js';
import { cacheMiddleware, invalidateCache } from '../middleware/cacheMiddleware.js';

const router = Router();

const ALLOWED_LOAN_STATUSES = Object.freeze(['Active', 'Closed', 'Defaulted', 'Restructured']);
const ALLOWED_REPAYMENT_TYPES = Object.freeze(['Interest-Only', 'Bullet']);
const ALLOWED_RATE_TYPES = Object.freeze(['monthly', 'yearly']);
const ALLOWED_PAYMENT_MODES = Object.freeze(['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other']);
const ALLOWED_COLLECTION_STATUSES = Object.freeze(['Received', 'Pending', 'Overdue', 'Partial', 'Defaulted']);

// ─── ID generators ───────────────────────────────────────────────
async function nextLoanId() {
  try {
    const res = await query(
      `SELECT MAX(CAST(SUBSTRING(id FROM 6) AS INTEGER)) AS max_num FROM borrower_loans WHERE id ~ '^LOAN-[0-9]+$'`
    );
    const maxNum = res.rows[0]?.max_num;
    const nextNum = (typeof maxNum === 'number' && !Number.isNaN(maxNum)) ? maxNum + 1 : 1;
    return `LOAN-${String(nextNum).padStart(3, '0')}`;
  } catch {
    const last = await BorrowerLoan.findOne().sort({ _id: -1 }).select('id').lean();
    if (!last || typeof last.id !== 'string') return 'LOAN-001';
    const num = Number.parseInt(last.id.replace('LOAN-', ''), 10) + 1;
    return `LOAN-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
  }
}

async function nextCollectionId() {
  try {
    const res = await query(
      `SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) AS max_num FROM borrower_collections WHERE id ~ '^COL-[0-9]+$'`
    );
    const maxNum = res.rows[0]?.max_num;
    const nextNum = (typeof maxNum === 'number' && !Number.isNaN(maxNum)) ? maxNum + 1 : 1;
    return `COL-${String(nextNum).padStart(3, '0')}`;
  } catch {
    const last = await BorrowerCollection.findOne().sort({ _id: -1 }).select('id').lean();
    if (!last || typeof last.id !== 'string') return 'COL-001';
    const num = Number.parseInt(last.id.replace('COL-', ''), 10) + 1;
    return `COL-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// LOANS  (Lended / Approved Loans)
// ═══════════════════════════════════════════════════════════════════

// GET all loans (with server-side pagination, search, and pre-aggregated KPI summaries)
router.get('/loans', cacheMiddleware({ ttl: 60, tags: ['borrower', 'loans'] }), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || req.query.pageSize, 10) || (req.query.page || req.query.paginate === 'true' ? 25 : 50)));
    const isPaginatedRequest = Boolean(req.query.page || req.query.limit || req.query.pageSize || req.query.paginate === 'true' || req.query.search || req.query.status);

    const whereClauses = [];
    const params = [];

    if (req.query.status && req.query.status !== 'All' && ALLOWED_LOAN_STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const s = req.query.search.trim().slice(0, 100);
      if (s) {
        params.push(`%${s}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          borrower_name ILIKE $${pIdx} OR
          id ILIKE $${pIdx} OR
          company_name ILIKE $${pIdx}
        )`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    if (isPaginatedRequest) {
      const summarySql = `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'Active' THEN approved_amount ELSE 0 END), 0) AS deployed,
          COALESCE(SUM(CASE WHEN status = 'Active' THEN monthly_interest ELSE 0 END), 0) AS monthly_income,
          COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active,
          COUNT(CASE WHEN status = 'Defaulted' THEN 1 END) AS defaulted
        FROM borrower_loans;
      `;

      const offset = (page - 1) * limit;
      params.push(limit);
      const limitParam = params.length;
      params.push(offset);
      const offsetParam = params.length;

      const dataSql = `
        SELECT *, COUNT(*) OVER() as _full_count
        FROM borrower_loans
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam};
      `;

      const [summaryRes, dataRes] = await Promise.all([
        query(summarySql),
        query(dataSql, params),
      ]);

      const sRow = summaryRes.rows[0] || {};
      const summary = {
        deployed: Number(sRow.deployed || 0),
        monthlyIncome: Number(sRow.monthly_income || 0),
        active: Number(sRow.active || 0),
        defaulted: Number(sRow.defaulted || 0),
      };

      const total = dataRes.rows.length > 0 ? Number.parseInt(dataRes.rows[0]._full_count, 10) : 0;
      const data = dataRes.rows.map(mapRowToLoan);

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        summary,
      });
    }

    const loans = await BorrowerLoan.find().sort({ createdAt: -1 }).lean();
    res.json(loans);
  } catch (err) {
    console.error('Fetch loans error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch loans' });
  }
});

// GET single loan
router.get(
  '/loans/:id',
  cacheMiddleware({ ttl: 300, tags: ['borrower'], keyGenerator: (req) => `api:/borrower/loans:${req.params.id}` }),
  async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.loan)) {
      return res.status(400).json({ error: 'Invalid loan ID format' });
    }
    const loan = await BorrowerLoan.findOne({ id }).lean();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    console.error('Fetch loan error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch loan' });
  }
});

// POST — Accept inquiry / proposal → Create loan
router.post('/loans', async (req, res) => {
  try {
    const {
      inquiryId,
      borrowerName,
      approvedAmount,
      interestRate,
      interestRateType,
      tenureMonths,
      repaymentType,
      startDate,
      companyName,
      mobile,
      email,
      loanPurpose,
      notes,
      status,
      investorMapping,
    } = req.body;

    // Strict validation
    if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Valid inquiryId (e.g. INQ-001) is required' });
    }
    const cleanBorrowerName = sanitizeString(borrowerName, 200);
    if (!cleanBorrowerName) {
      return res.status(400).json({ error: 'borrowerName is required' });
    }

    const cleanApprovedAmount = parsePositiveNumber(approvedAmount);
    if (!cleanApprovedAmount) {
      return res.status(400).json({ error: 'Valid positive approvedAmount is required' });
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

    const cleanRepaymentType = ALLOWED_REPAYMENT_TYPES.includes(repaymentType) ? repaymentType : 'Interest-Only';
    const cleanStartDate = startDate && !Number.isNaN(new Date(startDate).getTime())
      ? new Date(startDate)
      : new Date();

    const cleanStatus = ALLOWED_LOAN_STATUSES.includes(status) ? status : 'Active';

    // Safe investor mapping array
    const safeInvestorMapping = [];
    if (Array.isArray(investorMapping)) {
      for (const m of investorMapping) {
        if (m && isValidId(m.investmentId, ID_PATTERNS.investment)) {
          const alloc = parsePositiveNumber(m.allocatedAmount, true);
          if (alloc !== null) {
            safeInvestorMapping.push({ investmentId: m.investmentId.trim(), allocatedAmount: alloc });
          }
        }
      }
    }

    let loan;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextLoanId();

      // Server-generated repayment schedule
      const annualRate = toAnnualRate(cleanInterestRate, cleanRateType);
      const repaymentSchedule = generateRepaymentSchedule(
        cleanApprovedAmount,
        annualRate,
        cleanTenureMonths,
        cleanRepaymentType,
        cleanStartDate
      );

      // Construct strictly allowlisted loan document
      const loanData = {
        id,
        inquiryId: inquiryId.trim(),
        borrowerName: cleanBorrowerName,
        companyName: sanitizeString(companyName, 200),
        mobile: sanitizeString(mobile, 50),
        email: sanitizeString(email, 100),
        approvedAmount: cleanApprovedAmount,
        interestRate: cleanInterestRate,
        interestRateType: cleanRateType,
        tenureMonths: cleanTenureMonths,
        repaymentType: cleanRepaymentType,
        startDate: cleanStartDate,
        repaymentSchedule,
        investorMapping: safeInvestorMapping,
        loanPurpose: sanitizeString(loanPurpose, 500),
        notes: sanitizeString(notes, 2000),
        status: cleanStatus,
      };

      loan = new BorrowerLoan(loanData);
      try {
        await loan.save(); // triggers pre-save auto-calc for monthlyInterest, totalInterest, totalRepayable
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }

    // Update inquiry stage to DISBURSED
    await Inquiry.findOneAndUpdate(
      { id: loanData.inquiryId },
      {
        $set: { stage: 'DISBURSED', lastActivityAt: new Date(), lastActivity: 'Loan disbursed' },
        $push: { activityLogs: { action: 'Loan created & disbursed', newStage: 'DISBURSED', changedAt: new Date() } },
      }
    );

    await invalidateCache(['borrower', 'loans', 'profit', 'dashboard', 'inquiries']);
    res.status(201).json(loan.toObject());
  } catch (err) {
    console.error('Create loan error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to create loan' });
  }
});

// PUT — Update loan
router.put('/loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.loan)) {
      return res.status(400).json({ error: 'Invalid loan ID format' });
    }

    const loan = await BorrowerLoan.findOne({ id });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    // Explicit allowlist assignment
    if (req.body.borrowerName !== undefined) {
      const bName = sanitizeString(req.body.borrowerName, 200);
      if (bName) loan.borrowerName = bName;
    }
    if (req.body.companyName !== undefined) loan.companyName = sanitizeString(req.body.companyName, 200);
    if (req.body.mobile !== undefined) loan.mobile = sanitizeString(req.body.mobile, 50);
    if (req.body.email !== undefined) loan.email = sanitizeString(req.body.email, 100);
    if (req.body.loanPurpose !== undefined) loan.loanPurpose = sanitizeString(req.body.loanPurpose, 500);
    if (req.body.notes !== undefined) loan.notes = sanitizeString(req.body.notes, 2000);
    if (req.body.status !== undefined && ALLOWED_LOAN_STATUSES.includes(req.body.status)) {
      loan.status = req.body.status;
    }

    // Check financial terms for schedule recalculation
    let termsChanged = false;
    if (req.body.approvedAmount !== undefined) {
      const amt = parsePositiveNumber(req.body.approvedAmount);
      if (amt) {
        loan.approvedAmount = amt;
        termsChanged = true;
      }
    }
    if (req.body.interestRate !== undefined) {
      const rate = parsePositiveNumber(req.body.interestRate);
      if (rate) {
        loan.interestRate = rate;
        termsChanged = true;
      }
    }
    if (req.body.interestRateType !== undefined && ALLOWED_RATE_TYPES.includes(req.body.interestRateType)) {
      loan.interestRateType = req.body.interestRateType;
      termsChanged = true;
    }
    if (req.body.tenureMonths !== undefined) {
      const tenure = parsePositiveInteger(req.body.tenureMonths);
      if (tenure) {
        loan.tenureMonths = tenure;
        termsChanged = true;
      }
    }
    if (req.body.repaymentType !== undefined && ALLOWED_REPAYMENT_TYPES.includes(req.body.repaymentType)) {
      loan.repaymentType = req.body.repaymentType;
      termsChanged = true;
    }
    if (req.body.startDate !== undefined && !Number.isNaN(new Date(req.body.startDate).getTime())) {
      loan.startDate = new Date(req.body.startDate);
      termsChanged = true;
    }

    if (Array.isArray(req.body.investorMapping)) {
      const safeMapping = [];
      for (const m of req.body.investorMapping) {
        if (m && isValidId(m.investmentId, ID_PATTERNS.investment)) {
          const alloc = parsePositiveNumber(m.allocatedAmount, true);
          if (alloc !== null) safeMapping.push({ investmentId: m.investmentId.trim(), allocatedAmount: alloc });
        }
      }
      loan.investorMapping = safeMapping;
    }

    if (termsChanged) {
      const annualRate = toAnnualRate(loan.interestRate, loan.interestRateType);
      loan.repaymentSchedule = generateRepaymentSchedule(
        loan.approvedAmount,
        annualRate,
        loan.tenureMonths,
        loan.repaymentType,
        loan.startDate
      );
    }

    await loan.save(); // triggers pre-save hook for auto-calc
    await invalidateCache(['borrower', 'loans', 'profit', 'dashboard', 'inquiries']);
    res.json(loan.toObject());
  } catch (err) {
    console.error('Update loan error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update loan' });
  }
});

// DELETE loan
router.delete('/loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.loan)) {
      return res.status(400).json({ error: 'Invalid loan ID format' });
    }
    const result = await BorrowerLoan.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Loan not found' });
    await invalidateCache(['borrower', 'loans', 'profit', 'dashboard', 'inquiries']);
    res.status(204).send();
  } catch (err) {
    console.error('Delete loan error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete loan' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// COLLECTIONS  (Repayments from borrowers)
// ═══════════════════════════════════════════════════════════════════

// GET all collections (with server-side pagination, search, and pre-aggregated summaries)
router.get('/collections', cacheMiddleware({ ttl: 60, tags: ['borrower', 'collections'] }), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || req.query.pageSize, 10) || (req.query.page || req.query.paginate === 'true' ? 25 : 50)));
    const isPaginatedRequest = Boolean(req.query.page || req.query.limit || req.query.pageSize || req.query.paginate === 'true' || req.query.search || req.query.status || req.query.loanId);

    const whereClauses = [];
    const params = [];

    if (req.query.loanId !== undefined) {
      const parsedLoanId = parseQueryId(req.query.loanId, ID_PATTERNS.loan, 'loanId');
      if (!parsedLoanId.valid) {
        return res.status(400).json({ error: parsedLoanId.error });
      }
      if (parsedLoanId.value) {
        params.push(parsedLoanId.value);
        whereClauses.push(`loan_id = $${params.length}`);
      }
    }

    if (req.query.status && req.query.status !== 'All' && ALLOWED_COLLECTION_STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const s = req.query.search.trim().slice(0, 100);
      if (s) {
        params.push(`%${s}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          borrower_name ILIKE $${pIdx} OR
          loan_id ILIKE $${pIdx} OR
          id ILIKE $${pIdx}
        )`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    if (isPaginatedRequest) {
      const summarySql = `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'Received' THEN total_paid ELSE 0 END), 0) AS total_collected,
          COALESCE(SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN pending_amount ELSE 0 END), 0) AS total_pending,
          COUNT(CASE WHEN status IN ('Overdue', 'Defaulted') THEN 1 END) AS overdue_count,
          COALESCE(SUM(penalty), 0) AS total_penalties
        FROM borrower_collections;
      `;

      const offset = (page - 1) * limit;
      params.push(limit);
      const limitParam = params.length;
      params.push(offset);
      const offsetParam = params.length;

      const dataSql = `
        SELECT *, COUNT(*) OVER() as _full_count
        FROM borrower_collections
        ${whereSql}
        ORDER BY payment_date DESC
        LIMIT $${limitParam} OFFSET $${offsetParam};
      `;

      const [summaryRes, dataRes] = await Promise.all([
        query(summarySql),
        query(dataSql, params),
      ]);

      const sRow = summaryRes.rows[0] || {};
      const summary = {
        totalCollected: Number(sRow.total_collected || 0),
        totalPending: Number(sRow.total_pending || 0),
        overdueCount: Number(sRow.overdue_count || 0),
        totalPenalties: Number(sRow.total_penalties || 0),
      };

      const total = dataRes.rows.length > 0 ? Number.parseInt(dataRes.rows[0]._full_count, 10) : 0;
      const data = dataRes.rows.map(mapRowToCollection);

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        summary,
      });
    }

    const filter = {};
    if (req.query.loanId) filter.loanId = req.query.loanId;
    const cols = await BorrowerCollection.find(filter).sort({ paymentDate: -1 }).lean();
    res.json(cols);
  } catch (err) {
    console.error('Fetch collections error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch collections' });
  }
});

// GET single collection
router.get(
  '/collections/:id',
  cacheMiddleware({ ttl: 300, tags: ['borrower'], keyGenerator: (req) => `api:/borrower/collections:${req.params.id}` }),
  async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.collection)) {
      return res.status(400).json({ error: 'Invalid collection ID format' });
    }
    const col = await BorrowerCollection.findOne({ id }).lean();
    if (!col) return res.status(404).json({ error: 'Collection not found' });
    res.json(col);
  } catch (err) {
    console.error('Fetch collection error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch collection' });
  }
});

// POST — Record a collection / repayment
router.post('/collections', async (req, res) => {
  try {
    const {
      loanId,
      borrowerName,
      paymentDate,
      dueDate,
      scheduleMonth,
      interestPaid,
      principalPaid,
      pendingAmount,
      penalty,
      paymentMode,
      status,
      remarks,
    } = req.body;

    if (!isValidId(loanId, ID_PATTERNS.loan)) {
      return res.status(400).json({ error: 'Valid loanId (e.g. LOAN-001) is required' });
    }

    const cleanPaymentDate = paymentDate && !Number.isNaN(new Date(paymentDate).getTime())
      ? new Date(paymentDate)
      : new Date();
    const cleanDueDate = dueDate && !Number.isNaN(new Date(dueDate).getTime())
      ? new Date(dueDate)
      : undefined;

    const cleanScheduleMonth = parsePositiveInteger(scheduleMonth);
    const cleanInterestPaid = parsePositiveNumber(interestPaid, true) ?? 0;
    const cleanPrincipalPaid = parsePositiveNumber(principalPaid, true) ?? 0;
    const cleanPendingAmount = parsePositiveNumber(pendingAmount, true) ?? 0;
    const cleanPenalty = parsePositiveNumber(penalty, true) ?? 0;
    const cleanPaymentMode = ALLOWED_PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Bank Transfer';
    const cleanStatus = ALLOWED_COLLECTION_STATUSES.includes(status) ? status : 'Pending';

    let collection;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextCollectionId();

      const collectionData = {
        id,
        loanId: loanId.trim(),
        borrowerName: sanitizeString(borrowerName, 200),
        paymentDate: cleanPaymentDate,
        ...(cleanDueDate ? { dueDate: cleanDueDate } : {}),
        ...(cleanScheduleMonth !== null ? { scheduleMonth: cleanScheduleMonth } : {}),
        interestPaid: cleanInterestPaid,
        principalPaid: cleanPrincipalPaid,
        pendingAmount: cleanPendingAmount,
        penalty: cleanPenalty,
        paymentMode: cleanPaymentMode,
        status: cleanStatus,
        remarks: sanitizeString(remarks, 1000),
      };

      collection = new BorrowerCollection(collectionData);
      try {
        await collection.save(); // triggers pre-save hook for totalPaid & overdueDays
        break;
      } catch (saveErr) {
        if (saveErr && saveErr.code === 11000 && attempt < 4) {
          continue;
        }
        throw saveErr;
      }
    }

    // Update loan's repayment schedule if scheduleMonth is specified
    if (cleanScheduleMonth !== null) {
      const loan = await BorrowerLoan.findOne({ id: collectionData.loanId });
      if (loan) {
        const entry = loan.repaymentSchedule.find((s) => s.month === cleanScheduleMonth);
        if (entry) {
          const totalCollected = collection.interestPaid + collection.principalPaid;
          entry.status = totalCollected >= entry.totalDue ? 'Paid' : 'Partial';
          await loan.save();
        }
      }
    }

    await invalidateCache(['borrower', 'collections', 'profit']);
    res.status(201).json(collection.toObject());
  } catch (err) {
    console.error('Create collection error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to record collection' });
  }
});

// PUT — Update collection
router.put('/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.collection)) {
      return res.status(400).json({ error: 'Invalid collection ID format' });
    }

    const col = await BorrowerCollection.findOne({ id });
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    if (req.body.borrowerName !== undefined) col.borrowerName = sanitizeString(req.body.borrowerName, 200);
    if (req.body.paymentDate !== undefined && !Number.isNaN(new Date(req.body.paymentDate).getTime())) {
      col.paymentDate = new Date(req.body.paymentDate);
    }
    if (req.body.dueDate !== undefined && !Number.isNaN(new Date(req.body.dueDate).getTime())) {
      col.dueDate = new Date(req.body.dueDate);
    }
    if (req.body.scheduleMonth !== undefined) {
      const m = parsePositiveInteger(req.body.scheduleMonth);
      if (m !== null) col.scheduleMonth = m;
    }
    if (req.body.interestPaid !== undefined) {
      const ip = parsePositiveNumber(req.body.interestPaid, true);
      if (ip !== null) col.interestPaid = ip;
    }
    if (req.body.principalPaid !== undefined) {
      const pp = parsePositiveNumber(req.body.principalPaid, true);
      if (pp !== null) col.principalPaid = pp;
    }
    if (req.body.pendingAmount !== undefined) {
      const pa = parsePositiveNumber(req.body.pendingAmount, true);
      if (pa !== null) col.pendingAmount = pa;
    }
    if (req.body.penalty !== undefined) {
      const pen = parsePositiveNumber(req.body.penalty, true);
      if (pen !== null) col.penalty = pen;
    }
    if (req.body.paymentMode !== undefined && ALLOWED_PAYMENT_MODES.includes(req.body.paymentMode)) {
      col.paymentMode = req.body.paymentMode;
    }
    if (req.body.status !== undefined && ALLOWED_COLLECTION_STATUSES.includes(req.body.status)) {
      col.status = req.body.status;
    }
    if (req.body.remarks !== undefined) col.remarks = sanitizeString(req.body.remarks, 1000);

    await col.save(); // triggers pre-save hook for totalPaid & overdueDays
    await invalidateCache(['borrower', 'collections', 'profit']);
    res.json(col.toObject());
  } catch (err) {
    console.error('Update collection error:', sanitizeLog(err));
    res.status(400).json({ error: 'Unable to update collection' });
  }
});

// DELETE collection
router.delete('/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.collection)) {
      return res.status(400).json({ error: 'Invalid collection ID format' });
    }
    const result = await BorrowerCollection.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ error: 'Collection not found' });
    await invalidateCache(['borrower', 'collections', 'profit']);
    res.status(204).send();
  } catch (err) {
    console.error('Delete collection error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete collection' });
  }
});

// ─── Upcoming Interest dues widget (Optimized JSONB extraction) ────
router.get('/upcoming-dues', cacheMiddleware({ ttl: 120, tags: ['borrower', 'loans', 'collections'] }), async (_req, res) => {
  try {
    const sql = `
      SELECT
        id AS "loanId",
        borrower_name AS "borrowerName",
        (entry->>'month')::int AS "month",
        entry->>'dueDate' AS "dueDate",
        (entry->>'totalDue')::numeric AS "totalDue",
        (entry->>'interestDue')::numeric AS "interestDue",
        (entry->>'principalDue')::numeric AS "principalDue",
        ((entry->>'dueDate')::timestamptz < NOW()) AS "isOverdue"
      FROM borrower_loans,
      jsonb_array_elements(repayment_schedule) AS entry
      WHERE status = 'Active'
        AND entry->>'status' = 'Pending'
        AND (entry->>'dueDate')::timestamptz <= (NOW() + interval '30 days')
      ORDER BY (entry->>'dueDate')::timestamptz ASC
      LIMIT 100;
    `;
    const result = await query(sql);
    const upcoming = result.rows.map(r => ({
      loanId: r.loanId,
      borrowerName: r.borrowerName,
      month: r.month,
      dueDate: r.dueDate,
      totalDue: Number(r.totalDue || 0),
      interestDue: Number(r.interestDue || 0),
      principalDue: Number(r.principalDue || 0),
      isOverdue: Boolean(r.isOverdue),
    }));
    res.json(upcoming);
  } catch (err) {
    console.error('Fetch upcoming dues error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch upcoming dues' });
  }
});

export default router;
