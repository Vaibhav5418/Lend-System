# LendFlow CRM Backend

High-performance Node.js API with Express and **Neon PostgreSQL**. Entry point: `server.js`.

## Database: Neon PostgreSQL

The backend has been migrated from MongoDB to **Neon PostgreSQL** using connection pooling via `pg` with native SSL support, transactional integrity, and parameterized queries.

### Setup & Configuration

1. From `Lend-server/`:
2. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` (or `DB_URI`): Neon PostgreSQL connection string (with SSL enabled, e.g. `postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require`)
   - `JWT_SECRET`: Secret key for authentication tokens
   - Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (for files ≤10 MB)
   - Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for files >10 MB)
   - Groq: `GROQ_API_KEY` (AI summarization & profile scoring)
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the PostgreSQL schema:
   ```bash
   npm run db:migrate
   ```
   *(The server also auto-verifies and applies schema initialization on startup).*
5. Run the server:
   ```bash
   npm run dev
   # or
   npm start
   ```

### Running Tests

The test suite runs against the test runners and PostgreSQL models:
```bash
npm test
```

### Migrating Existing Data from MongoDB

If you have an existing MongoDB Atlas database with historical records to transfer into Neon PostgreSQL:

```bash
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/dbname" npm run db:migrate:mongo
```
This script:
- Safely streams documents from MongoDB collections (`users`, `staff`, `agents`, `inquiries`, `documents`, `proposals`, `borrowerloans`, `borrowercollections`, `investorinvestments`, `investorpayments`).
- Converts ObjectIds and references into PostgreSQL IDs and relations.
- Is idempotent and safely resumable using `ON CONFLICT (id) DO UPDATE`.
- Never deletes or modifies the source MongoDB database.

---

## API Endpoints

- **Authentication:**
  - `POST /api/auth/register` – register user
  - `POST /api/auth/login` – login and receive JWT
  - `POST /api/auth/verify-email` – verify registered email
  - `POST /api/auth/forgot-password` – reset password
- **Inquiries:**
  - `GET /api/inquiries` – list all inquiries
  - `GET /api/inquiries/:id` – get single inquiry
  - `POST /api/inquiries` – create inquiry
  - `PUT /api/inquiries/:id` – update inquiry
  - `PATCH /api/inquiries/:id/stage` – advance pipeline stage with activity logging
  - `DELETE /api/inquiries/:id` – delete inquiry
- **Documents:**
  - `GET /api/inquiries/:inquiryId/documents` – list documents for inquiry
  - `POST /api/inquiries/:inquiryId/documents` – upload document
  - `GET /api/inquiries/:inquiryId/documents/:docId/view` – view/stream document
  - `POST /api/inquiries/:inquiryId/documents/:docId/summary` – regenerate AI document summary
  - `POST /api/inquiries/:inquiryId/documents/combined-report` – generate combined AI financial assessment & profile score
  - `DELETE /api/inquiries/:inquiryId/documents/:docId` – delete document
- **Proposals:**
  - `GET /api/proposals` – list proposals (supports `?inquiryId=...`)
  - `GET /api/proposals/:id` – get single proposal
  - `POST /api/proposals` – send proposal to borrower
  - `PATCH /api/proposals/:id/status` – accept, reject, or counter proposal terms
  - `DELETE /api/proposals/:id` – delete proposal
- **Borrower Loans & Collections:**
  - `GET /api/borrower/loans` – list loans
  - `GET /api/borrower/loans/:id` – get single loan
  - `POST /api/borrower/loans` – create loan & generate repayment schedule
  - `PUT /api/borrower/loans/:id` – update loan terms & recalculate schedule
  - `DELETE /api/borrower/loans/:id` – delete loan
  - `GET /api/borrower/collections` – list repayments (supports `?loanId=...`)
  - `GET /api/borrower/collections/:id` – get single repayment
  - `POST /api/borrower/collections` – record borrower collection
  - `PUT /api/borrower/collections/:id` – update repayment
  - `DELETE /api/borrower/collections/:id` – delete repayment
  - `GET /api/borrower/upcoming-dues` – upcoming interest dues within 30 days
- **Investor Investments & Payouts:**
  - `GET /api/investor/investments` – list active & closed investments
  - `GET /api/investor/investments/:id` – get single investment
  - `POST /api/investor/investments` – create investment & auto-calculate returns
  - `PUT /api/investor/investments/:id` – update investment terms
  - `DELETE /api/investor/investments/:id` – delete investment
  - `GET /api/investor/payments` – list investor payouts (supports `?investmentId=...`)
  - `GET /api/investor/payments/:id` – get single payout
  - `POST /api/investor/payments` – record payout
  - `PUT /api/investor/payments/:id` – update payout
  - `DELETE /api/investor/payments/:id` – delete payout
  - `GET /api/investor/upcoming-payouts` – upcoming payouts within 30 days
- **Profit Engine:**
  - `GET /api/profit/dashboard` – aggregate spread profit, realized profit, capital deployment, and 12-month metrics
- **Master Data:**
  - `GET /api/staff` – list staff members
  - `GET /api/agents` – list agents & performance metrics
