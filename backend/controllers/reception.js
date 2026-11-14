// S3 controllers: check the request, call the service, send the answer.
const receptionService = require('../services/receptionService');
const { STATUSES, roleCanSet, checkStatusChange } = require('../services/statusRules');
const { sendError, isUuid, isDate, cairoToday, clean } = require('../utils/validation');

// GET /api/schedules?date=YYYY-MM-DD   (no date = today in Cairo)
async function getDayOverview(req, res) {
  const date = req.query.date || cairoToday();
  if (!isDate(date)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date must be a real date in the form YYYY-MM-DD.');
  }
  const doctors = await receptionService.getDayOverview(date);
  const totals = { total: 0, booked: 0, checkedIn: 0, completed: 0, noShow: 0, cancelled: 0 };
  for (const d of doctors) for (const k of Object.keys(totals)) totals[k] += d[k];
  res.status(200).json({ date, totals, doctors });
}

// GET /api/doctors/:id/appointments?date=YYYY-MM-DD
async function getDoctorSchedule(req, res) {
  const { id } = req.params;
  const date = req.query.date || cairoToday();
  if (!isDate(date)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date must be a real date in the form YYYY-MM-DD.');
  }
  // A non-UUID id gets the same 404 as an unknown one (and never reaches the database)
  const doctor = isUuid(id) ? await receptionService.findDoctor(id) : null;
  if (!doctor) return sendError(res, 404, 'DOCTOR_NOT_FOUND', 'Doctor not found.');

  const appointments = await receptionService.getDoctorSchedule(id, date);
  res.status(200).json({ date, doctor, appointments });
}

// PATCH /api/appointments/:id/status   body: { "status": "CheckedIn" | "NoShow" | "Completed" | "Cancelled", "reason": "..." }
async function changeStatus(req, res) {
  if (!req.is('application/json')) {
    return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as application/json.');
  }
  const { id } = req.params;
  const body = req.body || {};
  // Only these two fields are read. checkedInAt, patientId, id... sent by the client are ignored.
  const newStatus = body.status;
  const reason = clean(body.reason);
  const { role, id: actorId } = req.user;

  if (!STATUSES.includes(newStatus) || newStatus === 'Booked') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'status must be CheckedIn, NoShow, Completed or Cancelled.');
  }
  if (reason.length > 200) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'reason must be at most 200 characters.');
  }
  if (newStatus === 'Cancelled' && role !== 'Patient' && reason.length < 3) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Staff must give a cancellation reason (at least 3 characters).');
  }
  if (!roleCanSet(role, newStatus)) {
    return sendError(res, 403, 'FORBIDDEN', `Your role cannot set the status ${newStatus}.`);
  }

  const appt = isUuid(id) ? await receptionService.getAppointmentForStatus(id) : null;
  // A patient asking about someone else's appointment gets the same 404: nothing leaks
  if (!appt || (role === 'Patient' && appt.patientId !== actorId)) {
    return sendError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  }

  const problem = checkStatusChange(appt, newStatus, role);
  if (problem) return sendError(res, 409, 'INVALID_STATUS_CHANGE', problem);

  const updated = await receptionService.updateStatus({
    id, oldStatus: appt.status, newStatus, actorId,
    cancelReason: reason || (role === 'Patient' ? 'Cancelled by patient' : null)
  });
  if (!updated) {
    return sendError(res, 409, 'INVALID_STATUS_CHANGE', 'Someone else changed this appointment. Reload and try again.');
  }
  res.status(200).json(updated);
}

module.exports = { getDayOverview, getDoctorSchedule, changeStatus };
