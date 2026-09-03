import { Router } from 'express';
import Staff from '../models/Staff.js';

const router = Router();

const DEFAULT_STAFF = ['Amit Shah', 'Neha Kapoor', 'Rahul Verma'];

router.get('/', async (req, res) => {
  try {
    const list = await Staff.find().sort({ order: 1 }).select('name').lean();
    const names = list.length > 0 ? list.map((s) => s.name) : DEFAULT_STAFF;
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
