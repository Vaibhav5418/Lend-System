import '../../loadEnv.js';
import pg from 'pg';
import { sanitizeLog } from '../utils/security.js';

const { Pool } = pg;

// Read DATABASE_URL or fallback to DB_URI from .env
const connectionString = process.env.DATABASE_URL || process.env.DB_URI;

if (!connectionString) {
  console.warn('DATABASE_URL or DB_URI not set. Set it in .env to connect to Neon PostgreSQL.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected idle client error in PostgreSQL pool:', sanitizeLog(err?.message || err));
});

let isConnected = false;

/**
 * Execute a parameterized query using the pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = performance.now();
  try {
    const res = await pool.query(text, params);
    const duration = (performance.now() - start).toFixed(1);
    const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 120);

    if (process.env.NODE_ENV !== 'test' && !process.env.SILENT_DB_LOGS) {
      console.log(`\x1b[90m[DB]\x1b[0m \x1b[35m${duration.padStart(5)}ms\x1b[0m \x1b[90m|\x1b[0m ${cleanText} \x1b[90m(rows: ${res.rowCount ?? res.rows?.length ?? 0})\x1b[0m`);
    }

    return res;
  } catch (err) {
    console.error('Database query error:', sanitizeLog(err?.message || err), {
      text: sanitizeLog(text, 200),
    });
    throw err;
  }
}

/**
 * Execute multiple queries in a transaction.
 * @param {(client: pg.PoolClient) => Promise<any>} callback
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check whether the database is connected and responsive.
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
  try {
    const res = await pool.query('SELECT 1 as alive');
    isConnected = res.rows[0]?.alive === 1;
    return isConnected;
  } catch (err) {
    isConnected = false;
    return false;
  }
}

/**
 * Synchronous or cached status check.
 */
export function isDbConnected() {
  return isConnected;
}

export function setDbConnected(status) {
  isConnected = Boolean(status);
}

/**
 * Graceful pool shutdown.
 */
export async function closePool() {
  try {
    await pool.end();
    isConnected = false;
  } catch (err) {
    console.error('Error during database pool shutdown:', sanitizeLog(err?.message || err));
  }
}
