import { Router } from 'express';
import Agent from '../models/Agent.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const agents = await Agent.find().sort({ totalInquiries: -1 }).lean();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
