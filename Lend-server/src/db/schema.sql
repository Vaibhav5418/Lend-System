-- LendFlow CRM PostgreSQL Schema (Neon PostgreSQL)
-- Complete Relational DDL with Indexes, Foreign Keys, and Constraints

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'Super Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  total_inquiries INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agents_total_inquiries ON agents (total_inquiries DESC);

CREATE TABLE IF NOT EXISTS inquiries (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Borrower', 'Investor')),
  name VARCHAR(255) DEFAULT '',
  mobile VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  source VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('Hot', 'Warm', 'Cold')),
  assigned_to VARCHAR(255) DEFAULT '',
  reference_agent VARCHAR(255),
  stage VARCHAR(50) NOT NULL DEFAULT 'NEW',
  next_follow_up VARCHAR(100),
  turnover VARCHAR(100),
  last_activity VARCHAR(255) NOT NULL DEFAULT 'Inquiry created',
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT DEFAULT '',
  activity_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  combined_report_markdown TEXT,
  combined_report_generated_at TIMESTAMPTZ,
  profile_score NUMERIC(5, 2),
  profile_score_rating VARCHAR(50),
  borrower_details JSONB,
  investor_details JSONB
);

CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries (type);
CREATE INDEX IF NOT EXISTS idx_inquiries_stage ON inquiries (stage);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON inquiries (assigned_to);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_type_stage ON inquiries (type, stage);
CREATE INDEX IF NOT EXISTS idx_inquiries_type_created_at ON inquiries (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON inquiries (priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_name_lower ON inquiries (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_inquiries_mobile ON inquiries (mobile);
CREATE INDEX IF NOT EXISTS idx_inquiries_email_lower ON inquiries (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_inquiries_id_num ON inquiries ((NULLIF(regexp_replace(id, '\D', '', 'g'), '')::bigint));
CREATE INDEX IF NOT EXISTS idx_inquiries_stage_created ON inquiries (stage, created_at DESC);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(24) PRIMARY KEY,
  inquiry_id VARCHAR(50) NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  cloudinary_url TEXT NOT NULL,
  public_id TEXT DEFAULT '',
  resource_type VARCHAR(50) DEFAULT 'auto',
  storage_provider VARCHAR(50) DEFAULT 'cloudinary',
  summary TEXT DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_inquiry_id ON documents (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents (uploaded_at DESC);

CREATE TABLE IF NOT EXISTS proposals (
  id VARCHAR(50) PRIMARY KEY,
  inquiry_id VARCHAR(50) NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  borrower_name VARCHAR(255) DEFAULT '',
  original_loan_amount NUMERIC(15, 2) DEFAULT 0,
  original_interest_rate NUMERIC(6, 2) DEFAULT 0,
  original_tenure INTEGER DEFAULT 0,
  proposed_loan_amount NUMERIC(15, 2) NOT NULL,
  proposed_interest_rate NUMERIC(6, 2) NOT NULL,
  proposed_tenure INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'Sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_inquiry_id ON proposals (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_status_created ON proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_borrower_name_lower ON proposals (LOWER(borrower_name));

CREATE TABLE IF NOT EXISTS borrower_loans (
  id VARCHAR(50) PRIMARY KEY,
  inquiry_id VARCHAR(50) NOT NULL,
  borrower_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) DEFAULT '',
  mobile VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  approved_amount NUMERIC(15, 2) NOT NULL,
  interest_rate NUMERIC(6, 2) NOT NULL,
  interest_rate_type VARCHAR(20) NOT NULL DEFAULT 'yearly',
  tenure_months INTEGER NOT NULL,
  repayment_type VARCHAR(50) NOT NULL DEFAULT 'Interest-Only',
  monthly_interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_repayable NUMERIC(15, 2) NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  repayment_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  investor_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  loan_purpose VARCHAR(500) DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrower_loans_inquiry_id ON borrower_loans (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_borrower_loans_status ON borrower_loans (status);
CREATE INDEX IF NOT EXISTS idx_borrower_loans_created_at ON borrower_loans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_borrower_loans_status_created ON borrower_loans (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_borrower_loans_borrower_name_lower ON borrower_loans (LOWER(borrower_name));

CREATE TABLE IF NOT EXISTS borrower_collections (
  id VARCHAR(50) PRIMARY KEY,
  loan_id VARCHAR(50) NOT NULL REFERENCES borrower_loans(id) ON DELETE CASCADE,
  borrower_name VARCHAR(255) DEFAULT '',
  payment_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  schedule_month INTEGER,
  interest_paid NUMERIC(15, 2) DEFAULT 0,
  principal_paid NUMERIC(15, 2) DEFAULT 0,
  total_paid NUMERIC(15, 2) DEFAULT 0,
  pending_amount NUMERIC(15, 2) DEFAULT 0,
  overdue_days INTEGER DEFAULT 0,
  penalty NUMERIC(15, 2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
  status VARCHAR(50) DEFAULT 'Pending',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrower_collections_loan_id ON borrower_collections (loan_id);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_status ON borrower_collections (status);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_due_date ON borrower_collections (due_date);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_payment_date ON borrower_collections (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_status_due ON borrower_collections (status, due_date);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_loan_status ON borrower_collections (loan_id, status);
CREATE INDEX IF NOT EXISTS idx_borrower_collections_borrower_name_lower ON borrower_collections (LOWER(borrower_name));

CREATE TABLE IF NOT EXISTS investor_investments (
  id VARCHAR(50) PRIMARY KEY,
  inquiry_id VARCHAR(50) NOT NULL,
  investor_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  invested_amount NUMERIC(15, 2) NOT NULL,
  interest_rate NUMERIC(6, 2) NOT NULL,
  interest_rate_type VARCHAR(20) NOT NULL DEFAULT 'yearly',
  tenure_months INTEGER NOT NULL,
  investment_plan VARCHAR(20) DEFAULT 'custom',
  payout_frequency VARCHAR(20) DEFAULT 'monthly',
  monthly_interest NUMERIC(15, 2) DEFAULT 0,
  total_interest NUMERIC(15, 2) DEFAULT 0,
  total_payout NUMERIC(15, 2) DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  maturity_date TIMESTAMPTZ,
  linked_borrowers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'Active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_investments_inquiry_id ON investor_investments (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_investor_investments_status ON investor_investments (status);
CREATE INDEX IF NOT EXISTS idx_investor_investments_created_at ON investor_investments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_investments_status_created ON investor_investments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_investments_investor_name_lower ON investor_investments (LOWER(investor_name));

CREATE TABLE IF NOT EXISTS investor_payments (
  id VARCHAR(50) PRIMARY KEY,
  investment_id VARCHAR(50) NOT NULL REFERENCES investor_investments(id) ON DELETE CASCADE,
  investor_name VARCHAR(255) DEFAULT '',
  payment_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest_paid NUMERIC(15, 2) DEFAULT 0,
  principal_paid NUMERIC(15, 2) DEFAULT 0,
  pending_interest NUMERIC(15, 2) DEFAULT 0,
  payment_frequency VARCHAR(20) DEFAULT 'monthly',
  payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
  status VARCHAR(50) DEFAULT 'Pending',
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_payments_investment_id ON investor_payments (investment_id);
CREATE INDEX IF NOT EXISTS idx_investor_payments_status ON investor_payments (status);
CREATE INDEX IF NOT EXISTS idx_investor_payments_due_date ON investor_payments (due_date);
CREATE INDEX IF NOT EXISTS idx_investor_payments_payment_date ON investor_payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_investor_payments_status_due ON investor_payments (status, due_date);
CREATE INDEX IF NOT EXISTS idx_investor_payments_inv_status ON investor_payments (investment_id, status);
CREATE INDEX IF NOT EXISTS idx_investor_payments_investor_name_lower ON investor_payments (LOWER(investor_name));
