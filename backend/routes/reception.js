// S3 routes: method + path + who may call it + which controller runs.
// Mounted in server.js with: app.use('/api', receptionRoutes);
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const reception = require('../controllers/reception');
const patients = require('../controllers/patients');
const auditLog = require('../controllers/auditLog');

const router = express.Router();

router.get('/schedules', authenticate, authorize('Receptionist', 'Admin'), reception.getDayOverview);
router.get('/doctors/:id/appointments', authenticate, authorize('Receptionist', 'Admin'), reception.getDoctorSchedule);
router.patch('/appointments/:id/status', authenticate, authorize('Receptionist', 'Admin', 'Patient'), reception.changeStatus);

router.get('/patients', authenticate, authorize('Receptionist', 'Admin'), patients.searchPatients);
router.post('/patients', authenticate, authorize('Receptionist'), patients.registerWalkIn);

router.get('/audit-log', authenticate, authorize('Admin'), auditLog.getAuditLog);

module.exports = router;
