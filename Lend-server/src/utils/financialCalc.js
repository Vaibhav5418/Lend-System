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
  return type === 'monthly' ? rate * 12 : rate;
}

/**
 * Monthly interest on a principal.
 * @param {number} principal
 * @param {number} annualRate - Annual interest rate in %
 * @returns {number}
 */
export function calcMonthlyInterest(principal, annualRate) {
  return Math.round((principal * annualRate / 12 / 100) * 100) / 100;
}

/**
 * Total simple interest over tenure.
 * @param {number} principal
 * @param {number} annualRate
 * @param {number} tenureMonths
 * @returns {number}
 */
export function calcTotalInterest(principal, annualRate, tenureMonths) {
  return Math.round(calcMonthlyInterest(principal, annualRate) * tenureMonths * 100) / 100;
}

/**
 * Maturity date from start + tenure.
 * @param {Date|string} startDate
 * @param {number} tenureMonths
 * @returns {Date}
 */
export function calcMaturityDate(startDate, tenureMonths) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + tenureMonths);
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
  const schedule = [];
  const start = new Date(startDate);

  if (repaymentType === 'Interest-Only') {
    const mi = calcMonthlyInterest(principal, annualRate);
    for (let i = 1; i <= tenureMonths; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);
      const isLast = i === tenureMonths;
      schedule.push({
        month: i,
        dueDate,
        interestDue: mi,
        principalDue: isLast ? principal : 0,
        totalDue: Math.round((mi + (isLast ? principal : 0)) * 100) / 100,
        status: 'Pending',
      });
    }
  } else {
    // Bullet — everything at maturity
    const totalInterest = calcTotalInterest(principal, annualRate, tenureMonths);
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + tenureMonths);
    schedule.push({ month: tenureMonths, dueDate, interestDue: totalInterest, principalDue: principal, totalDue: Math.round((totalInterest + principal) * 100) / 100, status: 'Pending' });
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
  const spread = borrowerRate - investorRate;
  const monthlySpread = Math.round((amount * spread / 12 / 100) * 100) / 100;
  const annualSpread = Math.round((amount * spread / 100) * 100) / 100;
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
  return Math.round(overdueAmount * penaltyRatePerDay / 100 * overdueDays * 100) / 100;
}
