/**
 * Security and Validation Utility for LendFlow CRM
 *
 * Provides strict validation and sanitization for:
 * - Application-specific identifier regexes (NoSQL injection prevention)
 * - Safe query parameter parsing (scalar checks, rejection of MongoDB operator objects)
 * - Safe log sanitization (prevention of Log Injection / CRLF injection)
 * - Mass assignment prevention allowlists
 */

export const ID_PATTERNS = Object.freeze({
  inquiry: /^INQ-\d+$/,
  proposal: /^PROP-\d+$/,
  loan: /^LOAN-\d+$/,
  investment: /^INV-\d+$/,
  collection: /^COL-\d+$/,
  payment: /^IPAY-\d+$/,
  document: /^[a-f0-9]{24}$/i,
});

/**
 * Validate that an ID is a scalar string matching the expected pattern.
 * Rejects objects, arrays, undefined, null, or strings containing unexpected characters.
 * @param {unknown} id
 * @param {RegExp} pattern
 * @returns {boolean}
 */
export function isValidId(id, pattern) {
  if (typeof id !== 'string') return false;
  return pattern.test(id.trim());
}

/**
 * Safely parse an optional query parameter ID.
 * Returns:
 *   { valid: true, value: string } when a valid scalar ID is provided.
 *   { valid: true, value: undefined } when the query parameter is omitted or empty.
 *   { valid: false, error: string } when non-string (e.g. object operator) or invalid format is provided.
 * @param {unknown} val
 * @param {RegExp} pattern
 * @param {string} fieldName
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function parseQueryId(val, pattern, fieldName = 'ID') {
  if (val === undefined || val === null || val === '') {
    return { valid: true, value: undefined };
  }
  if (typeof val !== 'string') {
    return { valid: false, error: `Invalid ${fieldName}: must be a scalar string` };
  }
  const trimmed = val.trim();
  if (!pattern.test(trimmed)) {
    return { valid: false, error: `Invalid ${fieldName} format` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Sanitize a string or object for safe logging.
 * Strips Carriage Returns, Line Feeds, ASCII control characters, and truncates to maxLength.
 * Prevents log injection / log forging attacks.
 * @param {unknown} val
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeLog(val, maxLength = 500) {
  if (val === null || val === undefined) return '';
  let str;
  if (val instanceof Error) {
    str = val.message || 'Error';
  } else if (typeof val === 'object') {
    try {
      str = JSON.stringify(val);
    } catch {
      str = '[Object]';
    }
  } else {
    str = String(val);
  }
  return str
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Safe number parsing helper. Returns null if not a valid positive finite number.
 * @param {unknown} val
 * @param {boolean} allowZero
 * @returns {number|null}
 */
export function parsePositiveNumber(val, allowZero = false) {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  if (allowZero ? num < 0 : num <= 0) return null;
  return num;
}

/**
 * Safe integer parsing helper. Returns null if not a valid positive integer.
 * @param {unknown} val
 * @param {boolean} allowZero
 * @returns {number|null}
 */
export function parsePositiveInteger(val, allowZero = false) {
  const num = parsePositiveNumber(val, allowZero);
  if (num === null) return null;
  if (!Number.isInteger(num)) return null;
  return num;
}

/**
 * Safe string trimmer. Returns empty string if not string or undefined.
 * @param {unknown} val
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeString(val, maxLength = 1000) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLength);
}
