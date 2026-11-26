/**
 * Auth Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyTurnstile } = require('../middleware/turnstile');
const { authenticate } = require('../middleware/auth');

// Public endpoints
router.post('/users', verifyTurnstile, authController.register);
router.post('/sessions', authController.login);

// Verify current session
router.get('/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
