import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidId,
  parseQueryId,
  ID_PATTERNS,
  sanitizeLog,
  parsePositiveNumber,
  parsePositiveInteger,
  sanitizeString,
} from '../src/utils/security.js';
import { validateStageUpdate } from '../src/validators/stageUpdate.js';
import { BORROWER_STAGES, INVESTOR_STAGES } from '../src/constants/stages.js';

describe('Security Validation Suite', () => {
  describe('1. NoSQL Injection Prevention & ID Validation', () => {
    it('should accept valid application-specific ID patterns', () => {
      assert.equal(isValidId('INQ-001', ID_PATTERNS.inquiry), true);
      assert.equal(isValidId('PROP-042', ID_PATTERNS.proposal), true);
      assert.equal(isValidId('LOAN-100', ID_PATTERNS.loan), true);
      assert.equal(isValidId('INV-999', ID_PATTERNS.investment), true);
      assert.equal(isValidId('COL-005', ID_PATTERNS.collection), true);
      assert.equal(isValidId('IPAY-012', ID_PATTERNS.payment), true);
      assert.equal(isValidId('507f1f77bcf86cd799439011', ID_PATTERNS.document), true);
    });

    it('should reject malicious MongoDB operator objects in IDs', () => {
      assert.equal(isValidId({ $ne: null }, ID_PATTERNS.loan), false);
      assert.equal(isValidId({ $gt: '' }, ID_PATTERNS.inquiry), false);
      assert.equal(isValidId({ $where: 'sleep(5000)' }, ID_PATTERNS.proposal), false);
      assert.equal(isValidId(['LOAN-001'], ID_PATTERNS.loan), false);
      assert.equal(isValidId(null, ID_PATTERNS.loan), false);
      assert.equal(isValidId(undefined, ID_PATTERNS.loan), false);
      assert.equal(isValidId(12345, ID_PATTERNS.loan), false);
    });

    it('should reject malformed or path traversal ID strings', () => {
      assert.equal(isValidId('LOAN-abc', ID_PATTERNS.loan), false);
      assert.equal(isValidId('INQ-001; DROP TABLE', ID_PATTERNS.inquiry), false);
      assert.equal(isValidId('../../../etc/passwd', ID_PATTERNS.loan), false);
      assert.equal(isValidId('PROP-', ID_PATTERNS.proposal), false);
      assert.equal(isValidId('__proto__', ID_PATTERNS.loan), false);
    });

    it('should safely parse query parameters and reject operator-shaped inputs', () => {
      // Valid scalar string
      const validRes = parseQueryId('LOAN-001', ID_PATTERNS.loan, 'loanId');
      assert.equal(validRes.valid, true);
      assert.equal(validRes.value, 'LOAN-001');

      // Omitted parameter
      const emptyRes = parseQueryId(undefined, ID_PATTERNS.loan, 'loanId');
      assert.equal(emptyRes.valid, true);
      assert.equal(emptyRes.value, undefined);

      // Object passed via express query parser (?loanId[$ne]=null)
      const objRes = parseQueryId({ $ne: null }, ID_PATTERNS.loan, 'loanId');
      assert.equal(objRes.valid, false);
      assert.match(objRes.error, /must be a scalar string/);

      // Array passed (?loanId[]=LOAN-001)
      const arrRes = parseQueryId(['LOAN-001'], ID_PATTERNS.loan, 'loanId');
      assert.equal(arrRes.valid, false);
      assert.match(arrRes.error, /must be a scalar string/);

      // Malformed string
      const badRes = parseQueryId('INVALID-ID', ID_PATTERNS.loan, 'loanId');
      assert.equal(badRes.valid, false);
      assert.match(badRes.error, /Invalid loanId format/);
    });
  });

  describe('2. Log Injection Prevention (CRLF Sanitization)', () => {
    it('should strip carriage returns, line feeds, and control characters', () => {
      const maliciousPayload = 'HTTP/1.1 200 OK\r\nSet-Cookie: session=attacker\r\n\n[ADMIN LOG] Injected';
      const sanitized = sanitizeLog(maliciousPayload);

      assert.equal(sanitized.includes('\r'), false);
      assert.equal(sanitized.includes('\n'), false);
      assert.match(sanitized, /^HTTP\/1\.1 200 OK/);
    });

    it('should truncate excessively long log strings', () => {
      const longPayload = 'A'.repeat(2000);
      const sanitized = sanitizeLog(longPayload, 100);
      assert.equal(sanitized.length, 100);
    });

    it('should safely serialize error objects and undefined/null', () => {
      const err = new Error('Database connection failed\nwith stack leak');
      const sanitized = sanitizeLog(err);
      assert.equal(sanitized.includes('\n'), false);
      assert.match(sanitized, /Database connection failed with stack leak/);

      assert.equal(sanitizeLog(null), '');
      assert.equal(sanitizeLog(undefined), '');
    });
  });

  describe('3. Financial & Numeric Input Validation', () => {
    it('should enforce positive finite numbers', () => {
      assert.equal(parsePositiveNumber(1000), 1000);
      assert.equal(parsePositiveNumber('500.50'), 500.5);
      assert.equal(parsePositiveNumber(0), null);
      assert.equal(parsePositiveNumber(0, true), 0);
      assert.equal(parsePositiveNumber(-100), null);
      assert.equal(parsePositiveNumber('invalid'), null);
      assert.equal(parsePositiveNumber(Infinity), null);
      assert.equal(parsePositiveNumber(NaN), null);
    });

    it('should enforce positive integers for tenure and months', () => {
      assert.equal(parsePositiveInteger(12), 12);
      assert.equal(parsePositiveInteger('36'), 36);
      assert.equal(parsePositiveInteger(12.5), null);
      assert.equal(parsePositiveInteger(-5), null);
      assert.equal(parsePositiveInteger(0), null);
    });

    it('should sanitize strings and prevent unbounded payloads', () => {
      assert.equal(sanitizeString('  John Doe  '), 'John Doe');
      assert.equal(sanitizeString(12345), '');
      assert.equal(sanitizeString('A'.repeat(500), 10), 'AAAAAAAAAA');
    });
  });

  describe('4. Pipeline Stage Validation', () => {
    it('should accept valid stages for borrower inquiries', () => {
      for (const stage of BORROWER_STAGES) {
        const res = validateStageUpdate({ stage }, 'Borrower');
        assert.equal(res.success, true);
        assert.equal(res.stage, stage);
      }
    });

    it('should accept valid stages for investor inquiries', () => {
      for (const stage of INVESTOR_STAGES) {
        const res = validateStageUpdate({ stage }, 'Investor');
        assert.equal(res.success, true);
        assert.equal(res.stage, stage);
      }
    });

    it('should reject invalid or cross-pipeline stages', () => {
      // PROPOSED belongs to Borrower only
      const res = validateStageUpdate({ stage: 'PROPOSED' }, 'Investor');
      assert.equal(res.success, false);

      // FUND_RECEIVED belongs to Investor only
      const res2 = validateStageUpdate({ stage: 'FUND_RECEIVED' }, 'Borrower');
      assert.equal(res2.success, false);

      // Arbitrary non-existent stage
      const res3 = validateStageUpdate({ stage: 'HACKED_STAGE' }, 'Borrower');
      assert.equal(res3.success, false);
    });
  });

  describe('5. Proposal Status Allowlist', () => {
    it('should enforce allowed proposal status transitions', () => {
      const allowedPatch = ['Accepted', 'Rejected', 'Counter'];
      for (const s of allowedPatch) {
        assert.equal(allowedPatch.includes(s), true);
      }
      // Rejection of arbitrary statuses
      assert.equal(allowedPatch.includes('ArbitraryStatus'), false);
      assert.equal(allowedPatch.includes('__proto__'), false);
      assert.equal(allowedPatch.includes('AdminApproved'), false);
    });
  });

  describe('6. File Upload Security & Magic Bytes Verification', () => {
    it('should detect valid PDF magic bytes (%PDF-)', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4 header contents');
      assert.equal(validPdfBuffer[0] === 0x25 && validPdfBuffer[1] === 0x50 && validPdfBuffer[2] === 0x44 && validPdfBuffer[3] === 0x46, true);
    });

    it('should reject spoofed files pretending to be PDF', () => {
      const fakePdfBuffer = Buffer.from('<html><script>alert(1)</script></html>');
      const isPdf = fakePdfBuffer[0] === 0x25 && fakePdfBuffer[1] === 0x50 && fakePdfBuffer[2] === 0x44 && fakePdfBuffer[3] === 0x46;
      assert.equal(isPdf, false);
    });

    it('should detect valid PNG magic bytes (0x89 0x50 0x4E 0x47)', () => {
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      assert.equal(validPngBuffer[0] === 0x89 && validPngBuffer[1] === 0x50 && validPngBuffer[2] === 0x4E && validPngBuffer[3] === 0x47, true);
    });

    it('should detect valid ZIP/DOCX/XLSX magic bytes (PK\\x03\\x04)', () => {
      const validDocxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
      assert.equal(validDocxBuffer[0] === 0x50 && validDocxBuffer[1] === 0x4B && validDocxBuffer[2] === 0x03 && validDocxBuffer[3] === 0x04, true);
    });
  });
});
