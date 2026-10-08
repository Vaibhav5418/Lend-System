import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import borrowerLoanRoutes from '../src/routes/borrowerLoans.js';
import investorRoutes from '../src/routes/investor.js';
import proposalRoutes from '../src/routes/proposals.js';
import inquiryRoutes from '../src/routes/inquiries.js';
import documentRoutes from '../src/routes/documents.js';

describe('Express Route Security Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/api/health', (_, res) => res.json({ ok: true }));
    app.use('/api/borrower', borrowerLoanRoutes);
    app.use('/api/investor', investorRoutes);
    app.use('/api/proposals', proposalRoutes);
    app.use('/api/inquiries/:inquiryId/documents', documentRoutes);
    app.use('/api/inquiries', inquiryRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('NoSQL Injection Query Operator Rejection', () => {
    it('should reject operator object in /api/borrower/collections?loanId[$ne]=null', async () => {
      const res = await fetch(`${baseUrl}/api/borrower/collections?loanId[$ne]=null`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /must be a scalar string/);
    });

    it('should reject operator object in /api/investor/payments?investmentId[$gt]=', async () => {
      const res = await fetch(`${baseUrl}/api/investor/payments?investmentId[$gt]=`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /must be a scalar string/);
    });

    it('should reject operator object in /api/proposals?inquiryId[$regex]=.*', async () => {
      const res = await fetch(`${baseUrl}/api/proposals?inquiryId[$regex]=.*`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /must be a scalar string/);
    });

    it('should reject invalid non-matching ID format query string', async () => {
      const res = await fetch(`${baseUrl}/api/borrower/collections?loanId=MALICIOUS_INPUT`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid loanId format/);
    });
  });

  describe('Route Parameter Validation', () => {
    it('should reject invalid loan ID format in GET /api/borrower/loans/:id', async () => {
      const res = await fetch(`${baseUrl}/api/borrower/loans/invalid-id-format`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid loan ID format');
    });

    it('should reject invalid investment ID format in GET /api/investor/investments/:id', async () => {
      const res = await fetch(`${baseUrl}/api/investor/investments/12345`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid investment ID format');
    });

    it('should reject invalid proposal ID format in GET /api/proposals/:id', async () => {
      const res = await fetch(`${baseUrl}/api/proposals/PROP-XYZ`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid proposal ID format');
    });

    it('should reject invalid inquiry ID format in GET /api/inquiries/:id', async () => {
      const res = await fetch(`${baseUrl}/api/inquiries/not-an-inquiry-id`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid inquiry ID format');
    });

    it('should reject invalid document ID format in GET /api/inquiries/INQ-001/documents/:docId/view', async () => {
      const res = await fetch(`${baseUrl}/api/inquiries/INQ-001/documents/not-a-mongo-id/view`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid document ID format');
    });
  });

  describe('Proposal Status Transition Allowlist', () => {
    it('should reject unauthorized proposal status in PATCH /api/proposals/:id/status', async () => {
      const res = await fetch(`${baseUrl}/api/proposals/PROP-001/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UnauthorizedCustomStatus' }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Accepted, Rejected, or Counter/);
    });

    it('should reject missing status in PATCH /api/proposals/:id/status', async () => {
      const res = await fetch(`${baseUrl}/api/proposals/PROP-001/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
    });
  });

  describe('Financial Input Range & Type Enforcement', () => {
    it('should reject negative approvedAmount in POST /api/borrower/loans', async () => {
      const res = await fetch(`${baseUrl}/api/borrower/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: 'INQ-001',
          borrowerName: 'Test Borrower',
          approvedAmount: -50000,
          interestRate: 12,
          tenureMonths: 12,
        }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /approvedAmount/);
    });

    it('should reject negative interest rate in POST /api/borrower/loans', async () => {
      const res = await fetch(`${baseUrl}/api/borrower/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: 'INQ-001',
          borrowerName: 'Test Borrower',
          approvedAmount: 50000,
          interestRate: -5,
          tenureMonths: 12,
        }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /interestRate/);
    });

    it('should reject fractional tenure in POST /api/investor/investments', async () => {
      const res = await fetch(`${baseUrl}/api/investor/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: 'INQ-001',
          investorName: 'Test Investor',
          investedAmount: 100000,
          interestRate: 10,
          tenureMonths: 6.5,
        }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /tenureMonths/);
    });
  });

  describe('Document Upload Validation', () => {
    it('should reject upload without file', async () => {
      const res = await fetch(`${baseUrl}/api/inquiries/INQ-001/documents`, {
        method: 'POST',
      });
      assert.equal(res.status, 400);
    });

    it('should reject invalid inquiry ID on document upload', async () => {
      const res = await fetch(`${baseUrl}/api/inquiries/INVALID_INQ/documents`, {
        method: 'POST',
      });
      assert.equal(res.status, 400);
    });
  });

  describe('HTTP Header Hardening', () => {
    it('should not disclose X-Powered-By header', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-powered-by'), null);
    });
  });
});
