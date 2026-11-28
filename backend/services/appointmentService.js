/**
 * Appointment Booking Service (S1 Patient Booking Lead: Abubakar Mansur kurfi)
 * Enforces ownership rules, double-booking prevention, 3-booking patient limit,
 * and 2-hour rescheduling/cancellation window.
 */

const { query, memoryStore } = require('../db');
const { getDoctorById } = require('./doctorService');
const { getFreeSlots } = require('./slotService');
const { recordAuditEvent } = require('./auditService');
const { publishBookingNotification, cacheInDynamoDBQueue } = require('./awsClient');
const crypto = require('crypto');

const MAX_ACTIVE_BOOKINGS_PER_PATIENT = 3;
const MIN_HOURS_BEFORE_CANCEL = 2;

/**
 * List appointments with role-based ownership filtering
 */
async function listAppointments(user, { doctorId, date, status }) {
  const isStaff = user.role === 'Receptionist' || user.role === 'Admin';
  const patientId = isStaff ? null : user.id; // Patients can ONLY see their own bookings (IDOR mitigation)

  if (process.env.DATABASE_URL) {
    let sqlStr = `
      SELECT a.id, a.patient_id as "patientId", a.doctor_id as "doctorId",
             a.start_time as "startTime", a.end_time as "endTime",
             a.status, a.reason, a.created_by as "createdBy",
             a.cancel_reason as "cancelReason", a.checked_in_at as "checkedInAt",
             a.created_at as "createdAt",
             u.full_name as "patientName", u.phone as "patientPhone", u.email as "patientEmail",
             d.full_name as "doctorName", d.room as "doctorRoom", s.name as "specialtyName"
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN specialties s ON d.specialty_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (patientId) {
      params.push(patientId);
      sqlStr += ` AND a.patient_id = $${params.length}`;
    }

    if (doctorId) {
      params.push(doctorId);
      sqlStr += ` AND a.doctor_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sqlStr += ` AND a.status = $${params.length}`;
    }

    if (date) {
      params.push(`${date}T00:00:00Z`);
      params.push(`${date}T23:59:59Z`);
      sqlStr += ` AND a.start_time >= $${params.length - 1} AND a.start_time <= $${params.length}`;
    }

    sqlStr += ` ORDER BY a.start_time ASC`;
    return await query(sqlStr, params);
  }

  // In-Memory store fallback
  let list = memoryStore.appointments;
  if (patientId) {
    list = list.filter(a => a.patientId === patientId);
  }
  if (doctorId) {
    list = list.filter(a => a.doctorId === doctorId);
  }
  if (status) {
    list = list.filter(a => a.status === status);
  }
  if (date) {
    list = list.filter(a => a.startTime.startsWith(date));
  }

  return list.map(a => {
    const p = memoryStore.users.find(u => u.id === a.patientId);
    const d = memoryStore.doctors.find(doc => doc.id === a.doctorId);
    const spec = d ? memoryStore.specialties.find(s => s.id === d.specialtyId) : null;
    return {
      ...a,
      patientName: p ? p.fullName : 'Unknown',
      patientPhone: p ? p.phone : '',
      patientEmail: p ? p.email : '',
      doctorName: d ? d.fullName : 'Unknown',
      doctorRoom: d ? d.room : '',
      specialtyName: spec ? spec.name : 'Unknown'
    };
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

/**
 * Get single appointment with ownership verification
 */
async function getAppointmentById(user, appointmentId) {
  const isStaff = user.role === 'Receptionist' || user.role === 'Admin';

  if (process.env.DATABASE_URL) {
    const rows = await query(
      `SELECT a.id, a.patient_id as "patientId", a.doctor_id as "doctorId",
              a.start_time as "startTime", a.end_time as "endTime",
              a.status, a.reason, a.created_by as "createdBy",
              a.cancel_reason as "cancelReason", a.checked_in_at as "checkedInAt",
              a.created_at as "createdAt",
              u.full_name as "patientName", u.phone as "patientPhone", u.email as "patientEmail",
              d.full_name as "doctorName", d.room as "doctorRoom", s.name as "specialtyName"
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN specialties s ON d.specialty_id = s.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    const apt = rows[0];
    if (!apt) {
      const err = new Error('Appointment not found.');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Ownership check (Threat 4 mitigation / Test T-X03)
    if (!isStaff && apt.patientId !== user.id) {
      const err = new Error('Appointment not found.');
      err.code = 'APPOINTMENT_NOT_FOUND'; // Intentionally 404 to avoid leaking existence
      err.statusCode = 404;
      throw err;
    }

    return apt;
  }

  const apt = memoryStore.appointments.find(a => a.id === appointmentId);
  if (!apt) {
    const err = new Error('Appointment not found.');
    err.code = 'APPOINTMENT_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  if (!isStaff && apt.patientId !== user.id) {
    const err = new Error('Appointment not found.');
    err.code = 'APPOINTMENT_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const p = memoryStore.users.find(u => u.id === apt.patientId);
  const d = memoryStore.doctors.find(doc => doc.id === apt.doctorId);
  const spec = d ? memoryStore.specialties.find(s => s.id === d.specialtyId) : null;

  return {
    ...apt,
    patientName: p ? p.fullName : 'Unknown',
    patientPhone: p ? p.phone : '',
    patientEmail: p ? p.email : '',
    doctorName: d ? d.fullName : 'Unknown',
    doctorRoom: d ? d.room : '',
    specialtyName: spec ? spec.name : 'Unknown'
  };
}

/**
 * Book an appointment
 */
async function bookAppointment(user, { doctorId, startTime, reason, targetPatientId }) {
  // 1. Determine effective patient ID (Self or Walk-in via Receptionist)
  let effectivePatientId = user.id;
  if (user.role === 'Receptionist' && targetPatientId) {
    effectivePatientId = targetPatientId;
  }

  // 2. Doctor existence and status check
  const doctor = await getDoctorById(doctorId);
  if (!doctor || !doctor.isActive) {
    const err = new Error('Doctor not found or currently inactive.');
    err.code = 'DOCTOR_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // 3. Time validation: must be in the future
  const start = new Date(startTime);
  if (isNaN(start.getTime()) || start <= new Date()) {
    const err = new Error('Appointment start time must be in the future.');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  // Calculate endTime based on doctor's slot minutes
  const end = new Date(start.getTime() + (doctor.slotMinutes || 30) * 60000);
  const endTimeIso = end.toISOString();
  const startTimeIso = start.toISOString();

  // 4. Maximum active bookings limit (Threat 10 slot hoarding protection)
  if (user.role === 'Patient') {
    let activeCount = 0;
    if (process.env.DATABASE_URL) {
      const countRes = await query(
        `SELECT COUNT(*) as count FROM appointments
         WHERE patient_id = $1 AND start_time > now() AND status IN ('Booked', 'CheckedIn')`,
        [effectivePatientId]
      );
      activeCount = parseInt(countRes[0].count, 10);
    } else {
      activeCount = memoryStore.appointments.filter(a =>
        a.patientId === effectivePatientId &&
        new Date(a.startTime) > new Date() &&
        ['Booked', 'CheckedIn'].includes(a.status)
      ).length;
    }

    if (activeCount >= MAX_ACTIVE_BOOKINGS_PER_PATIENT) {
      const err = new Error(`Patients are limited to a maximum of ${MAX_ACTIVE_BOOKINGS_PER_PATIENT} active upcoming appointments.`);
      err.code = 'BOOKING_LIMIT_REACHED';
      err.statusCode = 400;
      throw err;
    }
  }

  // 5. Verify slot availability via slotService
  const dateStr = startTimeIso.split('T')[0];
  const freeSlotsData = await getFreeSlots(doctorId, dateStr);

  if (freeSlotsData.closed) {
    const err = new Error(`Cannot book on this date: ${freeSlotsData.closureReason}`);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  const slotAvailable = freeSlotsData.slots.some(s => s.startTime === startTimeIso);
  if (!slotAvailable) {
    const err = new Error('This slot has just been booked or is outside doctor clinic hours. Please choose another.');
    err.code = 'SLOT_TAKEN';
    err.statusCode = 409;
    throw err;
  }

  // 6. Insert appointment with database-enforced concurrency protection
  const cleanReason = reason ? String(reason).trim().substring(0, 200) : null;

  if (process.env.DATABASE_URL) {
    try {
      const res = await query(
        `INSERT INTO appointments (patient_id, doctor_id, start_time, end_time, status, reason, created_by)
         VALUES ($1, $2, $3, $4, 'Booked', $5, $6)
         RETURNING id, patient_id as "patientId", doctor_id as "doctorId",
                   start_time as "startTime", end_time as "endTime",
                   status, reason, created_by as "createdBy", created_at as "createdAt"`,
        [effectivePatientId, doctorId, startTimeIso, endTimeIso, cleanReason, user.id]
      );

      const created = res[0];
      await recordAuditEvent(user.id, 'APPOINTMENT_BOOKED', created.id, `Booked with ${doctor.fullName} at ${startTimeIso}`);
      // AWS / Floci Integration: Publish to SNS and Cache in DynamoDB
      publishBookingNotification('APPOINTMENT_BOOKED', created).catch(() => {});
      cacheInDynamoDBQueue({ ...created, doctorName: doctor.fullName }).catch(() => {});
      return created;
    } catch (dbErr) {
      // Postgres unique constraint violation error code 23505
      if (dbErr.code === '23505' || dbErr.message.includes('unique')) {
        const err = new Error('This slot has just been booked. Please choose another.');
        err.code = 'SLOT_TAKEN';
        err.statusCode = 409;
        throw err;
      }
      throw dbErr;
    }
  }

  // Fallback memory insertion
  const conflict = memoryStore.appointments.find(a =>
    a.doctorId === doctorId &&
    a.startTime === startTimeIso &&
    a.status !== 'Cancelled'
  );

  if (conflict) {
    const err = new Error('This slot has just been booked. Please choose another.');
    err.code = 'SLOT_TAKEN';
    err.statusCode = 409;
    throw err;
  }

  const newApt = {
    id: crypto.randomUUID(),
    patientId: effectivePatientId,
    doctorId,
    startTime: startTimeIso,
    endTime: endTimeIso,
    status: 'Booked',
    reason: cleanReason,
    createdBy: user.id,
    cancelReason: null,
    checkedInAt: null,
    createdAt: new Date().toISOString()
  };

  memoryStore.appointments.push(newApt);
  await recordAuditEvent(user.id, 'APPOINTMENT_BOOKED', newApt.id, `Booked with ${doctor.fullName} at ${startTimeIso}`);
  publishBookingNotification('APPOINTMENT_BOOKED', newApt).catch(() => {});
  cacheInDynamoDBQueue({ ...newApt, doctorName: doctor.fullName }).catch(() => {});

  return newApt;
}

/**
 * Reschedule an appointment
 */
async function rescheduleAppointment(user, appointmentId, newStartTime) {
  const apt = await getAppointmentById(user, appointmentId);

  // Status check
  if (['Completed', 'Cancelled', 'NoShow'].includes(apt.status)) {
    const err = new Error(`Cannot reschedule an appointment with status '${apt.status}'.`);
    err.code = 'INVALID_STATUS_CHANGE';
    err.statusCode = 409;
    throw err;
  }

  // 2-hour window check for patients
  if (user.role === 'Patient') {
    const hoursRemaining = (new Date(apt.startTime).getTime() - Date.now()) / (1000 * 3600);
    if (hoursRemaining < MIN_HOURS_BEFORE_CANCEL) {
      const err = new Error(`Patients can only reschedule up to ${MIN_HOURS_BEFORE_CANCEL} hours prior to appointment time.`);
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
  }

  const doctor = await getDoctorById(apt.doctorId);
  const start = new Date(newStartTime);
  if (isNaN(start.getTime()) || start <= new Date()) {
    const err = new Error('New appointment start time must be in the future.');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  const startTimeIso = start.toISOString();
  const end = new Date(start.getTime() + (doctor.slotMinutes || 30) * 60000);
  const endTimeIso = end.toISOString();

  // Verify new slot is free
  const dateStr = startTimeIso.split('T')[0];
  const freeSlotsData = await getFreeSlots(apt.doctorId, dateStr);
  const slotAvailable = freeSlotsData.slots.some(s => s.startTime === startTimeIso);

  if (!slotAvailable) {
    const err = new Error('The selected new slot is not available. Please choose another.');
    err.code = 'SLOT_TAKEN';
    err.statusCode = 409;
    throw err;
  }

  if (process.env.DATABASE_URL) {
    try {
      const res = await query(
        `UPDATE appointments 
         SET start_time = $1, end_time = $2, status = 'Booked'
         WHERE id = $3
         RETURNING id, patient_id as "patientId", doctor_id as "doctorId", start_time as "startTime", end_time as "endTime", status`,
        [startTimeIso, endTimeIso, appointmentId]
      );
      await recordAuditEvent(user.id, 'APPOINTMENT_RESCHEDULED', appointmentId, `Rescheduled to ${startTimeIso}`);
      return res[0];
    } catch (dbErr) {
      if (dbErr.code === '23505' || dbErr.message.includes('unique')) {
        const err = new Error('The selected new slot has just been booked. Please choose another.');
        err.code = 'SLOT_TAKEN';
        err.statusCode = 409;
        throw err;
      }
      throw dbErr;
    }
  }

  apt.startTime = startTimeIso;
  apt.endTime = endTimeIso;
  apt.status = 'Booked';

  await recordAuditEvent(user.id, 'APPOINTMENT_RESCHEDULED', appointmentId, `Rescheduled to ${startTimeIso}`);
  return apt;
}

/**
 * Cancel an appointment
 */
async function cancelAppointment(user, appointmentId, reason) {
  const apt = await getAppointmentById(user, appointmentId);

  if (apt.status === 'Cancelled') {
    const err = new Error('Appointment is already cancelled.');
    err.code = 'INVALID_STATUS_CHANGE';
    err.statusCode = 409;
    throw err;
  }

  if (['Completed', 'NoShow'].includes(apt.status)) {
    const err = new Error(`Cannot cancel an appointment that is already '${apt.status}'.`);
    err.code = 'INVALID_STATUS_CHANGE';
    err.statusCode = 409;
    throw err;
  }

  // 2-hour window check for patients
  if (user.role === 'Patient') {
    const hoursRemaining = (new Date(apt.startTime).getTime() - Date.now()) / (1000 * 3600);
    if (hoursRemaining < MIN_HOURS_BEFORE_CANCEL) {
      const err = new Error(`Patients can only cancel up to ${MIN_HOURS_BEFORE_CANCEL} hours prior to appointment time.`);
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
  }

  // Receptionist cancellation requires a reason
  const isStaff = user.role === 'Receptionist' || user.role === 'Admin';
  if (isStaff && (!reason || reason.trim().length < 3)) {
    const err = new Error('A valid reason is required for staff cancellations (minimum 3 characters).');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  const cancelReason = reason ? reason.trim().substring(0, 200) : 'Cancelled by patient';

  if (process.env.DATABASE_URL) {
    const res = await query(
      `UPDATE appointments
       SET status = 'Cancelled', cancel_reason = $1
       WHERE id = $2
       RETURNING id, status, cancel_reason as "cancelReason"`,
      [cancelReason, appointmentId]
    );
    await recordAuditEvent(user.id, 'APPOINTMENT_CANCELLED', appointmentId, `Cancelled: ${cancelReason}`);
    return res[0];
  }

  apt.status = 'Cancelled';
  apt.cancelReason = cancelReason;

  await recordAuditEvent(user.id, 'APPOINTMENT_CANCELLED', appointmentId, `Cancelled: ${cancelReason}`);
  return apt;
}

module.exports = {
  listAppointments,
  getAppointmentById,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment
};
