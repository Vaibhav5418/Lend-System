import '../../loadEnv.js';
import { query, closePool } from './index.js';
import {
  calcMonthlyInterest,
  calcTotalInterest,
  calcMaturityDate,
  generateRepaymentSchedule,
} from '../utils/financialCalc.js';

function createRng(seed = 987654321) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const random = createRng(101);

function pick(arr) {
  return arr[Math.floor(random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

const PAYMENT_MODES = ['Bank Transfer', 'NEFT', 'RTGS', 'Cheque', 'UPI'];

export async function seedLendingEcosystem() {
  console.log('=== SEEDING LENDING ECOSYSTEM (Loans, Collections, Investments, Payments, Proposals) ===');
  const startTime = Date.now();
  const now = new Date('2026-11-02T12:00:00.000Z');

  // ═══════════════════════════════════════════════════════════════════
  // 1. BORROWER LOANS (for DISBURSED inquiries)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n1. Fetching disbursed & approved borrower inquiries...');
  const inqRes = await query(`
    SELECT id, name, mobile, email, notes, last_activity_at, created_at, borrower_details, stage
    FROM inquiries
    WHERE type = 'Borrower' AND stage IN ('DISBURSED', 'APPROVED')
    ORDER BY NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint ASC
  `);

  const borrowerInqs = inqRes.rows;
  console.log(`Found ${borrowerInqs.length} borrower inquiries for loan creation.`);

  // Get current max loan id
  const maxLoanRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 6) AS INTEGER)) AS max_num FROM borrower_loans WHERE id ~ '^LOAN-[0-9]+$'`
  );
  let loanIdCounter = maxLoanRes.rows[0]?.max_num || 0;

  const loansToInsert = [];
  const generatedLoans = [];

  for (const inq of borrowerInqs) {
    loanIdCounter++;
    const loanId = `LOAN-${String(loanIdCounter).padStart(3, '0')}`;
    const bDetails = inq.borrower_details || {};
    const amount = Number(bDetails.loanAmount) || 1000000;
    const rate = Number(bDetails.proposedInterest) || 15.0;
    const tenure = Number(bDetails.tenure) || 12;
    const startDate = inq.last_activity_at ? new Date(inq.last_activity_at) : new Date(inq.created_at);
    const endDate = calcMaturityDate(startDate, tenure);

    const monthlyInterest = calcMonthlyInterest(amount, rate);
    const totalInterest = calcTotalInterest(amount, rate, tenure);
    const totalRepayable = amount + totalInterest;

    const schedule = generateRepaymentSchedule(amount, rate, tenure, 'Interest-Only', startDate);

    let status = 'Active';
    if (endDate.getTime() < now.getTime()) {
      status = 'Closed';
    } else if (random() < 0.04) {
      status = 'Defaulted';
    }

    const companyName = inq.notes && inq.notes.includes('enterprise')
      ? `${inq.name.split(' ')[1] || 'Apex'} Enterprises`
      : `${inq.name.split(' ')[1] || 'Universal'} Industries`;

    const loanObj = {
      id: loanId,
      inquiryId: inq.id,
      borrowerName: inq.name,
      companyName,
      mobile: inq.mobile || '',
      email: inq.email || '',
      approvedAmount: amount,
      interestRate: rate,
      interestRateType: 'yearly',
      tenureMonths: tenure,
      repaymentType: 'Interest-Only',
      monthlyInterest,
      totalInterest,
      totalRepayable,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      repaymentSchedule: schedule,
      investorMapping: [],
      loanPurpose: inq.notes ? inq.notes.slice(0, 400) : 'Working capital loan',
      status,
      notes: inq.notes || '',
      createdAt: startDate.toISOString(),
      updatedAt: now.toISOString(),
    };

    loansToInsert.push(loanObj);
    generatedLoans.push(loanObj);
  }

  // Insert loans in batch
  console.log(`Inserting ${loansToInsert.length} loans into borrower_loans...`);
  if (loansToInsert.length > 0) {
    const ids = loansToInsert.map(l => l.id);
    const inquiryIds = loansToInsert.map(l => l.inquiryId);
    const borrowerNames = loansToInsert.map(l => l.borrowerName);
    const companyNames = loansToInsert.map(l => l.companyName);
    const mobiles = loansToInsert.map(l => l.mobile);
    const emails = loansToInsert.map(l => l.email);
    const approvedAmounts = loansToInsert.map(l => l.approvedAmount);
    const interestRates = loansToInsert.map(l => l.interestRate);
    const interestRateTypes = loansToInsert.map(l => l.interestRateType);
    const tenureMonthsArr = loansToInsert.map(l => l.tenureMonths);
    const repaymentTypes = loansToInsert.map(l => l.repaymentType);
    const monthlyInterests = loansToInsert.map(l => l.monthlyInterest);
    const totalInterests = loansToInsert.map(l => l.totalInterest);
    const totalRepayables = loansToInsert.map(l => l.totalRepayable);
    const startDates = loansToInsert.map(l => l.startDate);
    const endDates = loansToInsert.map(l => l.endDate);
    const schedules = loansToInsert.map(l => JSON.stringify(l.repaymentSchedule));
    const mappings = loansToInsert.map(l => JSON.stringify(l.investorMapping));
    const loanPurposes = loansToInsert.map(l => l.loanPurpose);
    const statuses = loansToInsert.map(l => l.status);
    const notesList = loansToInsert.map(l => l.notes);
    const createdAts = loansToInsert.map(l => l.createdAt);
    const updatedAts = loansToInsert.map(l => l.updatedAt);

    await query(`
      INSERT INTO borrower_loans (
        id, inquiry_id, borrower_name, company_name, mobile, email,
        approved_amount, interest_rate, interest_rate_type, tenure_months,
        repayment_type, monthly_interest, total_interest, total_repayable,
        start_date, end_date, repayment_schedule, investor_mapping, loan_purpose,
        status, notes, created_at, updated_at
      )
      SELECT
        u.id, u.inquiry_id, u.borrower_name, u.company_name, u.mobile, u.email,
        u.approved_amount, u.interest_rate, u.interest_rate_type, u.tenure_months,
        u.repayment_type, u.monthly_interest, u.total_interest, u.total_repayable,
        u.start_date, u.end_date, u.repayment_schedule::jsonb, u.investor_mapping::jsonb, u.loan_purpose,
        u.status, u.notes, u.created_at, u.updated_at
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[],
        $7::numeric[], $8::numeric[], $9::varchar[], $10::integer[],
        $11::varchar[], $12::numeric[], $13::numeric[], $14::numeric[],
        $15::timestamptz[], $16::timestamptz[], $17::text[], $18::text[], $19::varchar[],
        $20::varchar[], $21::text[], $22::timestamptz[], $23::timestamptz[]
      ) AS u(
        id, inquiry_id, borrower_name, company_name, mobile, email,
        approved_amount, interest_rate, interest_rate_type, tenure_months,
        repayment_type, monthly_interest, total_interest, total_repayable,
        start_date, end_date, repayment_schedule, investor_mapping, loan_purpose,
        status, notes, created_at, updated_at
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      ids, inquiryIds, borrowerNames, companyNames, mobiles, emails,
      approvedAmounts, interestRates, interestRateTypes, tenureMonthsArr,
      repaymentTypes, monthlyInterests, totalInterests, totalRepayables,
      startDates, endDates, schedules, mappings, loanPurposes,
      statuses, notesList, createdAts, updatedAts
    ]);
  }
  console.log(`Seeded ${loansToInsert.length} loans.`);

  // ═══════════════════════════════════════════════════════════════════
  // 2. BORROWER COLLECTIONS (Monthly repayments ledger)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n2. Generating borrower collections from active loan schedules...');
  const maxColRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) AS max_num FROM borrower_collections WHERE id ~ '^COL-[0-9]+$'`
  );
  let colIdCounter = maxColRes.rows[0]?.max_num || 0;

  const collectionsToInsert = [];

  for (const loan of generatedLoans) {
    const schedule = loan.repaymentSchedule || [];

    for (const item of schedule) {
      const dueDate = new Date(item.dueDate);
      const isPast = dueDate.getTime() < now.getTime();
      const isNearFuture = !isPast && (dueDate.getTime() - now.getTime() < 35 * 86400000);

      // Only generate collection records for past dues and near-term upcoming dues
      if (!isPast && !isNearFuture) continue;

      colIdCounter++;
      const colId = `COL-${String(colIdCounter).padStart(3, '0')}`;

      let status = 'Pending';
      let interestPaid = 0;
      let principalPaid = 0;
      let totalPaid = 0;
      let pendingAmount = item.totalDue;
      let overdueDays = 0;
      let penalty = 0;
      let paymentDate = dueDate;
      let paymentMode = pick(PAYMENT_MODES);

      if (isPast) {
        const roll = random();
        if (roll < 0.88) {
          // Successfully collected
          status = 'Received';
          interestPaid = item.interestDue;
          principalPaid = item.principalDue;
          totalPaid = item.totalDue;
          pendingAmount = 0;
          paymentDate = new Date(dueDate.getTime() - randInt(0, 3) * 86400000);
        } else if (roll < 0.95) {
          // Overdue
          status = 'Overdue';
          overdueDays = Math.min(90, Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / 86400000)));
          penalty = Math.round(item.interestDue * 0.05);
          pendingAmount = item.totalDue;
        } else {
          // Partial payment
          status = 'Partial';
          interestPaid = Math.round(item.interestDue * 0.6);
          totalPaid = interestPaid;
          pendingAmount = item.totalDue - totalPaid;
          paymentDate = dueDate;
        }
      }

      collectionsToInsert.push({
        id: colId,
        loanId: loan.id,
        borrowerName: loan.borrowerName,
        paymentDate: paymentDate.toISOString(),
        dueDate: dueDate.toISOString(),
        scheduleMonth: item.month,
        interestPaid,
        principalPaid,
        totalPaid,
        pendingAmount,
        overdueDays,
        penalty,
        paymentMode,
        status,
        remarks: status === 'Received' ? 'On-time monthly settlement' : status === 'Overdue' ? 'Follow-up call initiated' : 'Upcoming installment',
        createdAt: paymentDate.toISOString(),
      });
    }
  }

  console.log(`Generated ${collectionsToInsert.length} collection records. Inserting in batches...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < collectionsToInsert.length; i += BATCH_SIZE) {
    const batch = collectionsToInsert.slice(i, i + BATCH_SIZE);
    await query(`
      INSERT INTO borrower_collections (
        id, loan_id, borrower_name, payment_date, due_date, schedule_month,
        interest_paid, principal_paid, total_paid, pending_amount,
        overdue_days, penalty, payment_mode, status, remarks, created_at
      )
      SELECT
        u.id, u.loan_id, u.borrower_name, u.payment_date, u.due_date, u.schedule_month,
        u.interest_paid, u.principal_paid, u.total_paid, u.pending_amount,
        u.overdue_days, u.penalty, u.payment_mode, u.status, u.remarks, u.created_at
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::timestamptz[], $5::timestamptz[], $6::integer[],
        $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[],
        $11::integer[], $12::numeric[], $13::varchar[], $14::varchar[], $15::text[], $16::timestamptz[]
      ) AS u(
        id, loan_id, borrower_name, payment_date, due_date, schedule_month,
        interest_paid, principal_paid, total_paid, pending_amount,
        overdue_days, penalty, payment_mode, status, remarks, created_at
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      batch.map(c => c.id),
      batch.map(c => c.loanId),
      batch.map(c => c.borrowerName),
      batch.map(c => c.paymentDate),
      batch.map(c => c.dueDate),
      batch.map(c => c.scheduleMonth),
      batch.map(c => c.interestPaid),
      batch.map(c => c.principalPaid),
      batch.map(c => c.totalPaid),
      batch.map(c => c.pendingAmount),
      batch.map(c => c.overdueDays),
      batch.map(c => c.penalty),
      batch.map(c => c.paymentMode),
      batch.map(c => c.status),
      batch.map(c => c.remarks),
      batch.map(c => c.createdAt),
    ]);
  }
  console.log(`Seeded ${collectionsToInsert.length} collection records.`);

  // ═══════════════════════════════════════════════════════════════════
  // 3. INVESTOR INVESTMENTS (for FUND_RECEIVED inquiries)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n3. Fetching fund received & agreement done investor inquiries...');
  const invRes = await query(`
    SELECT id, name, mobile, email, notes, last_activity_at, created_at, investor_details, stage
    FROM inquiries
    WHERE type = 'Investor' AND stage IN ('FUND_RECEIVED', 'AGREEMENT_DONE')
    ORDER BY NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint ASC
  `);

  const investorInqs = invRes.rows;
  console.log(`Found ${investorInqs.length} investor inquiries for investment creation.`);

  const maxInvRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) AS max_num FROM investor_investments WHERE id ~ '^INV-[0-9]+$'`
  );
  let invIdCounter = maxInvRes.rows[0]?.max_num || 0;

  const investmentsToInsert = [];
  const generatedInvestments = [];

  for (const inq of investorInqs) {
    invIdCounter++;
    const invId = `INV-${String(invIdCounter).padStart(3, '0')}`;
    const iDetails = inq.investor_details || {};
    const amount = Number(iDetails.investmentAmount) || 2500000;
    const rate = Number(iDetails.expectedInterest) || 9.5;
    const tenure = Number(iDetails.tenure) || 12;
    const freq = (iDetails.frequency || 'Monthly').toLowerCase();
    const startDate = inq.last_activity_at ? new Date(inq.last_activity_at) : new Date(inq.created_at);
    const maturityDate = calcMaturityDate(startDate, tenure);

    const monthlyInterest = calcMonthlyInterest(amount, rate);
    const totalInterest = calcTotalInterest(amount, rate, tenure);
    const totalPayout = amount + totalInterest;

    let status = 'Active';
    if (maturityDate.getTime() < now.getTime()) {
      status = 'Matured';
    }

    const invObj = {
      id: invId,
      inquiryId: inq.id,
      investorName: inq.name,
      mobile: inq.mobile || '',
      email: inq.email || '',
      investedAmount: amount,
      interestRate: rate,
      interestRateType: 'yearly',
      tenureMonths: tenure,
      investmentPlan: 'custom',
      payoutFrequency: freq,
      monthlyInterest,
      totalInterest,
      totalPayout,
      startDate: startDate.toISOString(),
      maturityDate: maturityDate.toISOString(),
      linkedBorrowers: [],
      status,
      notes: inq.notes || '',
      createdAt: startDate.toISOString(),
      updatedAt: now.toISOString(),
    };

    investmentsToInsert.push(invObj);
    generatedInvestments.push(invObj);
  }

  console.log(`Inserting ${investmentsToInsert.length} investments into investor_investments...`);
  if (investmentsToInsert.length > 0) {
    await query(`
      INSERT INTO investor_investments (
        id, inquiry_id, investor_name, mobile, email, invested_amount,
        interest_rate, interest_rate_type, tenure_months, investment_plan,
        payout_frequency, monthly_interest, total_interest, total_payout,
        start_date, maturity_date, linked_borrowers, status, notes, created_at, updated_at
      )
      SELECT
        u.id, u.inquiry_id, u.investor_name, u.mobile, u.email, u.invested_amount,
        u.interest_rate, u.interest_rate_type, u.tenure_months, u.investment_plan,
        u.payout_frequency, u.monthly_interest, u.total_interest, u.total_payout,
        u.start_date, u.maturity_date, u.linked_borrowers::jsonb, u.status, u.notes, u.created_at, u.updated_at
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::numeric[],
        $7::numeric[], $8::varchar[], $9::integer[], $10::varchar[],
        $11::varchar[], $12::numeric[], $13::numeric[], $14::numeric[],
        $15::timestamptz[], $16::timestamptz[], $17::text[], $18::varchar[], $19::text[], $20::timestamptz[], $21::timestamptz[]
      ) AS u(
        id, inquiry_id, investor_name, mobile, email, invested_amount,
        interest_rate, interest_rate_type, tenure_months, investment_plan,
        payout_frequency, monthly_interest, total_interest, total_payout,
        start_date, maturity_date, linked_borrowers, status, notes, created_at, updated_at
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      investmentsToInsert.map(i => i.id),
      investmentsToInsert.map(i => i.inquiryId),
      investmentsToInsert.map(i => i.investorName),
      investmentsToInsert.map(i => i.mobile),
      investmentsToInsert.map(i => i.email),
      investmentsToInsert.map(i => i.investedAmount),
      investmentsToInsert.map(i => i.interestRate),
      investmentsToInsert.map(i => i.interestRateType),
      investmentsToInsert.map(i => i.tenureMonths),
      investmentsToInsert.map(i => i.investmentPlan),
      investmentsToInsert.map(i => i.payoutFrequency),
      investmentsToInsert.map(i => i.monthlyInterest),
      investmentsToInsert.map(i => i.totalInterest),
      investmentsToInsert.map(i => i.totalPayout),
      investmentsToInsert.map(i => i.startDate),
      investmentsToInsert.map(i => i.maturityDate),
      investmentsToInsert.map(i => JSON.stringify(i.linkedBorrowers)),
      investmentsToInsert.map(i => i.status),
      investmentsToInsert.map(i => i.notes),
      investmentsToInsert.map(i => i.createdAt),
      investmentsToInsert.map(i => i.updatedAt),
    ]);
  }
  console.log(`Seeded ${investmentsToInsert.length} investments.`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. INVESTOR PAYMENTS (Interest payouts ledger)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n4. Generating investor payout schedules and payments...');
  const maxPayRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 6) AS INTEGER)) AS max_num FROM investor_payments WHERE id ~ '^IPAY-[0-9]+$'`
  );
  let payIdCounter = maxPayRes.rows[0]?.max_num || 0;

  const paymentsToInsert = [];

  for (const inv of generatedInvestments) {
    const tenure = inv.tenureMonths || 12;
    const freq = inv.payoutFrequency || 'monthly';
    const intervalMonths = freq === 'quarterly' ? 3 : freq === 'on_maturity' ? tenure : 1;
    const numPayouts = Math.max(1, Math.floor(tenure / intervalMonths));
    const interestPerPayout = Math.round(inv.monthlyInterest * intervalMonths * 100) / 100;
    const startDate = new Date(inv.startDate);

    for (let step = 1; step <= numPayouts; step++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + step * intervalMonths);

      const isPast = dueDate.getTime() < now.getTime();
      const isNearFuture = !isPast && (dueDate.getTime() - now.getTime() < 35 * 86400000);

      if (!isPast && !isNearFuture) continue;

      payIdCounter++;
      const payId = `IPAY-${String(payIdCounter).padStart(3, '0')}`;
      const isMaturity = step === numPayouts;

      let status = 'Pending';
      let interestPaid = 0;
      let principalPaid = 0;
      let amountPaid = 0;
      let pendingInterest = interestPerPayout;
      let paymentDate = dueDate;

      if (isPast) {
        if (random() < 0.93) {
          status = 'Paid';
          interestPaid = interestPerPayout;
          principalPaid = isMaturity ? inv.investedAmount : 0;
          amountPaid = interestPaid + principalPaid;
          pendingInterest = 0;
          paymentDate = dueDate;
        } else {
          status = 'Overdue';
          pendingInterest = interestPerPayout;
        }
      }

      paymentsToInsert.push({
        id: payId,
        investmentId: inv.id,
        investorName: inv.investorName,
        paymentDate: paymentDate.toISOString(),
        dueDate: dueDate.toISOString(),
        amountPaid,
        interestPaid,
        principalPaid,
        pendingInterest,
        paymentFrequency: freq,
        paymentMode: pick(['Bank Transfer', 'NEFT', 'RTGS']),
        status,
        remarks: status === 'Paid' ? `${freq.toUpperCase()} payout credited` : 'Scheduled interest payout',
        createdAt: paymentDate.toISOString(),
      });
    }
  }

  console.log(`Generated ${paymentsToInsert.length} investor payments. Inserting in batches...`);
  for (let i = 0; i < paymentsToInsert.length; i += BATCH_SIZE) {
    const batch = paymentsToInsert.slice(i, i + BATCH_SIZE);
    await query(`
      INSERT INTO investor_payments (
        id, investment_id, investor_name, payment_date, due_date,
        amount_paid, interest_paid, principal_paid, pending_interest,
        payment_frequency, payment_mode, status, remarks, created_at
      )
      SELECT
        u.id, u.investment_id, u.investor_name, u.payment_date, u.due_date,
        u.amount_paid, u.interest_paid, u.principal_paid, u.pending_interest,
        u.payment_frequency, u.payment_mode, u.status, u.remarks, u.created_at
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::timestamptz[], $5::timestamptz[],
        $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[],
        $10::varchar[], $11::varchar[], $12::varchar[], $13::text[], $14::timestamptz[]
      ) AS u(
        id, investment_id, investor_name, payment_date, due_date,
        amount_paid, interest_paid, principal_paid, pending_interest,
        payment_frequency, payment_mode, status, remarks, created_at
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      batch.map(p => p.id),
      batch.map(p => p.investmentId),
      batch.map(p => p.investorName),
      batch.map(p => p.paymentDate),
      batch.map(p => p.dueDate),
      batch.map(p => p.amountPaid),
      batch.map(p => p.interestPaid),
      batch.map(p => p.principalPaid),
      batch.map(p => p.pendingInterest),
      batch.map(p => p.paymentFrequency),
      batch.map(p => p.paymentMode),
      batch.map(p => p.status),
      batch.map(p => p.remarks),
      batch.map(p => p.createdAt),
    ]);
  }
  console.log(`Seeded ${paymentsToInsert.length} investor payments.`);

  // ═══════════════════════════════════════════════════════════════════
  // 5. PROPOSALS (for PROPOSED, APPROVED, and DISBURSED inquiries)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n5. Generating proposals for proposed/approved/disbursed borrower inquiries...');
  const propInqs = await query(`
    SELECT id, name, created_at, last_activity_at, notes, borrower_details, stage
    FROM inquiries
    WHERE type = 'Borrower' AND stage IN ('PROPOSED', 'APPROVED', 'DISBURSED')
    ORDER BY NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint ASC
  `);

  const maxPropRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 6) AS INTEGER)) AS max_num FROM proposals WHERE id ~ '^PROP-[0-9]+$'`
  );
  let propIdCounter = maxPropRes.rows[0]?.max_num || 0;

  const proposalsToInsert = [];

  for (const inq of propInqs.rows) {
    propIdCounter++;
    const propId = `PROP-${String(propIdCounter).padStart(3, '0')}`;
    const b = inq.borrower_details || {};
    const amount = Number(b.loanAmount) || 1500000;
    const rate = Number(b.proposedInterest) || 15.0;
    const tenure = Number(b.tenure) || 12;

    const sentAt = new Date(inq.created_at);
    sentAt.setDate(sentAt.getDate() + 2);

    let status = 'Sent';
    let respondedAt = null;
    if (inq.stage === 'APPROVED' || inq.stage === 'DISBURSED') {
      status = 'Accepted';
      respondedAt = inq.last_activity_at ? new Date(inq.last_activity_at) : new Date();
    }

    const history = [
      {
        action: 'Sent',
        proposedLoanAmount: amount,
        proposedInterestRate: rate,
        proposedTenure: tenure,
        timestamp: sentAt.toISOString(),
        notes: 'Official term sheet issued',
      },
    ];

    if (status === 'Accepted' && respondedAt) {
      history.push({
        action: 'Accepted',
        proposedLoanAmount: amount,
        proposedInterestRate: rate,
        proposedTenure: tenure,
        timestamp: respondedAt.toISOString(),
        notes: 'Borrower accepted terms without counter-conditions',
      });
    }

    proposalsToInsert.push({
      id: propId,
      inquiryId: inq.id,
      borrowerName: inq.name,
      originalLoanAmount: amount,
      originalInterestRate: rate,
      originalTenure: tenure,
      proposedLoanAmount: amount,
      proposedInterestRate: rate,
      proposedTenure: tenure,
      notes: inq.notes || '',
      status,
      sentAt: sentAt.toISOString(),
      respondedAt: respondedAt ? respondedAt.toISOString() : null,
      history: JSON.stringify(history),
      createdAt: sentAt.toISOString(),
      updatedAt: (respondedAt || sentAt).toISOString(),
    });
  }

  console.log(`Inserting ${proposalsToInsert.length} proposals in batches...`);
  for (let i = 0; i < proposalsToInsert.length; i += BATCH_SIZE) {
    const batch = proposalsToInsert.slice(i, i + BATCH_SIZE);
    await query(`
      INSERT INTO proposals (
        id, inquiry_id, borrower_name, original_loan_amount, original_interest_rate,
        original_tenure, proposed_loan_amount, proposed_interest_rate, proposed_tenure,
        notes, status, sent_at, responded_at, history, created_at, updated_at
      )
      SELECT
        u.id, u.inquiry_id, u.borrower_name, u.original_loan_amount, u.original_interest_rate,
        u.original_tenure, u.proposed_loan_amount, u.proposed_interest_rate, u.proposed_tenure,
        u.notes, u.status, u.sent_at, u.responded_at, u.history::jsonb, u.created_at, u.updated_at
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::numeric[], $5::numeric[],
        $6::integer[], $7::numeric[], $8::numeric[], $9::integer[],
        $10::text[], $11::varchar[], $12::timestamptz[], $13::timestamptz[], $14::text[], $15::timestamptz[], $16::timestamptz[]
      ) AS u(
        id, inquiry_id, borrower_name, original_loan_amount, original_interest_rate,
        original_tenure, proposed_loan_amount, proposed_interest_rate, proposed_tenure,
        notes, status, sent_at, responded_at, history, created_at, updated_at
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      batch.map(p => p.id),
      batch.map(p => p.inquiryId),
      batch.map(p => p.borrowerName),
      batch.map(p => p.originalLoanAmount),
      batch.map(p => p.originalInterestRate),
      batch.map(p => p.originalTenure),
      batch.map(p => p.proposedLoanAmount),
      batch.map(p => p.proposedInterestRate),
      batch.map(p => p.proposedTenure),
      batch.map(p => p.notes),
      batch.map(p => p.status),
      batch.map(p => p.sentAt),
      batch.map(p => p.respondedAt),
      batch.map(p => p.history),
      batch.map(p => p.createdAt),
      batch.map(p => p.updatedAt),
    ]);
  }
  console.log(`Seeded ${proposalsToInsert.length} proposals.`);

  console.log(`\n======================================================`);
  console.log(`LENDING ECOSYSTEM SEEDING COMPLETE in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`======================================================\n`);
}

// Auto-run when executed directly via node
if (process.argv[1]?.endsWith('seedLendingEcosystem.js')) {
  seedLendingEcosystem()
    .catch((err) => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    })
    .finally(() => closePool());
}

