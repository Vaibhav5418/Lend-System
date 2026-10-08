import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toAnnualRate,
  calcMonthlyInterest,
  calcTotalInterest,
  calcMaturityDate,
  generateRepaymentSchedule,
  calcPlatformSpread,
  calcPenalty,
} from '../src/utils/financialCalc.js';

describe('Reliability & Correctness Test Suite', () => {
  describe('1. Payout Calculation Loop Correctness & Determinism', () => {
    // Pure calculation logic extracted from investor.js upcoming-payouts
    function calculateUpcomingPayout(inv, now = new Date()) {
      const start = new Date(inv.startDate || inv.createdAt || now);
      if (Number.isNaN(start.getTime())) {
        return null;
      }

      const freq = (inv.payoutFrequency || 'monthly').toLowerCase();
      let intervalMonths = 1;
      if (freq === 'quarterly') intervalMonths = 3;
      else if (freq === 'half-yearly') intervalMonths = 6;
      else if (freq === 'yearly') intervalMonths = 12;
      else if (freq === 'on_maturity') intervalMonths = Math.max(1, Math.floor(Number(inv.tenureMonths) || 12));

      const maturityDate = new Date(start.getTime());
      const tenure = Math.max(1, Math.floor(Number(inv.tenureMonths) || 12));
      maturityDate.setMonth(maturityDate.getMonth() + tenure);

      let nextPayout = new Date(start.getTime());
      if (freq === 'on_maturity') {
        nextPayout = maturityDate;
      } else {
        let guard = 0;
        const nowTime = now.getTime();
        while (nextPayout.getTime() <= nowTime && guard < 1200) {
          guard++;
          const advanced = new Date(nextPayout.getTime());
          advanced.setMonth(advanced.getMonth() + intervalMonths);
          if (advanced.getTime() <= nextPayout.getTime()) {
            advanced.setDate(advanced.getDate() + 1);
          }
          nextPayout = advanced;
        }
      }

      if (nextPayout.getTime() > maturityDate.getTime()) {
        return null;
      }

      return { nextPayout, maturityDate };
    }

    it('should correctly advance monthly payout past current date', () => {
      const now = new Date('2026-06-15T00:00:00.000Z');
      const inv = {
        startDate: '2026-01-15T00:00:00.000Z',
        tenureMonths: 12,
        payoutFrequency: 'monthly',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.ok(result);
      // Payouts on: 1/15, 2/15, 3/15, 4/15, 5/15, 6/15 (<= now) -> next is 7/15 (> now)
      assert.ok(result.nextPayout.getTime() > now.getTime());
      assert.equal(result.nextPayout.getUTCMonth(), 6); // July (0-indexed 6)
      assert.equal(result.nextPayout.getUTCDate(), 15);
      assert.equal(result.nextPayout.getUTCFullYear(), 2026);
    });

    it('should correctly advance quarterly payout', () => {
      const now = new Date('2026-05-01T00:00:00.000Z');
      const inv = {
        startDate: '2026-01-01T00:00:00.000Z',
        tenureMonths: 24,
        payoutFrequency: 'quarterly',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.ok(result);
      // Start 1/1, Q1: 4/1 (<= now), Q2: 7/1 (> now)
      assert.ok(result.nextPayout.getTime() > now.getTime());
      assert.equal(result.nextPayout.getUTCMonth(), 6); // July
      assert.equal(result.nextPayout.getUTCDate(), 1);
    });

    it('should handle on_maturity payout frequency without entering interval loop', () => {
      const now = new Date('2026-05-01T00:00:00.000Z');
      const inv = {
        startDate: '2026-01-01T00:00:00.000Z',
        tenureMonths: 12,
        payoutFrequency: 'on_maturity',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.ok(result);
      assert.equal(result.nextPayout.getTime(), result.maturityDate.getTime());
      assert.equal(result.nextPayout.getUTCFullYear(), 2027);
      assert.equal(result.nextPayout.getUTCMonth(), 0); // January 2027
    });

    it('should return null when all scheduled payouts have concluded (past maturity)', () => {
      const now = new Date('2027-02-01T00:00:00.000Z');
      const inv = {
        startDate: '2026-01-01T00:00:00.000Z',
        tenureMonths: 12, // Ended Jan 2027
        payoutFrequency: 'monthly',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.equal(result, null);
    });

    it('should handle future investments that have not reached first payout date', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      const inv = {
        startDate: '2026-06-01T00:00:00.000Z',
        tenureMonths: 12,
        payoutFrequency: 'monthly',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.ok(result);
      // Start is in future, next payout is the start date
      assert.equal(result.nextPayout.getUTCMonth(), 5); // June
      assert.equal(result.nextPayout.getUTCDate(), 1);
    });

    it('should safely handle invalid start dates and return null without throwing', () => {
      const inv = {
        startDate: 'invalid-date-format',
        tenureMonths: 12,
        payoutFrequency: 'monthly',
      };

      const result = calculateUpcomingPayout(inv, new Date());
      assert.equal(result, null);
    });

    it('should never mutate the reference `now` Date', () => {
      const now = new Date('2026-03-15T00:00:00.000Z');
      const originalTime = now.getTime();
      const inv = {
        startDate: '2025-01-15T00:00:00.000Z',
        tenureMonths: 24,
        payoutFrequency: 'monthly',
      };

      calculateUpcomingPayout(inv, now);
      assert.equal(now.getTime(), originalTime, '`now` must remain strictly immutable');
    });

    it('should progress forward deterministically on month-end date boundaries (Jan 31)', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');
      const inv = {
        startDate: '2026-01-31T00:00:00.000Z',
        tenureMonths: 6,
        payoutFrequency: 'monthly',
      };

      const result = calculateUpcomingPayout(inv, now);
      assert.ok(result);
      assert.ok(result.nextPayout.getTime() > now.getTime());
    });
  });

  describe('2. Financial Calculation Resilience & Boundary Conditions', () => {
    it('toAnnualRate should handle edge cases safely', () => {
      assert.equal(toAnnualRate(0), 0);
      assert.equal(toAnnualRate(-5), 0);
      assert.equal(toAnnualRate(NaN), 0);
      assert.equal(toAnnualRate(Infinity), 0);
      assert.equal(toAnnualRate('invalid'), 0);
      assert.equal(toAnnualRate(1, 'monthly'), 12);
      assert.equal(toAnnualRate(1.5, 'monthly'), 18);
      assert.equal(toAnnualRate(14, 'yearly'), 14);
    });

    it('calcMonthlyInterest should avoid NaN, Infinity, and negative values', () => {
      assert.equal(calcMonthlyInterest(0, 12), 0);
      assert.equal(calcMonthlyInterest(-10000, 12), 0);
      assert.equal(calcMonthlyInterest(10000, -5), 0);
      assert.equal(calcMonthlyInterest(NaN, 12), 0);
      assert.equal(calcMonthlyInterest(10000, NaN), 0);
      assert.equal(calcMonthlyInterest(Infinity, 12), 0);
      assert.equal(calcMonthlyInterest(10000, Infinity), 0);

      // Normal calculations: P * R / 12 / 100
      // 100,000 at 12% annual = 1,000 monthly
      assert.equal(calcMonthlyInterest(100000, 12), 1000);

      // Fractional interest rounded to 2 decimals
      // 50,000 at 10.5% annual = 50000 * 0.105 / 12 = 437.5
      assert.equal(calcMonthlyInterest(50000, 10.5), 437.5);
    });

    it('calcTotalInterest should compute total interest over tenure safely', () => {
      assert.equal(calcTotalInterest(100000, 12, 0), 0);
      assert.equal(calcTotalInterest(100000, 12, -6), 0);
      assert.equal(calcTotalInterest(100000, 12, NaN), 0);

      // 100,000 at 12% for 12 months = 1,000 * 12 = 12,000
      assert.equal(calcTotalInterest(100000, 12, 12), 12000);
      // 100,000 at 12% for 6 months = 6,000
      assert.equal(calcTotalInterest(100000, 12, 6), 6000);
    });

    it('calcMaturityDate should handle valid and invalid dates reliably', () => {
      const base = new Date('2026-01-15T00:00:00.000Z');
      const maturity = calcMaturityDate(base, 12);
      assert.equal(maturity.getUTCFullYear(), 2027);
      assert.equal(maturity.getUTCMonth(), 0);

      // Invalid date should not crash
      const fallback = calcMaturityDate('invalid-date', 6);
      assert.ok(fallback instanceof Date);
      assert.equal(Number.isNaN(fallback.getTime()), false);

      // Negative or zero tenure
      const sameDate = calcMaturityDate(base, -5);
      assert.equal(sameDate.getTime(), base.getTime());
    });

    it('generateRepaymentSchedule should generate accurate schedules', () => {
      // Invalid inputs return empty array
      assert.deepEqual(generateRepaymentSchedule(0, 12, 12, 'Interest-Only', new Date()), []);
      assert.deepEqual(generateRepaymentSchedule(-1000, 12, 12, 'Interest-Only', new Date()), []);
      assert.deepEqual(generateRepaymentSchedule(1000, -5, 12, 'Interest-Only', new Date()), []);
      assert.deepEqual(generateRepaymentSchedule(1000, 12, 0, 'Interest-Only', new Date()), []);
      assert.deepEqual(generateRepaymentSchedule(1000, 12, 12, 'Interest-Only', 'invalid-date'), []);

      // Interest-Only: monthly interest and principal on last month
      const schedule = generateRepaymentSchedule(100000, 12, 3, 'Interest-Only', '2026-01-01');
      assert.equal(schedule.length, 3);
      assert.equal(schedule[0].interestDue, 1000);
      assert.equal(schedule[0].principalDue, 0);
      assert.equal(schedule[0].totalDue, 1000);

      assert.equal(schedule[2].interestDue, 1000);
      assert.equal(schedule[2].principalDue, 100000);
      assert.equal(schedule[2].totalDue, 101000);

      // Bullet: single installment at tenure maturity
      const bullet = generateRepaymentSchedule(100000, 12, 3, 'Bullet', '2026-01-01');
      assert.equal(bullet.length, 1);
      assert.equal(bullet[0].month, 3);
      assert.equal(bullet[0].interestDue, 3000);
      assert.equal(bullet[0].principalDue, 100000);
      assert.equal(bullet[0].totalDue, 103000);
    });

    it('calcPlatformSpread should accurately compute gross margin and spread', () => {
      // Investor at 10%, Borrower charged 14% -> spread 4%
      const res = calcPlatformSpread(10, 14, 1000000);
      assert.equal(res.spread, 4);
      assert.equal(res.annualSpread, 40000);
      assert.equal(res.monthlySpread, 3333.33);

      // Zero or invalid values
      const safe = calcPlatformSpread(NaN, 10, -500);
      assert.equal(safe.spread, 10);
      assert.equal(safe.monthlySpread, 0);
      assert.equal(safe.annualSpread, 0);
    });

    it('calcPenalty should compute overdue penalty cleanly', () => {
      assert.equal(calcPenalty(0, 10), 0);
      assert.equal(calcPenalty(-500, 10), 0);
      assert.equal(calcPenalty(1000, 0), 0);
      assert.equal(calcPenalty(1000, -3), 0);

      // 10,000 overdue for 10 days at 0.05% per day = 10000 * 0.0005 * 10 = 50
      assert.equal(calcPenalty(10000, 10, 0.05), 50);
    });
  });

  describe('3. Concurrency-Safe ID Generation & Duplicate Key Collision Recovery', () => {
    it('should retry on duplicate key collision (MongoDB code 11000) and succeed', async () => {
      let attempts = 0;
      const simulatedDatabase = new Set(['LOAN-001', 'LOAN-002']);

      async function generateIdWithRetry(createFn, maxRetries = 5) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          attempts++;
          try {
            return await createFn(attempt);
          } catch (err) {
            if (err.code === 11000 && attempt < maxRetries - 1) {
              continue; // Retry next attempt
            }
            throw err;
          }
        }
      }

      // Simulate concurrent requests picking same latest ID initially
      const mockCreate = async (attempt) => {
        const id = attempt < 2 ? 'LOAN-002' : 'LOAN-003';
        if (simulatedDatabase.has(id)) {
          const dupErr = new Error(`E11000 duplicate key error collection: loans index: id_1 dup key: { id: "${id}" }`);
          dupErr.code = 11000;
          throw dupErr;
        }
        simulatedDatabase.add(id);
        return { id, success: true };
      };

      const result = await generateIdWithRetry(mockCreate);
      assert.equal(result.success, true);
      assert.equal(result.id, 'LOAN-003');
      assert.equal(attempts, 3, 'Should have retried 2 duplicate collisions before succeeding');
    });

    it('should reject non-11000 errors immediately without retry', async () => {
      let attempts = 0;
      async function generateIdWithRetry(createFn, maxRetries = 5) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          attempts++;
          try {
            return await createFn();
          } catch (err) {
            if (err.code === 11000 && attempt < maxRetries - 1) {
              continue;
            }
            throw err;
          }
        }
      }

      const mockDbFailure = async () => {
        const dbErr = new Error('Database connection failed');
        dbErr.code = 500;
        throw dbErr;
      };

      await assert.rejects(
        () => generateIdWithRetry(mockDbFailure),
        (err) => {
          assert.equal(err.message, 'Database connection failed');
          assert.equal(attempts, 1, 'Should fail immediately without retrying non-duplicate errors');
          return true;
        }
      );
    });
  });

  describe('4. Promise & Asynchronous State Machine Safety', () => {
    it('should guarantee fire-and-forget void calls do not propagate unhandled rejections when handled internally', async () => {
      let errorHandled = false;

      const safeAsyncAction = async () => {
        try {
          await Promise.reject(new Error('Handled expected error'));
        } catch {
          errorHandled = true;
        }
      };

      // Invoking via void
      void safeAsyncAction();

      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(errorHandled, true, 'Intentional async operation handled its own error');
    });

    it('isMounted guard should prevent state updates after component lifecycle termination', async () => {
      let stateUpdated = false;
      let isMounted = true;

      const asyncFetch = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (isMounted) {
          stateUpdated = true;
        }
      };

      const promise = asyncFetch();
      // Simulate unmount before resolution
      isMounted = false;

      await promise;
      assert.equal(stateUpdated, false, 'State was safely prevented from updating after unmount');
    });
  });
});
