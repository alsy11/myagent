const express = require('express');
const router = express.Router();
const userService = require('./userService');
const { requireAuth } = require('./authMiddleware');

/**
 * POST /api/users/register
 * Register a new user.
 * Body: { username, password, displayName? }
 */
router.post('/register', async (req, res, next) => {
  try {
    const result = await userService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('at least') || err.message.includes('already taken')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/users/login
 * Login with username and password.
 * Body: { username, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const result = await userService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Invalid username or password') {
      return res.status(401).json({ success: false, error: err.message });
    }
    if (err.message.includes('required')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/users/me
 * Get current user profile.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
