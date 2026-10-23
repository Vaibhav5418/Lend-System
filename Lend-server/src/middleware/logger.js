import { sanitizeLog } from '../utils/security.js';

// ANSI terminal color codes
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function getMethodColor(method) {
  switch (method) {
    case 'GET':
      return colors.cyan;
    case 'POST':
      return colors.green;
    case 'PUT':
    case 'PATCH':
      return colors.yellow;
    case 'DELETE':
      return colors.red;
    default:
      return colors.magenta;
  }
}

function getStatusColor(status) {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
}

/**
 * Express middleware for terminal request/response logging.
 */
export function requestLogger(req, res, next) {
  const start = performance.now();
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  res.on('finish', () => {
    const duration = (performance.now() - start).toFixed(1);
    const methodColor = getMethodColor(req.method);
    const statusColor = getStatusColor(res.statusCode);

    const safeUrl = sanitizeLog(req.originalUrl || req.url, 150);
    const methodStr = `${methodColor}${colors.bright}${req.method.padEnd(6)}${colors.reset}`;
    const statusStr = `${statusColor}${colors.bright}${res.statusCode}${colors.reset}`;
    const durationStr = `${colors.gray}${duration.padStart(5)}ms${colors.reset}`;
    const timeStr = `${colors.dim}[${timestamp}]${colors.reset}`;

    const userContext = req.user?.id ? ` ${colors.dim}(user: ${req.user.id.slice(0, 8)}...)${colors.reset}` : '';

    console.log(`${timeStr} ${methodStr} ${safeUrl} ${statusStr} ${durationStr}${userContext}`);
  });

  next();
}
