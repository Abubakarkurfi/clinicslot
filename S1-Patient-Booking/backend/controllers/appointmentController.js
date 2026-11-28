/**
 * Appointment Controller (S1 Patient Booking Lead: Abubakar Mansur kurfi)
 * Enforces Content-Type 415, payload sanitization, and mass-assignment protection.
 */

const appointmentService = require('../services/appointmentService');

async function list(req, res, next) {
  try {
    const { doctorId, date, status } = req.query;
    const appointments = await appointmentService.listAppointments(req.user, { doctorId, date, status });
    res.json(appointments);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await appointmentService.getAppointmentById(req.user, id);
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { doctorId, startTime, reason, patientId } = req.body || {};

    if (!doctorId || typeof doctorId !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'doctorId is required and must be a valid ID.' }
      });
    }

    if (!startTime || typeof startTime !== 'string' || isNaN(new Date(startTime).getTime())) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'startTime is required and must be a valid ISO 8601 date string.' }
      });
    }

    if (reason && typeof reason !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'reason must be a text string.' }
      });
    }

    // Server completely ignores any client-provided 'status', 'id', 'createdAt' (Threat 3 Mass Assignment)
    const appointment = await appointmentService.bookAppointment(req.user, {
      doctorId,
      startTime,
      reason,
      targetPatientId: patientId
    });

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { id } = req.params;
    const { startTime } = req.body || {};

    if (!startTime || typeof startTime !== 'string' || isNaN(new Date(startTime).getTime())) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'startTime is required and must be a valid ISO 8601 date string.' }
      });
    }

    const updated = await appointmentService.rescheduleAppointment(req.user, id, startTime);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const cancelled = await appointmentService.cancelAppointment(req.user, id, reason);
    res.json(cancelled);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  reschedule,
  cancel
};
