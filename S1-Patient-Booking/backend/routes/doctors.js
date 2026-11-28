/**
 * Doctor & Specialty Routes (S2 Doctor & Schedule Lead: Omar Osama)
 */

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// Public catalog / search endpoints
router.get('/specialties', doctorController.listSpecialties);
router.post('/specialties', authenticate, authorize('Admin'), doctorController.createSpecialty);

router.get('/doctors', doctorController.listDoctors);
router.get('/doctors/:id', doctorController.getDoctor);

// Free slots generation (available for booking and reception)
router.get('/doctors/:id/slots', optionalAuth, doctorController.getDoctorSlots);

// Working hours
router.get('/doctors/:id/hours', doctorController.getHours);
router.post('/doctors/:id/hours', authenticate, authorize('Admin'), doctorController.setHours);

// Doctor management (Admin only)
router.post('/doctors', authenticate, authorize('Admin'), doctorController.createDoctor);
router.patch('/doctors/:id', authenticate, authorize('Admin'), doctorController.updateDoctor);

// Time off blocking (Admin and Receptionist)
router.post('/doctors/:id/time-off', authenticate, authorize('Admin', 'Receptionist'), doctorController.addTimeOff);

module.exports = router;
