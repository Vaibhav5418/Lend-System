import './loadEnv.js';

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import authRoutes from './src/routes/auth.js';
import inquiryRoutes from './src/routes/inquiries.js';
import documentRoutes from './src/routes/documents.js';
import staffRoutes from './src/routes/staff.js';
import agentRoutes from './src/routes/agents.js';
import investorRoutes from './src/routes/investor.js';
import borrowerLoanRoutes from './src/routes/borrowerLoans.js';
import proposalRoutes from './src/routes/proposals.js';
import profitRoutes from './src/routes/profit.js';
import { authMiddleware } from './src/middleware/auth.js';
import { requestLogger } from './src/middleware/logger.js';
import { cacheService } from './src/services/cacheService.js';

import { checkConnection, closePool } from './src/db/index.js';
import { initializeDatabase } from './src/db/migrate.js';
import { sanitizeLog } from './src/utils/security.js';

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'https://lend-project-zeta.vercel.app',
  'https://lend-project-git-main-vaibhav-sonis-projects-830e28a2.vercel.app',
  'https://lend-project-d64ytwfj9-vaibhav-sonis-projects-830e28a2.vercel.app',
  'http://localhost:5173',
  'https://loanlybyvaibhav.vercel.app',
].filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/cache/stats', async (_, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Unable to retrieve cache stats' });
  }
});

app.post('/api/cache/flush', async (_, res) => {
  try {
    await cacheService.flush();
    res.json({ ok: true, message: 'Cache flushed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to flush cache' });
  }
});

app.use(authMiddleware);
app.use('/api/inquiries/:inquiryId/documents', documentRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/agents', agentRoutes);

// ─── Lending Lifecycle Routes ─────────────────────────────────────
app.use('/api/investor', investorRoutes);
app.use('/api/borrower', borrowerLoanRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/profit', profitRoutes);

// Global error handler for unhandled route errors
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', sanitizeLog(err));
  res.status(500).json({ error: 'Internal server error' });
});

async function run() {
  const dbUrl = process.env.DATABASE_URL || process.env.DB_URI;
  if (!dbUrl) {
    console.warn('DATABASE_URL or DB_URI not set. Set it in server/.env to connect to Neon PostgreSQL.');
  } else {
    try {
      const connected = await checkConnection();
      if (!connected) {
        throw new Error('Unable to establish initial PostgreSQL connection');
      }
      console.log('Connected to Neon PostgreSQL');
      await initializeDatabase();
    } catch (err) {
      console.error('PostgreSQL connection error:', sanitizeLog(err?.message || err));
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
  // Combined report can take several minutes (many PDFs, chunked Groq calls). Avoid ECONNRESET/fetch error.
  server.timeout = 8 * 60 * 1000; // 8 minutes
  server.keepAliveTimeout = 9 * 60 * 1000;
  server.headersTimeout = 9 * 60 * 1000;

  const handleShutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await closePool();
      console.log('HTTP server and database connections closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

run().catch(console.error);
