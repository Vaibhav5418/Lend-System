import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query, transaction, isDbConnected, checkConnection } from '../src/db/index.js';
import User from '../src/models/User.js';
import Staff from '../src/models/Staff.js';
import Agent from '../src/models/Agent.js';
import Inquiry from '../src/models/Inquiry.js';
import Document from '../src/models/Document.js';
import Proposal from '../src/models/Proposal.js';
import BorrowerLoan from '../src/models/BorrowerLoan.js';
import BorrowerCollection from '../src/models/BorrowerCollection.js';
import InvestorInvestment from '../src/models/InvestorInvestment.js';
import InvestorPayment from '../src/models/InvestorPayment.js';
import { updateInquiryStage } from '../src/services/stageService.js';

describe('PostgreSQL Database & Model Integration Tests', () => {
  const testRunId = Date.now().toString().slice(-6);
  const testEmail = `test_user_${testRunId}@lendflow.example.com`;
  const testInquiryId = `INQ-${testRunId}`;
  const testProposalId = `PROP-${testRunId}`;
  const testLoanId = `LOAN-${testRunId}`;
  const testCollectionId = `COL-${testRunId}`;
  const testInvestmentId = `INV-${testRunId}`;
  const testPaymentId = `IPAY-${testRunId}`;
  let createdUserId;
  let createdDocId;

  before(async () => {
    const connected = await checkConnection();
    assert.equal(connected, true, 'Neon PostgreSQL must be reachable');
  });

  after(async () => {
    // Clean up created test entities
    if (createdDocId) await Document.deleteOne({ _id: createdDocId });
    await InvestorPayment.findOneAndDelete({ id: testPaymentId });
    await InvestorInvestment.findOneAndDelete({ id: testInvestmentId });
    await BorrowerCollection.findOneAndDelete({ id: testCollectionId });
    await BorrowerLoan.findOneAndDelete({ id: testLoanId });
    await Proposal.findOneAndDelete({ id: testProposalId });
    await Inquiry.findOneAndDelete({ id: testInquiryId });
    if (createdUserId) await query('DELETE FROM users WHERE id = $1', [createdUserId]);
  });

  describe('1. Connectivity & Transaction Safety', () => {
    it('should confirm active database connection', async () => {
      assert.equal(isDbConnected(), true);
      const res = await query('SELECT 1 as val');
      assert.equal(res.rows[0].val, 1);
    });

    it('should roll back changes on transaction error', async () => {
      const rollbackEmail = `rollback_${testRunId}@test.com`;
      await assert.rejects(async () => {
        await transaction(async (client) => {
          await client.query(
            'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
            ['111111111111111111111111', 'Rollback User', rollbackEmail, 'hashedpass']
          );
          throw new Error('Intentional transaction abort');
        });
      });

      const check = await query('SELECT * FROM users WHERE email = $1', [rollbackEmail]);
      assert.equal(check.rows.length, 0, 'Rolled-back record must not exist');
    });

    it('should resist SQL injection via parameterized queries', async () => {
      const maliciousInput = "' OR '1'='1";
      const res = await query('SELECT * FROM users WHERE email = $1', [maliciousInput]);
      assert.equal(res.rows.length, 0);
    });
  });

  describe('2. User Model & Password Hashing', () => {
    it('should create user with 24-char hex ID and bcrypt password', async () => {
      const user = await User.create({
        name: 'Integration Tester',
        email: testEmail,
        password: 'securePassword123',
      });

      assert.ok(user.id);
      assert.equal(user.id.length, 24);
      assert.match(user.id, /^[a-f0-9]{24}$/i);
      assert.equal(user._id.toString(), user.id);
      assert.equal(user.email, testEmail.toLowerCase());
      assert.notEqual(user.password, 'securePassword123', 'Password must be hashed');

      createdUserId = user.id;

      const validPassword = await user.comparePassword('securePassword123');
      assert.equal(validPassword, true);

      const invalidPassword = await user.comparePassword('wrongPassword');
      assert.equal(invalidPassword, false);
    });

    it('should find user by email and by ID', async () => {
      const byEmail = await User.findOne({ email: testEmail });
      assert.ok(byEmail);
      assert.equal(byEmail.id, createdUserId);

      const byId = await User.findById(createdUserId);
      assert.ok(byId);
      assert.equal(byId.email, testEmail.toLowerCase());
    });
  });

  describe('3. Staff & Agents', () => {
    it('should fetch staff list from PostgreSQL', async () => {
      const staffList = await Staff.find().sort({ order: 1 }).lean();
      assert.ok(Array.isArray(staffList));
      assert.ok(staffList.length > 0);
      assert.ok(staffList.some((s) => s.name === 'Amit Shah'));
    });

    it('should query agents list with sorting', async () => {
      const agents = await Agent.find().sort({ totalInquiries: -1 }).lean();
      assert.ok(Array.isArray(agents));
    });
  });

  describe('4. Inquiries & Stage Transitions', () => {
    it('should create inquiry with JSONB details and activity log', async () => {
      const inquiry = await Inquiry.create({
        id: testInquiryId,
        type: 'Borrower',
        name: 'Acme Logistics',
        mobile: '9876543210',
        email: 'contact@acmelogistics.in',
        city: 'Mumbai',
        source: 'Website',
        priority: 'Hot',
        assignedTo: 'Amit Shah',
        stage: 'NEW',
        lastActivity: 'Inquiry created',
        borrowerDetails: {
          loanAmount: 500000,
          tenure: 12,
          proposedInterest: 14,
        },
        activityLogs: [
          { action: 'Inquiry created', newStage: 'NEW', changedAt: new Date() },
        ],
      });

      assert.equal(inquiry.id, testInquiryId);
      assert.equal(inquiry.borrowerDetails.loanAmount, 500000);
      assert.equal(inquiry.activityLogs.length, 1);
    });

    it('should update inquiry stage and append to activityLogs via stageService', async () => {
      const result = await updateInquiryStage(testInquiryId, 'VERIFIED');
      assert.equal(result.success, true);
      assert.equal(result.inquiry.stage, 'VERIFIED');
      assert.ok(result.inquiry.activityLogs.length >= 2);
    });
  });

  describe('5. Documents', () => {
    it('should create, list, and delete inquiry document', async () => {
      const doc = await Document.create({
        inquiryId: testInquiryId,
        fileName: 'bank_statement.pdf',
        mimeType: 'application/pdf',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
        publicId: 'sample_id',
        storageProvider: 'cloudinary',
        summary: 'Extracted financial statement',
      });

      assert.ok(doc.id);
      assert.equal(doc.id.length, 24);
      assert.equal(doc._id, doc.id);
      createdDocId = doc.id;

      const docs = await Document.find({ inquiryId: testInquiryId }).lean();
      assert.ok(docs.some((d) => d.id === createdDocId));

      const updated = await Document.findByIdAndUpdate(createdDocId, {
        $set: { summary: 'Updated AI Summary' },
      }).lean();
      assert.equal(updated.summary, 'Updated AI Summary');

      await Document.deleteOne({ _id: createdDocId, inquiryId: testInquiryId });
      const verifyDeleted = await Document.findOne({ _id: createdDocId });
      assert.equal(verifyDeleted, null);
      createdDocId = null;
    });
  });

  describe('6. Proposals', () => {
    it('should create proposal and handle status updates', async () => {
      const prop = await Proposal.create({
        id: testProposalId,
        inquiryId: testInquiryId,
        borrowerName: 'Acme Logistics',
        originalLoanAmount: 500000,
        originalInterestRate: 14,
        originalTenure: 12,
        proposedLoanAmount: 450000,
        proposedInterestRate: 13.5,
        proposedTenure: 12,
        status: 'Sent',
        history: [
          {
            proposedLoanAmount: 450000,
            proposedInterestRate: 13.5,
            proposedTenure: 12,
            action: 'Sent',
            timestamp: new Date(),
          },
        ],
      });

      assert.equal(prop.id, testProposalId);
      assert.equal(prop.proposedLoanAmount, 450000);

      const found = await Proposal.findOne({ id: testProposalId });
      assert.ok(found);
      found.status = 'Counter';
      found.proposedLoanAmount = 480000;
      found.history.push({
        proposedLoanAmount: 480000,
        action: 'Counter',
        timestamp: new Date(),
      });
      await found.save();

      const afterUpdate = await Proposal.findOne({ id: testProposalId }).lean();
      assert.equal(afterUpdate.status, 'Counter');
      assert.equal(afterUpdate.proposedLoanAmount, 480000);
      assert.equal(afterUpdate.history.length, 2);
    });
  });

  describe('7. Borrower Loans & Collections', () => {
    it('should create loan and automatically compute interest and schedule', async () => {
      const loan = new BorrowerLoan({
        id: testLoanId,
        inquiryId: testInquiryId,
        borrowerName: 'Acme Logistics',
        approvedAmount: 100000,
        interestRate: 12,
        interestRateType: 'yearly',
        tenureMonths: 12,
        repaymentType: 'Interest-Only',
        startDate: new Date('2026-01-01'),
      });

      await loan.save();

      // Monthly interest: 100000 * (12/12/100) = 1000
      assert.equal(loan.monthlyInterest, 1000);
      assert.equal(loan.totalInterest, 12000);
      assert.equal(loan.totalRepayable, 112000);
      assert.ok(loan.endDate);
    });

    it('should record collection and calculate totalPaid and overdue', async () => {
      const col = new BorrowerCollection({
        id: testCollectionId,
        loanId: testLoanId,
        borrowerName: 'Acme Logistics',
        paymentDate: new Date('2026-02-05'),
        dueDate: new Date('2026-02-01'),
        scheduleMonth: 1,
        interestPaid: 1000,
        principalPaid: 0,
        status: 'Received',
      });

      await col.save();

      assert.equal(col.totalPaid, 1000);
      assert.equal(col.status, 'Received');
    });
  });

  describe('8. Investor Investments & Payouts', () => {
    it('should create investment and calculate interest, payout, and maturity', async () => {
      const inv = new InvestorInvestment({
        id: testInvestmentId,
        inquiryId: testInquiryId,
        investorName: 'High Networth Capital',
        investedAmount: 200000,
        interestRate: 10,
        interestRateType: 'yearly',
        tenureMonths: 12,
        payoutFrequency: 'monthly',
        startDate: new Date('2026-01-01'),
      });

      await inv.save();

      // Monthly: 200000 * 10 / 12 / 100 = 1666.67
      assert.equal(inv.monthlyInterest, 1666.67);
      assert.equal(inv.totalInterest, 20000.04);
      assert.equal(inv.totalPayout, 220000.04);
      assert.ok(inv.maturityDate);
    });

    it('should record investor payout and auto-calculate amountPaid', async () => {
      const payment = new InvestorPayment({
        id: testPaymentId,
        investmentId: testInvestmentId,
        investorName: 'High Networth Capital',
        paymentDate: new Date('2026-02-01'),
        interestPaid: 1666.67,
        principalPaid: 0,
        status: 'Paid',
      });

      await payment.save();

      assert.equal(payment.amountPaid, 1666.67);
      assert.equal(payment.status, 'Paid');
    });
  });
});
