/**
 * MongoDB to Neon PostgreSQL Data Migration Script
 *
 * Transfers existing data from MongoDB Atlas into Neon PostgreSQL.
 * Safe, idempotent, and resumable using ON CONFLICT clauses.
 * Does not modify or delete source MongoDB data.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node src/db/migrateMongoToPg.js
 */

import '../../loadEnv.js';
import mongoose from 'mongoose';
import { pool, query } from './index.js';
import { initializeDatabase } from './migrate.js';
import { sanitizeLog } from '../utils/security.js';

async function migrateData() {
  const mongoUri = process.env.MONGODB_URI || process.argv[2];

  if (!mongoUri) {
    console.error('================================================================');
    console.error('ERROR: MONGODB_URI is not configured in .env or arguments.');
    console.error('Source MongoDB database access is required to migrate documents.');
    console.error('To run migration when MongoDB access is available:');
    console.error('  MONGODB_URI="mongodb+srv://..." node src/db/migrateMongoToPg.js');
    console.error('================================================================');
    process.exit(1);
  }

  console.log('Connecting to source MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB.');

  // Ensure target schema exists
  await initializeDatabase();

  const mongoDb = mongoose.connection.db;
  const collections = await mongoDb.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);
  console.log('Found MongoDB collections:', collectionNames);

  function getColName(...candidates) {
    const lowerMap = new Map(collectionNames.map((n) => [n.toLowerCase(), n]));
    for (const c of candidates) {
      if (lowerMap.has(c.toLowerCase())) {
        return lowerMap.get(c.toLowerCase());
      }
    }
    return null;
  }

  const stats = {
    users: 0,
    staff: 0,
    agents: 0,
    inquiries: 0,
    documents: 0,
    proposals: 0,
    borrower_loans: 0,
    borrower_collections: 0,
    investor_investments: 0,
    investor_payments: 0,
  };

  // 1. Migrate Users
  const usersCol = getColName('users', 'user');
  if (usersCol) {
    console.log(`Migrating users from ${usersCol}...`);
    const users = await mongoDb.collection(usersCol).find({}).toArray();
    for (const u of users) {
      const id = u._id ? u._id.toString() : null;
      if (!id || !u.email) continue;
      await query(
        `INSERT INTO users (id, name, email, password, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           password = EXCLUDED.password,
           role = EXCLUDED.role`,
        [
          id,
          u.name || '',
          String(u.email).trim().toLowerCase(),
          u.password || '',
          u.role || 'Super Admin',
          u.createdAt ? new Date(u.createdAt) : new Date(),
        ]
      );
      stats.users++;
    }
    console.log(`Migrated ${stats.users} users.`);
  }

  // 2. Migrate Staff
  const staffCol = getColName('staffs', 'staff');
  if (staffCol) {
    console.log(`Migrating staff from ${staffCol}...`);
    const staffList = await mongoDb.collection(staffCol).find({}).toArray();
    for (const s of staffList) {
      if (!s.name) continue;
      await query(
        `INSERT INTO staff (name, display_order)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order`,
        [s.name, s.order ?? 0]
      );
      stats.staff++;
    }
    console.log(`Migrated ${stats.staff} staff members.`);
  }

  // 3. Migrate Agents
  const agentsCol = getColName('agents', 'agent');
  if (agentsCol) {
    console.log(`Migrating agents from ${agentsCol}...`);
    const agents = await mongoDb.collection(agentsCol).find({}).toArray();
    for (const a of agents) {
      if (!a.id && !a.name) continue;
      const id = a.id || (a._id ? a._id.toString() : null);
      if (!id) continue;
      await query(
        `INSERT INTO agents (id, name, total_inquiries, conversions)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           total_inquiries = EXCLUDED.total_inquiries,
           conversions = EXCLUDED.conversions`,
        [id, a.name || 'Unnamed Agent', a.totalInquiries || 0, a.conversions || 0]
      );
      stats.agents++;
    }
    console.log(`Migrated ${stats.agents} agents.`);
  }

  // 4. Migrate Inquiries
  const inquiriesCol = getColName('inquiries', 'inquiry');
  if (inquiriesCol) {
    console.log(`Migrating inquiries from ${inquiriesCol}...`);
    const inquiries = await mongoDb.collection(inquiriesCol).find({}).toArray();
    for (const inq of inquiries) {
      const id = inq.id || (inq._id ? inq._id.toString() : null);
      if (!id) continue;
      await query(
        `INSERT INTO inquiries (
           id, type, name, mobile, email, city, source, priority, assigned_to,
           reference_agent, stage, next_follow_up, turnover, last_activity,
           last_activity_at, created_at, notes, activity_logs, combined_report_markdown,
           combined_report_generated_at, profile_score, profile_score_rating,
           borrower_details, investor_details
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19,
           $20, $21, $22,
           $23, $24
         )
         ON CONFLICT (id) DO UPDATE SET
           type = EXCLUDED.type,
           name = EXCLUDED.name,
           mobile = EXCLUDED.mobile,
           email = EXCLUDED.email,
           city = EXCLUDED.city,
           source = EXCLUDED.source,
           priority = EXCLUDED.priority,
           assigned_to = EXCLUDED.assigned_to,
           reference_agent = EXCLUDED.reference_agent,
           stage = EXCLUDED.stage,
           next_follow_up = EXCLUDED.next_follow_up,
           turnover = EXCLUDED.turnover,
           last_activity = EXCLUDED.last_activity,
           last_activity_at = EXCLUDED.last_activity_at,
           notes = EXCLUDED.notes,
           activity_logs = EXCLUDED.activity_logs,
           combined_report_markdown = EXCLUDED.combined_report_markdown,
           combined_report_generated_at = EXCLUDED.combined_report_generated_at,
           profile_score = EXCLUDED.profile_score,
           profile_score_rating = EXCLUDED.profile_score_rating,
           borrower_details = EXCLUDED.borrower_details,
           investor_details = EXCLUDED.investor_details`,
        [
          id,
          inq.type || 'Borrower',
          inq.name || '',
          inq.mobile || '',
          inq.email || '',
          inq.city || '',
          inq.source || 'Website',
          inq.priority || 'Warm',
          inq.assignedTo || '',
          inq.referenceAgent || null,
          inq.stage || 'NEW',
          inq.nextFollowUp || null,
          inq.turnover || null,
          inq.lastActivity || 'Inquiry created',
          inq.lastActivityAt ? new Date(inq.lastActivityAt) : new Date(),
          inq.createdAt ? new Date(inq.createdAt) : new Date(),
          inq.notes || '',
          JSON.stringify(inq.activityLogs || []),
          inq.combinedReportMarkdown || null,
          inq.combinedReportGeneratedAt ? new Date(inq.combinedReportGeneratedAt) : null,
          inq.profileScore != null ? Number(inq.profileScore) : null,
          inq.profileScoreRating || null,
          inq.borrowerDetails ? JSON.stringify(inq.borrowerDetails) : null,
          inq.investorDetails ? JSON.stringify(inq.investorDetails) : null,
        ]
      );
      stats.inquiries++;
    }
    console.log(`Migrated ${stats.inquiries} inquiries.`);
  }

  // 5. Migrate Documents
  const documentsCol = getColName('documents', 'document');
  if (documentsCol) {
    console.log(`Migrating documents from ${documentsCol}...`);
    const documents = await mongoDb.collection(documentsCol).find({}).toArray();
    for (const doc of documents) {
      const id = doc._id ? doc._id.toString() : null;
      if (!id || !doc.inquiryId) continue;
      await query(
        `INSERT INTO documents (
           id, inquiry_id, file_name, mime_type, cloudinary_url, public_id,
           resource_type, storage_provider, summary, uploaded_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           file_name = EXCLUDED.file_name,
           mime_type = EXCLUDED.mime_type,
           cloudinary_url = EXCLUDED.cloudinary_url,
           public_id = EXCLUDED.public_id,
           summary = EXCLUDED.summary`,
        [
          id,
          doc.inquiryId,
          doc.fileName || 'document',
          doc.mimeType || 'application/pdf',
          doc.cloudinaryUrl || '',
          doc.publicId || '',
          doc.resourceType || 'auto',
          doc.storageProvider || 'cloudinary',
          doc.summary || '',
          doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        ]
      );
      stats.documents++;
    }
    console.log(`Migrated ${stats.documents} documents.`);
  }

  // 6. Migrate Proposals
  const proposalsCol = getColName('proposals', 'proposal');
  if (proposalsCol) {
    console.log(`Migrating proposals from ${proposalsCol}...`);
    const proposals = await mongoDb.collection(proposalsCol).find({}).toArray();
    for (const p of proposals) {
      const id = p.id || (p._id ? p._id.toString() : null);
      if (!id || !p.inquiryId) continue;
      await query(
        `INSERT INTO proposals (
           id, inquiry_id, borrower_name, original_loan_amount, original_interest_rate,
           original_tenure, proposed_loan_amount, proposed_interest_rate, proposed_tenure,
           notes, status, sent_at, responded_at, history, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           proposed_loan_amount = EXCLUDED.proposed_loan_amount,
           proposed_interest_rate = EXCLUDED.proposed_interest_rate,
           proposed_tenure = EXCLUDED.proposed_tenure,
           responded_at = EXCLUDED.responded_at,
           history = EXCLUDED.history,
           updated_at = EXCLUDED.updated_at`,
        [
          id,
          p.inquiryId,
          p.borrowerName || '',
          p.originalLoanAmount || 0,
          p.originalInterestRate || 0,
          p.originalTenure || 0,
          p.proposedLoanAmount || 0,
          p.proposedInterestRate || 0,
          p.proposedTenure || 0,
          p.notes || '',
          p.status || 'Sent',
          p.sentAt ? new Date(p.sentAt) : new Date(),
          p.respondedAt ? new Date(p.respondedAt) : null,
          JSON.stringify(p.history || []),
          p.createdAt ? new Date(p.createdAt) : new Date(),
          p.updatedAt ? new Date(p.updatedAt) : new Date(),
        ]
      );
      stats.proposals++;
    }
    console.log(`Migrated ${stats.proposals} proposals.`);
  }

  // 7. Migrate Borrower Loans
  const loansCol = getColName('borrowerloans', 'borrower_loans', 'borrowerloan', 'loans');
  if (loansCol) {
    console.log(`Migrating borrower loans from ${loansCol}...`);
    const loans = await mongoDb.collection(loansCol).find({}).toArray();
    for (const l of loans) {
      const id = l.id || (l._id ? l._id.toString() : null);
      if (!id) continue;
      await query(
        `INSERT INTO borrower_loans (
           id, inquiry_id, borrower_name, company_name, mobile, email,
           approved_amount, interest_rate, interest_rate_type, tenure_months,
           repayment_type, monthly_interest, total_interest, total_repayable,
           start_date, end_date, repayment_schedule, investor_mapping, loan_purpose,
           status, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19,
           $20, $21, $22, $23
         )
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           approved_amount = EXCLUDED.approved_amount,
           interest_rate = EXCLUDED.interest_rate,
           monthly_interest = EXCLUDED.monthly_interest,
           total_interest = EXCLUDED.total_interest,
           total_repayable = EXCLUDED.total_repayable,
           repayment_schedule = EXCLUDED.repayment_schedule,
           investor_mapping = EXCLUDED.investor_mapping,
           updated_at = EXCLUDED.updated_at`,
        [
          id,
          l.inquiryId || '',
          l.borrowerName || '',
          l.companyName || '',
          l.mobile || '',
          l.email || '',
          l.approvedAmount || 0,
          l.interestRate || 0,
          l.interestRateType || 'yearly',
          l.tenureMonths || 0,
          l.repaymentType || 'Interest-Only',
          l.monthlyInterest || 0,
          l.totalInterest || 0,
          l.totalRepayable || 0,
          l.startDate ? new Date(l.startDate) : new Date(),
          l.endDate ? new Date(l.endDate) : null,
          JSON.stringify(l.repaymentSchedule || []),
          JSON.stringify(l.investorMapping || []),
          l.loanPurpose || '',
          l.status || 'Active',
          l.notes || '',
          l.createdAt ? new Date(l.createdAt) : new Date(),
          l.updatedAt ? new Date(l.updatedAt) : new Date(),
        ]
      );
      stats.borrower_loans++;
    }
    console.log(`Migrated ${stats.borrower_loans} borrower loans.`);
  }

  // 8. Migrate Borrower Collections
  const collectionsCol = getColName('borrowercollections', 'borrower_collections', 'borrowercollection', 'collections');
  if (collectionsCol) {
    console.log(`Migrating borrower collections from ${collectionsCol}...`);
    const collectionsList = await mongoDb.collection(collectionsCol).find({}).toArray();
    for (const c of collectionsList) {
      const id = c.id || (c._id ? c._id.toString() : null);
      if (!id || !c.loanId) continue;
      await query(
        `INSERT INTO borrower_collections (
           id, loan_id, borrower_name, payment_date, due_date, schedule_month,
           interest_paid, principal_paid, total_paid, pending_amount,
           overdue_days, penalty, payment_mode, status, remarks, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           interest_paid = EXCLUDED.interest_paid,
           principal_paid = EXCLUDED.principal_paid,
           total_paid = EXCLUDED.total_paid,
           pending_amount = EXCLUDED.pending_amount,
           penalty = EXCLUDED.penalty`,
        [
          id,
          c.loanId,
          c.borrowerName || '',
          c.paymentDate ? new Date(c.paymentDate) : new Date(),
          c.dueDate ? new Date(c.dueDate) : null,
          c.scheduleMonth ?? null,
          c.interestPaid || 0,
          c.principalPaid || 0,
          c.totalPaid || 0,
          c.pendingAmount || 0,
          c.overdueDays || 0,
          c.penalty || 0,
          c.paymentMode || 'Bank Transfer',
          c.status || 'Pending',
          c.remarks || '',
          c.createdAt ? new Date(c.createdAt) : new Date(),
        ]
      );
      stats.borrower_collections++;
    }
    console.log(`Migrated ${stats.borrower_collections} collections.`);
  }

  // 9. Migrate Investor Investments
  const investmentsCol = getColName('investorinvestments', 'investor_investments', 'investorinvestment', 'investments');
  if (investmentsCol) {
    console.log(`Migrating investor investments from ${investmentsCol}...`);
    const investments = await mongoDb.collection(investmentsCol).find({}).toArray();
    for (const inv of investments) {
      const id = inv.id || (inv._id ? inv._id.toString() : null);
      if (!id) continue;
      await query(
        `INSERT INTO investor_investments (
           id, inquiry_id, investor_name, mobile, email, invested_amount,
           interest_rate, interest_rate_type, tenure_months, investment_plan,
           payout_frequency, monthly_interest, total_interest, total_payout,
           start_date, maturity_date, linked_borrowers, status, notes,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
         )
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           invested_amount = EXCLUDED.invested_amount,
           interest_rate = EXCLUDED.interest_rate,
           monthly_interest = EXCLUDED.monthly_interest,
           total_interest = EXCLUDED.total_interest,
           total_payout = EXCLUDED.total_payout,
           linked_borrowers = EXCLUDED.linked_borrowers,
           updated_at = EXCLUDED.updated_at`,
        [
          id,
          inv.inquiryId || '',
          inv.investorName || '',
          inv.mobile || '',
          inv.email || '',
          inv.investedAmount || 0,
          inv.interestRate || 0,
          inv.interestRateType || 'yearly',
          inv.tenureMonths || 0,
          inv.investmentPlan || 'custom',
          inv.payoutFrequency || 'monthly',
          inv.monthlyInterest || 0,
          inv.totalInterest || 0,
          inv.totalPayout || 0,
          inv.startDate ? new Date(inv.startDate) : new Date(),
          inv.maturityDate ? new Date(inv.maturityDate) : null,
          JSON.stringify(inv.linkedBorrowers || []),
          inv.status || 'Active',
          inv.notes || '',
          inv.createdAt ? new Date(inv.createdAt) : new Date(),
          inv.updatedAt ? new Date(inv.updatedAt) : new Date(),
        ]
      );
      stats.investor_investments++;
    }
    console.log(`Migrated ${stats.investor_investments} investor investments.`);
  }

  // 10. Migrate Investor Payments
  const paymentsCol = getColName('investorpayments', 'investor_payments', 'investorpayment', 'payments');
  if (paymentsCol) {
    console.log(`Migrating investor payments from ${paymentsCol}...`);
    const payments = await mongoDb.collection(paymentsCol).find({}).toArray();
    for (const p of payments) {
      const id = p.id || (p._id ? p._id.toString() : null);
      if (!id || !p.investmentId) continue;
      await query(
        `INSERT INTO investor_payments (
           id, investment_id, investor_name, payment_date, due_date,
           amount_paid, interest_paid, principal_paid, pending_interest,
           payment_frequency, payment_mode, status, remarks, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           amount_paid = EXCLUDED.amount_paid,
           interest_paid = EXCLUDED.interest_paid,
           principal_paid = EXCLUDED.principal_paid,
           pending_interest = EXCLUDED.pending_interest`,
        [
          id,
          p.investmentId,
          p.investorName || '',
          p.paymentDate ? new Date(p.paymentDate) : new Date(),
          p.dueDate ? new Date(p.dueDate) : null,
          p.amountPaid || 0,
          p.interestPaid || 0,
          p.principalPaid || 0,
          p.pendingInterest || 0,
          p.paymentFrequency || 'monthly',
          p.paymentMode || 'Bank Transfer',
          p.status || 'Pending',
          p.remarks || '',
          p.createdAt ? new Date(p.createdAt) : new Date(),
        ]
      );
      stats.investor_payments++;
    }
    console.log(`Migrated ${stats.investor_payments} investor payments.`);
  }

  console.log('Data migration complete! Summary of migrated documents:', stats);
  await mongoose.disconnect();
  await pool.end();
}

migrateData().catch((err) => {
  console.error('Migration failed:', sanitizeLog(err?.message || err));
  process.exit(1);
});
