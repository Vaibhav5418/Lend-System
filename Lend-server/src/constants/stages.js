/**
 * Pipeline stage constants. Use these instead of magic strings.
 * Borrower and Investor have separate stage flows.
 */

/** @readonly */
export const BORROWER_STAGES = Object.freeze([
  'NEW',
  'CONTACTED',
  'MEETING',
  'DOCS_PENDING',
  'VERIFIED',
  'PROPOSED',
  'APPROVED',
  'DISBURSED',
]);

/** @readonly */
export const INVESTOR_STAGES = Object.freeze([
  'NEW',
  'CONTACTED',
  'MEETING',
  'RATE_DISCUSSED',
  'AGREEMENT_DONE',
  'FUND_RECEIVED',
]);

export const DEFAULT_STAGE = 'NEW';

/** @param {string} stage @param {readonly string[]} allowed */
export function isStageAllowed(stage, allowed) {
  return typeof stage === 'string' && allowed.includes(stage);
}
