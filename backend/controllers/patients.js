// GET /api/patients?search=   and   POST /api/patients (walk-in)
const patientService = require('../services/patientService');
const { sendError, clean } = require('../utils/validation');

const PHONE_RE = /^\+?[0-9]{8,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function searchPatients(req, res) {
  const term = clean(req.query.search);
  if (term.length < 2 || term.length > 50) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'search must be 2 to 50 characters.');
  }
  const patients = await patientService.search(term);
  res.status(200).json(patients);
}

async function registerWalkIn(req, res) {
  if (!req.is('application/json')) {
    return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as application/json.');
  }
  const body = req.body || {};
  // Only these three fields are read; "role", "id" etc. in the body are ignored
  const fullName = clean(body.fullName);
  const phone = clean(body.phone).replace(/[\s-]/g, '');
  const email = clean(body.email).toLowerCase() || null;

  if (fullName.length < 2 || fullName.length > 100) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'fullName must be 2 to 100 characters.');
  }
  if (!PHONE_RE.test(phone)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'phone must be 8 to 15 digits (an optional + at the start).');
  }
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'email is not valid.');
  }
  if (await patientService.findByPhone(phone)) {
    return sendError(res, 409, 'PATIENT_EXISTS', 'A patient with this phone number already exists. Search for them instead.');
  }

  try {
    const patient = await patientService.createWalkIn({ fullName, phone, email, actorId: req.user.id });
    res.status(201).json(patient);
  } catch (err) {
    // 23505 = unique rule broken (same email, or the same phone added a moment ago)
    if (err.code === '23505') {
      return sendError(res, 409, 'EMAIL_IN_USE', 'This email or phone is already used by another account.');
    }
    throw err;
  }
}

module.exports = { searchPatients, registerWalkIn };
