import { Router } from 'express';
import { isDbConnected, query } from '../db/index.js';
import Inquiry, { mapRowToInquiry } from '../models/Inquiry.js';
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
import { cacheMiddleware, invalidateCache } from '../middleware/cacheMiddleware.js';

const router = Router();

const ALLOWED_INQUIRY_TYPES = Object.freeze(['Borrower', 'Investor']);
const ALLOWED_SOURCES = Object.freeze(['Website', 'Referral', 'Walk-in', 'Social Media', 'Agent', 'Existing Client']);
const ALLOWED_PRIORITIES = Object.freeze(['Hot', 'Warm', 'Cold']);
const ALLOWED_FREQUENCIES = Object.freeze(['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly']);

async function getNextInquiryId() {
  try {
    const res = await query(
      `SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) AS max_num FROM inquiries WHERE id ~ '^INQ-[0-9]+$'`
    );
    const maxNum = res.rows[0]?.max_num;
    const nextNum = (typeof maxNum === 'number' && !Number.isNaN(maxNum)) ? maxNum + 1 : 1;
    return `INQ-${String(nextNum).padStart(3, '0')}`;
  } catch {
    const last = await Inquiry.findOne().sort({ _id: -1 }).select('id').lean();
    if (!last || typeof last.id !== 'string') return 'INQ-001';
    const num = Number.parseInt(last.id.replace('INQ-', ''), 10) + 1;
    return `INQ-${String(Number.isNaN(num) ? 1 : num).padStart(3, '0')}`;
  }
}

// ─── Dashboard Analytics & Aggregations (Sub-10ms SQL) ────────
router.get('/dashboard-stats', cacheMiddleware({ ttl: 60, tags: ['dashboard', 'inquiries'] }), async (_req, res) => {
  try {
    const kpiSql = `
      SELECT
        COUNT(*) AS total_inquiries,
        COUNT(CASE WHEN type = 'Borrower' THEN 1 END) AS total_borrowers,
        COUNT(CASE WHEN type = 'Investor' THEN 1 END) AS total_investors,
        COALESCE(SUM(CASE WHEN type = 'Borrower' THEN COALESCE((borrower_details->>'loanAmount')::numeric, 0) ELSE 0 END), 0) AS total_borrower_funding,
        COALESCE(SUM(CASE WHEN type = 'Investor' THEN COALESCE((investor_details->>'investmentAmount')::numeric, 0) ELSE 0 END), 0) AS total_investment_funding
      FROM inquiries;
    `;

    const trendSql = `
      SELECT
        to_char(created_at, 'YYYY-MM-DD') AS date_val,
        COUNT(*) AS count,
        COUNT(CASE WHEN type = 'Borrower' THEN 1 END) AS borrowers,
        COUNT(CASE WHEN type = 'Investor' THEN 1 END) AS investors
      FROM inquiries
      WHERE created_at >= (CURRENT_DATE - INTERVAL '13 days')
      GROUP BY date_val
      ORDER BY date_val ASC;
    `;

    const [kpiRes, trendRes] = await Promise.all([
      query(kpiSql),
      query(trendSql),
    ]);

    const kpi = kpiRes.rows[0] || {};
    const totalInquiries = Number.parseInt(kpi.total_inquiries || 0, 10);
    const activeBorrowers = Number.parseInt(kpi.total_borrowers || 0, 10);
    const activeInvestors = Number.parseInt(kpi.total_investors || 0, 10);
    const totalBorrowerFunding = Number.parseFloat(kpi.total_borrower_funding || 0);
    const totalInvestmentFunding = Number.parseFloat(kpi.total_investment_funding || 0);

    // Build contiguous 14-day sequence
    const trendMap = new Map();
    for (const row of trendRes.rows) {
      trendMap.set(row.date_val, {
        inquiries: Number.parseInt(row.count || 0, 10),
        borrowers: Number.parseInt(row.borrowers || 0, 10),
        investors: Number.parseInt(row.investors || 0, 10),
      });
    }

    const trend = [];
    const trendDays = 14;
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = d.getDate();
      const mon = d.getMonth() + 1;
      const label = `${day}/${mon}`;
      const found = trendMap.get(dateStr) || { inquiries: 0, borrowers: 0, investors: 0 };
      trend.push({
        date: dateStr,
        label,
        inquiries: found.inquiries,
        borrowers: found.borrowers,
        investors: found.investors,
      });
    }

    res.json({
      totalInquiries,
      activeBorrowers,
      activeInvestors,
      totalBorrowerFunding,
      totalInvestmentFunding,
      trend,
      pipelineData: [
        { name: 'Borrowers', value: activeBorrowers, fill: '#0ea5e9' },
        { name: 'Investors', value: activeInvestors, fill: '#8b5cf6' },
      ],
      fundingBarData: [
        { name: 'Borrower Funding', amount: totalBorrowerFunding, fill: '#0284c7' },
        { name: 'Investment Funding', amount: totalInvestmentFunding, fill: '#7c3aed' },
      ],
    });
  } catch (err) {
    console.error('Fetch dashboard stats error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch dashboard statistics' });
  }
});

// ─── Stage Funnel Summary (Instant stage counts & amounts) ────
router.get('/stage-summary', cacheMiddleware({ ttl: 120, tags: ['inquiries'] }), async (req, res) => {
  try {
    const { type } = req.query;
    const filterType = ALLOWED_INQUIRY_TYPES.includes(type) ? type : 'Borrower';

    const sql = `
      SELECT
        stage,
        COUNT(*)::int AS count,
        COALESCE(SUM(
          CASE
            WHEN type = 'Borrower' THEN COALESCE((borrower_details->>'loanAmount')::numeric, 0)
            WHEN type = 'Investor' THEN COALESCE((investor_details->>'investmentAmount')::numeric, 0)
            ELSE 0
          END
        ), 0)::numeric AS total_amount
      FROM inquiries
      WHERE type = $1
      GROUP BY stage;
    `;
    const result = await query(sql, [filterType]);
    const summary = result.rows.map(row => ({
      stage: row.stage,
      count: Number(row.count || 0),
      totalAmount: Number(row.total_amount || 0),
    }));
    res.json(summary);
  } catch (err) {
    console.error('Fetch stage summary error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch stage summary' });
  }
});

// ─── Paginated & Filtered Inquiries List ─────────────────────
router.get('/', cacheMiddleware({ ttl: 60, tags: ['inquiries'] }), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || req.query.pageSize, 10) || (req.query.page || req.query.paginate === 'true' ? 25 : 50)));
    const isPaginatedRequest = Boolean(req.query.page || req.query.limit || req.query.pageSize || req.query.paginate === 'true' || req.query.search);

    const whereClauses = [];
    const params = [];

    if (req.query.type && ALLOWED_INQUIRY_TYPES.includes(req.query.type)) {
      params.push(req.query.type);
      whereClauses.push(`type = $${params.length}`);
    }

    if (req.query.stage) {
      params.push(sanitizeString(req.query.stage, 50));
      whereClauses.push(`stage = $${params.length}`);
    }

    if (req.query.priority && ALLOWED_PRIORITIES.includes(req.query.priority)) {
      params.push(req.query.priority);
      whereClauses.push(`priority = $${params.length}`);
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const s = req.query.search.trim().slice(0, 100);
      if (s) {
        params.push(`%${s}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          name ILIKE $${pIdx} OR
          mobile ILIKE $${pIdx} OR
          email ILIKE $${pIdx} OR
          id ILIKE $${pIdx} OR
          city ILIKE $${pIdx}
        )`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sorting
    let orderSql = `NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint ASC, id ASC`;
    const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (req.query.sortBy === 'createdAt') {
      orderSql = `created_at ${sortOrder}`;
    } else if (req.query.sortBy === 'name') {
      orderSql = `LOWER(name) ${sortOrder}`;
    } else if (req.query.sortBy === 'stage') {
      orderSql = `stage ${sortOrder}`;
    } else if (req.query.sortBy === 'priority') {
      orderSql = `priority ${sortOrder}`;
    } else if (req.query.sortBy === 'id' && sortOrder === 'DESC') {
      orderSql = `NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint DESC, id DESC`;
    }

    if (isPaginatedRequest) {
      const offset = (page - 1) * limit;
      params.push(limit);
      const limitParam = params.length;
      params.push(offset);
      const offsetParam = params.length;

      const sql = `
        SELECT *, COUNT(*) OVER() as _full_count
        FROM inquiries
        ${whereSql}
        ORDER BY ${orderSql}
        LIMIT $${limitParam} OFFSET $${offsetParam};
      `;
      const result = await query(sql, params);
      const total = result.rows.length > 0 ? Number.parseInt(result.rows[0]._full_count, 10) : 0;
      const data = result.rows.map(mapRowToInquiry);

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    }

    // Default safe fallback if unpaginated request
    const sql = `SELECT * FROM inquiries ${whereSql} ORDER BY ${orderSql} LIMIT 100`;
    const result = await query(sql, params);
    res.json(result.rows.map(mapRowToInquiry));
  } catch (err) {
    console.error('Fetch inquiries error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch inquiries' });
  }
});

router.get(
  '/:id',
  cacheMiddleware({ ttl: 300, tags: ['inquiries'], keyGenerator: (req) => `api:/inquiries:${req.params.id}` }),
  async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id, ID_PATTERNS.inquiry)) {
      return res.status(400).json({ error: 'Invalid inquiry ID format' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected. Check DATABASE_URL and server logs.' });
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
    await invalidateCache(['inquiries', 'dashboard']);
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

    await invalidateCache(['inquiries', 'dashboard']);
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
    await invalidateCache(['inquiries', 'dashboard']);
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
    await invalidateCache(['inquiries', 'dashboard']);
    res.status(204).send();
  } catch (err) {
    console.error('Delete inquiry error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to delete inquiry' });
  }
});

export default router;
