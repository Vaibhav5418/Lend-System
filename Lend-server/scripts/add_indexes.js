import '../loadEnv.js';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.DB_URI;

if (!connectionString) {
  console.error('DATABASE_URL or DB_URI not set in environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const INDEX_QUERIES = [
  // Inquiries
  `CREATE INDEX IF NOT EXISTS idx_inquiries_type_stage ON inquiries (type, stage);`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_type_created_at ON inquiries (type, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON inquiries (priority);`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_name_lower ON inquiries (LOWER(name));`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_mobile ON inquiries (mobile);`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_email_lower ON inquiries (LOWER(email));`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_id_num ON inquiries ((NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint));`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_stage_created ON inquiries (stage, created_at DESC);`,

  // Borrower Loans & Collections
  `CREATE INDEX IF NOT EXISTS idx_borrower_loans_status_created ON borrower_loans (status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_borrower_loans_borrower_name_lower ON borrower_loans (LOWER(borrower_name));`,
  `CREATE INDEX IF NOT EXISTS idx_borrower_collections_status_due ON borrower_collections (status, due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_borrower_collections_loan_status ON borrower_collections (loan_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_borrower_collections_borrower_name_lower ON borrower_collections (LOWER(borrower_name));`,

  // Investor Investments & Payments
  `CREATE INDEX IF NOT EXISTS idx_investor_investments_status_created ON investor_investments (status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_investor_investments_investor_name_lower ON investor_investments (LOWER(investor_name));`,
  `CREATE INDEX IF NOT EXISTS idx_investor_payments_status_due ON investor_payments (status, due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_investor_payments_inv_status ON investor_payments (investment_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_investor_payments_investor_name_lower ON investor_payments (LOWER(investor_name));`,

  // Proposals
  `CREATE INDEX IF NOT EXISTS idx_proposals_status_created ON proposals (status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_proposals_borrower_name_lower ON proposals (LOWER(borrower_name));`,
];

async function run() {
  console.log('Connecting to PostgreSQL to apply performance indexes...');
  const client = await pool.connect();
  try {
    for (const q of INDEX_QUERIES) {
      const start = performance.now();
      await client.query(q);
      const ms = (performance.now() - start).toFixed(1);
      console.log(`[INDEX CREATED/VERIFIED] (${ms}ms): ${q.replace('CREATE INDEX IF NOT EXISTS ', '').split(' ON ')[0]}`);
    }
    console.log('All performance indexes successfully verified/created!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error applying indexes:', err);
  process.exit(1);
});

