import { Router } from 'express';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { sanitizeLog, sanitizeString } from '../utils/security.js';

const router = Router();

export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name, email and password must be scalar strings' });
    }

    const cleanName = sanitizeString(name, 200);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (cleanEmail.length > 254 || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
    });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Register error:', sanitizeLog(err));
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password must be scalar strings' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', sanitizeLog(err));
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string') {
      return res.status(400).json({ error: 'Email must be a scalar string' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }
    res.json({ ok: true, name: user.name });
  } catch (err) {
    console.error('Verify email error:', sanitizeLog(err));
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password must be scalar strings' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }
    user.password = password;
    await user.save();
    res.json({ ok: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Forgot password error:', sanitizeLog(err));
    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;
