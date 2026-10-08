import { Router } from 'express';
import Agent from '../models/Agent.js';
import { sanitizeLog } from '../utils/security.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const agents = await Agent.find().sort({ totalInquiries: -1 }).lean();
    res.json(agents);
  } catch (err) {
    console.error('Fetch agents error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch agents' });
  }
});

export default router;
