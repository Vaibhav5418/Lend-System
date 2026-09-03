/**
 * Groq API summarization. Uses OpenAI-compatible Chat Completions.
 * Set GROQ_API_KEY in .env. Optionally GROQ_MODEL (e.g. llama-3.1-8b-instant, llama-3.3-70b-versatile).
 * For combined report with many/large PDFs: add GROQ_API_KEY_1, GROQ_API_KEY_2, ... GROQ_API_KEY_11
 * to spread load and avoid TPM (tokens per minute) limits; content is chunked and processed in parallel.
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

/** Max characters per chunk to stay under Groq request/TPM limits (~2500 tokens). */
const MAX_CHUNK_CHARS = 10000;

/** Delay between batches of parallel requests (TPM window). */
const DELAY_BETWEEN_BATCHES_MS = 32_000;
/** Max chunks to run in parallel (one per key to spread TPM). */
const PARALLEL_BATCH_SIZE = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse "Please try again in 32.439999999s" or "in 32s" from Groq rate-limit error.
 * @param {string} errStr
 * @returns {number|null} Wait time in ms, or null.
 */
function parseRetryAfterMs(errStr) {
  if (!errStr || typeof errStr !== 'string') return null;
  const m = errStr.match(/please try again in ([\d.]+)\s*s/i);
  if (!m) return null;
  const sec = parseFloat(m[1]);
  if (Number.isNaN(sec) || sec <= 0) return null;
  const ms = Math.ceil(Math.min(90, Math.max(30, sec)) * 1000);
  return ms;
}

/**
 * Build API key pool from env: GROQ_API_KEY_1 .. GROQ_API_KEY_11, then GROQ_API_KEY.
 * @returns {string[]} Non-empty array of API keys (may be a single key).
 */
function getGroqKeyPool() {
  const keys = [];
  for (let i = 1; i <= 11; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key && String(key).trim()) keys.push(String(key).trim());
  }
  const fallback = process.env.GROQ_API_KEY;
  if (fallback && String(fallback).trim()) keys.push(String(fallback).trim());
  return keys;
}

/**
 * Split content into chunks under maxChunkChars. Prefer splitting at "--- Document:" boundaries.
 * @param {string} content
 * @param {number} maxChunkChars
 * @returns {string[]}
 */
function chunkText(content, maxChunkChars = MAX_CHUNK_CHARS) {
  const text = String(content).trim();
  if (!text || text.length <= maxChunkChars) return text ? [text] : [];

  const chunks = [];
  const separator = '\n\n--- Document:';
  let rest = text;

  while (rest.length > 0) {
    if (rest.length <= maxChunkChars) {
      chunks.push(rest.trim());
      break;
    }
    let block = rest.slice(0, maxChunkChars);
    const nextStart = rest.slice(maxChunkChars);
    const lastSep = block.lastIndexOf(separator);
    if (lastSep > maxChunkChars * 0.4) {
      block = rest.slice(0, lastSep);
      rest = rest.slice(lastSep);
    } else {
      const lastNewline = block.lastIndexOf('\n');
      if (lastNewline > maxChunkChars * 0.3) {
        block = rest.slice(0, lastNewline + 1);
        rest = rest.slice(lastNewline + 1);
      } else {
        rest = rest.slice(maxChunkChars);
      }
    }
    if (block.trim()) chunks.push(block.trim());
  }

  return chunks;
}

/**
 * Single Groq chat completion with the given API key.
 * @param {string} apiKey
 * @param {{ model: string, messages: Array<{role: string, content: string}>, max_tokens: number }} options
 * @returns {Promise<{ ok: boolean, content?: string, status: number, errStr?: string }>}
 */
async function groqChatWithKey(apiKey, options) {
  const { model, messages, max_tokens } = options;
  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens }),
  });

  const errText = await response.text();
  if (!response.ok) {
    let errStr = errText.slice(0, 500);
    try {
      const errJson = JSON.parse(errText);
      const msg = errJson?.error ?? errJson?.message ?? errText;
      errStr = typeof msg === 'string' ? msg : msg?.message || JSON.stringify(msg);
    } catch (_) {}
    return { ok: false, status: response.status, errStr };
  }

  let data;
  try {
    data = JSON.parse(errText);
  } catch {
    return { ok: false, status: response.status, errStr: 'Invalid JSON response' };
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  return { ok: true, content: content || '', status: response.status };
}

export async function summarizeWithGrok(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return 'Summary unavailable (GROQ_API_KEY not set).';
  }

  if (!text || String(text).trim().length < 10) {
    return 'Document has little or no extractable text.';
  }

  const model = process.env.GROQ_MODEL || GROQ_MODEL;
  const truncated = String(text).trim().slice(0, 12000);
  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a Financial Expert. The user uploads company legal or financial documents. Prepare a complete financial summary for funding purpose. Extract and present in Markdown using tables. Use these section headings: 1) **Company Profile** – table: Particular | Details (Company Name, CIN, Address, etc.). 2) **FINANCIAL SNAPSHOT** – for each FY (e.g. FY 2022–23 Audited, FY 2023–24 ITR Filed): table Metric | Amount. 3) **GST TURNOVER SUMMARY** – table: Financial Year | Sales (₹). 4) **FUNDING READINESS ASSESSMENT** – table: Parameter | Status (Yes/No or Ready/Pending). If data is missing for a section, write "Not found in document". If the document is not financial/legal, give a brief 2–3 sentence summary instead. Output only Markdown.',
        },
        {
          role: 'user',
          content: 'Prepare complete financial details for funding from this document. Output only the Markdown tables (Company Profile, Financial Snapshot, GST Turnover Summary, Funding Readiness Assessment).\n\n---\n' + truncated,
        },
      ],
      max_tokens: 2000,
    }),
  });

  const errText = await response.text();
  if (!response.ok) {
    console.error('Groq API error:', response.status, errText);
    try {
      const errJson = JSON.parse(errText);
      const msg = errJson?.error ?? errJson?.message ?? errText.slice(0, 200);
      const errStr = typeof msg === 'string' ? msg : msg?.message || JSON.stringify(msg);
      if (response.status === 401 && /invalid|unauthorized|api key/i.test(errStr)) {
        return 'Summary unavailable (invalid Groq API key). Set a valid GROQ_API_KEY in server/.env from https://console.groq.com';
      }
      return `Summary unavailable (${errStr}). Use the AI button to retry.`;
    } catch {
      return `Summary unavailable (API error: ${response.status}). Use the AI button to retry.`;
    }
  }

  let data;
  try {
    data = JSON.parse(errText);
  } catch {
    return 'Summary unavailable (invalid response).';
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || 'Summary unavailable.';
}

const COMBINED_SYSTEM_PROMPT = `You are a Financial Expert. You will receive content from one or more company documents (legal/financial). Your task is to produce ONE combined report in Markdown only. Use exactly these four section headings and table formats. Merge data from all documents; if the same metric appears in multiple docs, keep one row with the best or latest value. Use "Not found in documents" only when no data exists for that section.

1) **Company Profile** – table with columns: Particular | Details
   (e.g. Company Name, CIN, Address, PAN, etc.)

2) **Financial Snapshot** – one table with columns: Metric | FY 2022-23 Audited | FY 2023-24 ITR Filed | (add other FY columns as needed, e.g. FY 2021-22 Audited)
   Put each financial year as a column header; rows are metrics like Revenue, PAT, Net Worth, etc.

3) **GST Turnover Summary** – table with columns: Financial Year | Sales (₹)
   One row per year; sales in rupees.

4) **Funding Readiness Assessment** – table with columns: Parameter | Status
   (e.g. Audited financials: Yes/No, ITR filed: Ready/Pending, etc.)

Output only Markdown. No extra commentary before or after the tables.`;

/**
 * Merge multiple partial markdown reports in code (no API call = no TPM, no timeout).
 * Extracts the 4 sections from each partial and combines tables (dedupe by first column where appropriate).
 */
function mergePartialReportsInCode(partials) {
  const sectionNames = [
    'Company Profile',
    'Financial Snapshot',
    'GST Turnover Summary',
    'Funding Readiness Assessment',
  ];
  const sectionBlocks = sectionNames.map(() => []);

  function findSectionContent(md, title) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match **Title** or ## Title (with optional prefix like "1) "); capture content until next section or end
    const patterns = [
      new RegExp(`\\*\\*\\s*${escaped}\\s*\\*\\*[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*(?:\\d+\\s*[.)]\\s*)?\\*\\*|\\n\\s*#+\\s|$)`, 'i'),
      new RegExp(`#+\\s*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*#+|\\n\\s*\\*\\*|$)`, 'i'),
    ];
    for (const re of patterns) {
      const m = md.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  }

  function extractTableRows(block) {
    const lines = block.split('\n').filter((l) => l.trim().startsWith('|'));
    const rows = lines.map((line) => {
      const parts = line.split('|').map((c) => c.trim());
      // "| A | B |" => ["", "A", "B", ""]; we want ["A", "B"]
      const cells = parts.length > 2 ? parts.slice(1, -1) : parts;
      return cells;
    });
    return rows.filter((r) => {
      if (!r.some((c) => c.length > 0)) return false;
      const allSep = r.every((c) => !c || /^-+$/.test(c));
      return !allSep; // skip separator line | --- | --- |
    });
  }

  for (const p of partials) {
    if (!p || typeof p !== 'string') continue;
    for (let i = 0; i < sectionNames.length; i++) {
      const block = findSectionContent(p, sectionNames[i]);
      if (block) sectionBlocks[i].push(block);
    }
  }

  const out = [];
  const dedupeByFirstCol = [0, 3]; // Company Profile, Funding Readiness: dedupe by first column

  for (let i = 0; i < sectionNames.length; i++) {
    out.push(`**${sectionNames[i]}**\n`);
    const blocks = sectionBlocks[i];
    if (!blocks.length) {
      out.push('| — | — |\n| --- | --- |\n| Not found in documents | — |\n\n');
      continue;
    }
    const allRows = [];
    const seenFirst = new Map();
    for (const block of blocks) {
      const rows = extractTableRows(block);
      for (const row of rows) {
        if (row.length < 1) continue;
        const first = (row[0] || '').trim();
        const isHeader =
          /^(metric|particular|parameter|financial year|—|---)$/i.test(first) ||
          first.includes('FY ') ||
          first === '';
        if (isHeader && allRows.length === 0) {
          allRows.push(row);
          continue;
        }
        if (isHeader) continue;
        if (dedupeByFirstCol.includes(i)) {
          seenFirst.set(first, row);
        } else {
          allRows.push(row);
        }
      }
    }
    if (dedupeByFirstCol.includes(i) && seenFirst.size > 0) {
      const header = allRows[0] || ['Particular', 'Details'];
      out.push('| ' + header.join(' | ') + ' |\n| ' + header.map(() => '---').join(' | ') + ' |\n');
      for (const row of seenFirst.values()) out.push('| ' + row.join(' | ') + ' |\n');
    } else if (allRows.length > 0) {
      const header = allRows[0];
      out.push('| ' + header.join(' | ') + ' |\n| ' + header.map(() => '---').join(' | ') + ' |\n');
      for (let j = 1; j < allRows.length; j++) out.push('| ' + allRows[j].join(' | ') + ' |\n');
    } else {
      out.push('| Not found in documents | — |\n');
    }
    out.push('\n');
  }

  return out.join('').trim();
}

/**
 * Generate one combined report from concatenated content of multiple documents.
 * Uses a pool of API keys (GROQ_API_KEY_1..11, GROQ_API_KEY) and chunks content so each
 * request stays under TPM/request limits; if one key hits rate limit, others continue.
 * @param {string} combinedContent - All document texts/summaries concatenated (e.g. with "--- Document: name ---" separators).
 * @returns {Promise<string>} Markdown with the four tables.
 */
export async function generateCombinedReport(combinedContent) {
  const keyPool = getGroqKeyPool();
  if (keyPool.length === 0) {
    return 'Combined report unavailable (GROQ_API_KEY not set). Add at least GROQ_API_KEY or GROQ_API_KEY_1..11 in server/.env';
  }

  const trimmed = String(combinedContent || '').trim();
  if (trimmed.length < 10) {
    return 'No document content available to generate a combined report.';
  }

  const model = process.env.GROQ_MODEL || GROQ_MODEL;
  const chunks = chunkText(trimmed, MAX_CHUNK_CHARS);

  // Single chunk and single key: one request (backward compatible)
  if (chunks.length === 1 && keyPool.length === 1) {
    const result = await groqChatWithKey(keyPool[0], {
      model,
      messages: [
        { role: 'system', content: COMBINED_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Prepare a single combined financial report from the following document content. Output only the Markdown with the four sections: Company Profile (Particular | Details), Financial Snapshot (Metric | FY 2022-23 Audited | FY 2023-24 ITR Filed and other years), GST Turnover Summary (Financial Year | Sales (₹)), Funding Readiness Assessment (Parameter | Status).\n\n---\n${chunks[0]}`,
        },
      ],
      max_tokens: 4000,
    });
    if (result.ok) return result.content || 'Combined report unavailable.';
    return `Combined report unavailable (${result.errStr}).`;
  }

  function isRateLimitError(result) {
    if (!result || result.ok) return false;
    const s = (result.errStr || '').toLowerCase();
    return result.status === 429 || /tokens per minute|tpm|rate limit|request too large/i.test(s);
  }

  const maxRateLimitRetries = 6;
  const batchSize = Math.min(PARALLEL_BATCH_SIZE, keyPool.length, chunks.length) || 1;

  /** Process one chunk with wait-and-retry on rate limit. Returns content or throws. */
  async function processOneChunk(chunk, apiKey) {
    for (let r = 0; r <= maxRateLimitRetries; r++) {
      const result = await groqChatWithKey(apiKey, {
        model,
        messages: [
          { role: 'system', content: COMBINED_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Prepare a partial financial report from this document content. Output only Markdown with the four sections: Company Profile (Particular | Details), Financial Snapshot (Metric | FY columns), GST Turnover Summary (Financial Year | Sales (₹)), Funding Readiness Assessment (Parameter | Status).\n\n---\n${chunk}`,
          },
        ],
        max_tokens: 4000,
      });
      if (result.ok && result.content) return result.content;
      if (!isRateLimitError(result)) throw new Error(result.errStr || `HTTP ${result.status}`);
      const waitMs = parseRetryAfterMs(result.errStr) || DELAY_BETWEEN_BATCHES_MS;
      if (r < maxRateLimitRetries) await sleep(waitMs);
      else throw new Error(result.errStr || 'Rate limit');
    }
    throw new Error('Rate limit');
  }

  const partials = [];
  for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
    const batch = chunks.slice(batchStart, batchStart + batchSize);
    const batchNum = Math.floor(batchStart / batchSize) + 1;
    const totalBatches = Math.ceil(chunks.length / batchSize);
    if (totalBatches > 1) console.warn(`Combined report: batch ${batchNum}/${totalBatches} (${batch.length} chunks in parallel)`);
    const results = await Promise.all(
      batch.map((chunk, i) => processOneChunk(chunk, keyPool[(batchStart + i) % keyPool.length]))
    );
    partials.push(...results);
    if (batchStart + batch.length < chunks.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  if (partials.length === 0) {
    return 'Combined report unavailable (no partial results).';
  }

  if (partials.length === 1) {
    return partials[0];
  }

  // Merge in code (no API call = no TPM, no timeout, no fetch error)
  return mergePartialReportsInCode(partials);
}

const PROFILE_SCORE_PROMPT = `You are a financial analyst. Given a combined financial report (Company Profile, Financial Snapshot, GST Turnover, Funding Readiness), assign a single "Profile Score" similar to CIBIL score: a number from 300 to 900 indicating funding readiness and document strength. Also assign a one-word rating: Excellent (750+), Good (650-749), Fair (550-649), Poor (300-549).
Respond with ONLY a valid JSON object, no other text or markdown. Example: {"score":720,"rating":"Good"}`;

/**
 * Generate a CIBIL-like profile score (300-900) and rating from the combined report markdown.
 * @param {string} reportMarkdown
 * @returns {Promise<{ score: number, rating: string }|null>}
 */
export async function generateProfileScore(reportMarkdown) {
  const keyPool = getGroqKeyPool();
  if (keyPool.length === 0 || !reportMarkdown || String(reportMarkdown).trim().length < 20) return null;

  const excerpt = String(reportMarkdown).trim().slice(0, 4000);
  const model = process.env.GROQ_MODEL || GROQ_MODEL;
  const result = await groqChatWithKey(keyPool[0], {
    model,
    messages: [
      { role: 'system', content: PROFILE_SCORE_PROMPT },
      { role: 'user', content: `Based on this report, output only JSON with "score" (300-900) and "rating" (Excellent/Good/Fair/Poor).\n\n${excerpt}` },
    ],
    max_tokens: 100,
  });

  if (!result.ok || !result.content) return null;
  try {
    const raw = result.content.replace(/```\w*\n?|\n?```/g, '').trim();
    const data = JSON.parse(raw);
    const score = typeof data.score === 'number' ? Math.min(900, Math.max(300, data.score)) : null;
    const rating = typeof data.rating === 'string' ? data.rating.trim() : null;
    if (score != null && rating) return { score, rating };
  } catch (_) {}
  return null;
}
