/**
 * Public Holiday Routes (S2 Doctor & Schedule Lead: Omar Osama)
 */

const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin triggers import from Nager.Date external API
router.post('/holidays', authenticate, authorize('Admin'), holidayController.importHolidays);

module.exports = router;
