import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './index.js';
import { sanitizeLog } from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize Neon PostgreSQL schema and default data.
 */
export async function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying PostgreSQL schema to Neon database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(ddl);

    // Seed default staff if table is empty
    const staffCountRes = await client.query('SELECT COUNT(*)::int as count FROM staff');
    if (staffCountRes.rows[0].count === 0) {
      console.log('Seeding default staff members...');
      const defaultStaff = ['Amit Shah', 'Neha Kapoor', 'Rahul Verma'];
      for (let i = 0; i < defaultStaff.length; i++) {
        await client.query(
          'INSERT INTO staff (name, display_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
          [defaultStaff[i], i]
        );
      }
    }

    await client.query('COMMIT');
    console.log('PostgreSQL schema initialized successfully on Neon.');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize PostgreSQL schema:', sanitizeLog(err?.message || err));
    throw err;
  } finally {
    client.release();
  }
}

// Allow standalone execution via `node src/db/migrate.js`
if (process.argv[1] === __filename) {
  initializeDatabase()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', sanitizeLog(err?.message || err));
      process.exit(1);
    });
}
