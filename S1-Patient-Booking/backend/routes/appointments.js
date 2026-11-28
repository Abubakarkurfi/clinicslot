/**
 * Appointment Booking Routes (S1 Patient Booking Lead: Abubakar Mansur kurfi)
 */

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');

// List and single lookup (patients get own, staff gets all)
router.get('/appointments', authenticate, appointmentController.list);
router.get('/appointments/:id', authenticate, appointmentController.getById);

// Book new appointment (Turnstile bot check + auth)
router.post(
  '/appointments',
  verifyTurnstile,
  authenticate,
  authorize('Patient', 'Receptionist'),
  appointmentController.create
);

// Reschedule
router.patch(
  '/appointments/:id',
  authenticate,
  authorize('Patient', 'Receptionist'),
  appointmentController.reschedule
);

// Cancel appointment
router.post(
  '/appointments/:id/cancel',
  authenticate,
  authorize('Patient', 'Receptionist', 'Admin'),
  appointmentController.cancel
);

module.exports = router;
