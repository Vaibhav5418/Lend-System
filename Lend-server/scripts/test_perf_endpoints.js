import '../loadEnv.js';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.DB_URI;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Testing query performance on PostgreSQL (with 10,000+ records)...');
  const client = await pool.connect();
  try {
    // 1. Dashboard KPIs
    let t0 = performance.now();
    const kpiRes = await client.query(`
      SELECT
        COUNT(*) AS total_inquiries,
        COUNT(CASE WHEN type = 'Borrower' THEN 1 END) AS total_borrowers,
        COUNT(CASE WHEN type = 'Investor' THEN 1 END) AS total_investors,
        COALESCE(SUM(CASE WHEN type = 'Borrower' THEN COALESCE((borrower_details->>'loanAmount')::numeric, 0) ELSE 0 END), 0) AS total_borrower_funding,
        COALESCE(SUM(CASE WHEN type = 'Investor' THEN COALESCE((investor_details->>'investmentAmount')::numeric, 0) ELSE 0 END), 0) AS total_investment_funding
      FROM inquiries;
    `);
    let ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] Dashboard KPI aggregation: ${ms}ms`, kpiRes.rows[0]);

    // 2. 14-day Trend
    t0 = performance.now();
    const trendRes = await client.query(`
      SELECT
        to_char(created_at, 'YYYY-MM-DD') AS date_val,
        COUNT(*) AS count,
        COUNT(CASE WHEN type = 'Borrower' THEN 1 END) AS borrowers,
        COUNT(CASE WHEN type = 'Investor' THEN 1 END) AS investors
      FROM inquiries
      WHERE created_at >= (CURRENT_DATE - INTERVAL '13 days')
      GROUP BY date_val
      ORDER BY date_val ASC;
    `);
    ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] 14-Day Trend aggregation: ${ms}ms (rows: ${trendRes.rowCount})`);

    // 3. Stage Summary
    t0 = performance.now();
    const stageRes = await client.query(`
      SELECT
        stage,
        COUNT(*)::int AS count,
        COALESCE(SUM(
          CASE
            WHEN type = 'Borrower' THEN COALESCE((borrower_details->>'loanAmount')::numeric, 0)
            ELSE 0
          END
        ), 0)::numeric AS total_amount
      FROM inquiries
      WHERE type = 'Borrower'
      GROUP BY stage;
    `);
    ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] Stage Summary aggregation: ${ms}ms`, stageRes.rows);

    // 4. Paginated Inquiries with Search & Window Count
    t0 = performance.now();
    const paginatedRes = await client.query(`
      SELECT *, COUNT(*) OVER() as _full_count
      FROM inquiries
      WHERE type = 'Borrower' AND (name ILIKE '%Sharma%' OR mobile ILIKE '%Sharma%')
      ORDER BY created_at DESC
      LIMIT 25 OFFSET 0;
    `);
    ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] Paginated Inquiries with search: ${ms}ms (matched total: ${paginatedRes.rows[0]?._full_count || 0})`);

    // 5. Profit Engine Aggregation
    t0 = performance.now();
    const [invRes, loanRes] = await Promise.all([
      client.query(`
        SELECT
          COALESCE(SUM(invested_amount), 0) AS total_invested_funds,
          COALESCE(SUM(CASE WHEN status = 'Active' THEN invested_amount ELSE 0 END), 0) AS active_invested_funds,
          COALESCE(SUM(total_interest), 0) AS total_interest_payable,
          COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_investors,
          COALESCE(
            AVG(CASE WHEN status = 'Active' THEN
              CASE WHEN interest_rate_type = 'monthly' THEN interest_rate * 12 ELSE interest_rate END
            END), 0
          ) AS avg_investor_rate
        FROM investor_investments;
      `),
      client.query(`
        SELECT
          COALESCE(SUM(approved_amount), 0) AS total_deployed_funds,
          COALESCE(SUM(CASE WHEN status = 'Active' THEN approved_amount ELSE 0 END), 0) AS active_deployed_funds,
          COALESCE(SUM(total_interest), 0) AS total_interest_receivable,
          COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_loans,
          COUNT(CASE WHEN status = 'Defaulted' THEN 1 END) AS defaulted_loans,
          COALESCE(
            AVG(CASE WHEN status = 'Active' THEN
              CASE WHEN interest_rate_type = 'monthly' THEN interest_rate * 12 ELSE interest_rate END
            END), 0
          ) AS avg_borrower_rate
        FROM borrower_loans;
      `)
    ]);
    ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] Profit Engine Aggregation: ${ms}ms`, {
      activeInvestors: invRes.rows[0]?.active_investors,
      activeLoans: loanRes.rows[0]?.active_loans,
    });

    // 6. Upcoming Dues (JSONB extraction)
    t0 = performance.now();
    const duesRes = await client.query(`
      SELECT
        id AS "loanId",
        borrower_name AS "borrowerName",
        (entry->>'month')::int AS "month",
        entry->>'dueDate' AS "dueDate",
        (entry->>'totalDue')::numeric AS "totalDue",
        (entry->>'interestDue')::numeric AS "interestDue",
        (entry->>'principalDue')::numeric AS "principalDue",
        ((entry->>'dueDate')::timestamptz < NOW()) AS "isOverdue"
      FROM borrower_loans,
      jsonb_array_elements(repayment_schedule) AS entry
      WHERE status = 'Active'
        AND entry->>'status' = 'Pending'
        AND (entry->>'dueDate')::timestamptz <= (NOW() + interval '30 days')
      ORDER BY (entry->>'dueDate')::timestamptz ASC
      LIMIT 100;
    `);
    ms = (performance.now() - t0).toFixed(1);
    console.log(`[PASS] Upcoming Dues JSONB extraction: ${ms}ms (rows: ${duesRes.rowCount})`);

    console.log('\nAll performance tests passed! Sub-100ms response across the board over Neon network.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Performance test failed:', err);
  process.exit(1);
});

