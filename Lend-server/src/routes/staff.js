import { Router } from 'express';
import Staff from '../models/Staff.js';
import { sanitizeLog } from '../utils/security.js';

const router = Router();

const DEFAULT_STAFF = Object.freeze(['Amit Shah', 'Neha Kapoor', 'Rahul Verma']);

router.get('/', async (_req, res) => {
  try {
    const list = await Staff.find().sort({ order: 1 }).select('name').lean();
    const names = list.length > 0 ? list.map((s) => s.name) : DEFAULT_STAFF;
    res.json(names);
  } catch (err) {
    console.error('Fetch staff error:', sanitizeLog(err));
    res.status(500).json({ error: 'Unable to fetch staff' });
  }
});

export default router;
