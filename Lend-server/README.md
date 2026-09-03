# Lend-System Backend

Backend lives in **Lend-System/server/** (sibling to **Lend-System/project/** frontend).

Node.js API with Express and MongoDB Atlas. Entry point: **server.js**.

## Setup

1. From repo root: `cd server`
2. Copy `.env.example` to `.env` and set:
   - `MONGODB_URI` ([MongoDB Atlas](https://cloud.mongodb.com))
   - For document uploads: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` ([Cloudinary](https://cloudinary.com)). Files **≤10 MB** are stored in Cloudinary.
   - For **files over 10 MB**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ([Supabase](https://supabase.com)). Create a **public** storage bucket named `lendflow-documents` (or set `SUPABASE_BUCKET_DOCUMENTS`). Large files are uploaded to this bucket instead of Cloudinary.
   - For AI summaries: `GROQ_API_KEY` ([Groq Console](https://console.groq.com)). For **combined report** with many/large PDFs (to avoid "Request too large" / TPM limits), you can add multiple keys: `GROQ_API_KEY_1`, `GROQ_API_KEY_2`, … `GROQ_API_KEY_11`. The server chunks the content, spreads requests across keys, and merges partial reports; if one key hits rate limit, others continue.
3. Install and run:

```bash
npm install
npm run dev
```

Server runs at **http://localhost:3001**. The frontend in `project/` proxies `/api` to this URL in dev.

## API

- `GET /api/inquiries` – list inquiries
- `GET /api/inquiries/:id` – get one inquiry
- `POST /api/inquiries` – create inquiry (body: inquiry without `id`); default `stage` = `NEW`
- `PUT /api/inquiries/:id` – update inquiry
- **`PATCH /api/inquiries/:id/stage`** – update pipeline stage (body: `{ stage: string }`). Validates stage by inquiry type; updates `lastActivityAt` and appends to `activityLogs`.
- `DELETE /api/inquiries/:id` – delete inquiry
- `GET /api/staff` – list staff names (returns defaults if collection empty)
- `GET /api/agents` – list agents
- **Documents (per inquiry):**
  - `GET /api/inquiries/:inquiryId/documents` – list documents
  - `POST /api/inquiries/:inquiryId/documents` – upload file (multipart, field `file`); stored in Cloudinary, summary via Groq API
  - `DELETE /api/inquiries/:inquiryId/documents/:docId` – delete document
  - **`POST /api/inquiries/:inquiryId/documents/combined-report`** – generate one AI combined financial report from all inquiry documents (uses key pool + chunking when multiple `GROQ_API_KEY_*` are set)

### Pipeline stages

- **Borrower:** `NEW` → `CONTACTED` → `DOCS_PENDING` → `VERIFIED` → `APPROVED` → `DISBURSED`
- **Investor:** `NEW` → `CONTACTED` → `RATE_DISCUSSED` → `AGREEMENT_DONE` → `FUND_RECEIVED`

Only stages valid for the inquiry type are accepted; invalid stage returns 400.
