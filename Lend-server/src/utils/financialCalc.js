/**
 * Financial calculation utilities for P2P lending platform.
 * Matches real-world NBFC / P2P spread accounting logic.
 *
 * All rates are expected as ANNUAL percentages unless stated otherwise.
 */

/**
 * Convert rate to annual if given as monthly.
 * @param {number} rate
 * @param {'monthly'|'yearly'} type
 * @returns {number} Annual rate %
 */
export function toAnnualRate(rate, type = 'yearly') {
  const numRate = Number(rate);
  if (!Number.isFinite(numRate) || numRate < 0) return 0;
  return type === 'monthly' ? Math.round(numRate * 12 * 10000) / 10000 : numRate;
}

/**
 * Monthly interest on a principal.
 * @param {number} principal
 * @param {number} annualRate - Annual interest rate in %
 * @returns {number}
 */
export function calcMonthlyInterest(principal, annualRate) {
  const p = Number(principal);
  const r = Number(annualRate);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(r) || r < 0) return 0;
  return Math.round((p * r / 12 / 100) * 100) / 100;
}

/**
 * Total simple interest over tenure.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} tenureMonths
 * @returns {number}
 */
export function calcTotalInterest(principal, annualRate, tenureMonths) {
  const m = Number(tenureMonths);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.round(calcMonthlyInterest(principal, annualRate) * m * 100) / 100;
}

/**
 * Maturity date from start + tenure.
 * @param {Date|string} startDate
 * @param {number} tenureMonths
 * @returns {Date}
 */
export function calcMaturityDate(startDate, tenureMonths) {
  if (!startDate) return new Date();
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return new Date();
  const months = Number(tenureMonths);
  const safeTenure = Number.isFinite(months) && months > 0 ? Math.floor(months) : 0;
  d.setMonth(d.getMonth() + safeTenure);
  return d;
}

/**
 * Generate a full repayment schedule.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} tenureMonths
 * @param {'Interest-Only'|'Bullet'} repaymentType
 * @param {Date|string} startDate
 * @returns {Array<{month:number, dueDate:Date, interestDue:number, principalDue:number, totalDue:number, status:string}>}
 */
export function generateRepaymentSchedule(principal, annualRate, tenureMonths, repaymentType, startDate) {
  const p = Number(principal);
  const r = Number(annualRate);
  const t = Number(tenureMonths);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(r) || r < 0 || !Number.isFinite(t) || t <= 0) {
    return [];
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return [];
  }

  const tenure = Math.floor(t);
  const schedule = [];

  if (repaymentType === 'Interest-Only') {
    const mi = calcMonthlyInterest(p, r);
    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);
      const isLast = i === tenure;
      schedule.push({
        month: i,
        dueDate,
        interestDue: mi,
        principalDue: isLast ? p : 0,
        totalDue: Math.round((mi + (isLast ? p : 0)) * 100) / 100,
        status: 'Pending',
      });
    }
  } else {
    // Bullet — everything at maturity
    const totalInterest = calcTotalInterest(p, r, tenure);
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + tenure);
    schedule.push({
      month: tenure,
      dueDate,
      interestDue: totalInterest,
      principalDue: p,
      totalDue: Math.round((totalInterest + p) * 100) / 100,
      status: 'Pending',
    });
  }

  return schedule;
}

/**
 * Platform spread calculation.
 * @param {number} investorRate - Annual % paid to investor
 * @param {number} borrowerRate - Annual % charged to borrower
 * @param {number} amount
 * @returns {{ spread: number, monthlySpread: number, annualSpread: number }}
 */
export function calcPlatformSpread(investorRate, borrowerRate, amount) {
  const iRate = Number.isFinite(Number(investorRate)) ? Number(investorRate) : 0;
  const bRate = Number.isFinite(Number(borrowerRate)) ? Number(borrowerRate) : 0;
  const amt = Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : 0;

  const spread = Math.round((bRate - iRate) * 10000) / 10000;
  const monthlySpread = Math.round((amt * spread / 12 / 100) * 100) / 100;
  const annualSpread = Math.round((amt * spread / 100) * 100) / 100;
  return { spread, monthlySpread, annualSpread };
}

/**
 * Overdue penalty (simple daily penalty rate).
 * @param {number} overdueAmount
 * @param {number} overdueDays
 * @param {number} penaltyRatePerDay - e.g. 0.05 means 0.05% per day
 * @returns {number}
 */
export function calcPenalty(overdueAmount, overdueDays, penaltyRatePerDay = 0.05) {
  const amount = Number(overdueAmount);
  const days = Number(overdueDays);
  const rate = Number(penaltyRatePerDay);

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(days) || days <= 0 || !Number.isFinite(rate) || rate < 0) {
    return 0;
  }
  return Math.round(amount * rate / 100 * days * 100) / 100;
}
