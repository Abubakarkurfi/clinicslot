/**
 * Auth Controller
 * Validates request payload at the trust boundary and delegates to authService.
 */

const authService = require('../services/authService');

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.length <= 254 && emailRegex.test(email);
}

async function register(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { fullName, email, phone, password } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Full name is required (2 to 100 characters).' }
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' }
      });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7 || phone.trim().length > 20) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid phone number is required (7 to 20 characters).' }
      });
    }

    if (!password || typeof password !== 'string' || password.length < 10) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 10 characters long.' }
      });
    }

    const result = await authService.registerPatient({
      fullName,
      email,
      phone,
      password
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
    }

    const result = await authService.loginUser({ email, password });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login
};
