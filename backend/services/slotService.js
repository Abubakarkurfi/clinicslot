/**
 * Slot Generation Service (S2 Doctor & Schedule Lead: Omar Osama)
 * Calculates available consultation intervals based on:
 * - Weekly working hours
 * - Slot duration (15, 20, or 30 mins)
 * - Clinic-wide & doctor-specific time off and imported public holidays
 * - Existing active appointments (status <> 'Cancelled')
 */

const { query, memoryStore } = require('../db');
const { getDoctorById, getDoctorHours } = require('./doctorService');

/**
 * Generate free slots for a doctor on a specific date (YYYY-MM-DD)
 */
async function getFreeSlots(doctorId, dateStr) {
  const doctor = await getDoctorById(doctorId);
  if (!doctor || !doctor.isActive) {
    const err = new Error('Doctor not found or currently inactive.');
    err.code = 'DOCTOR_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // Parse target date and day of week
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    const err = new Error('Invalid date format. Expected YYYY-MM-DD.');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(targetDate.getTime())) {
    const err = new Error('Invalid calendar date.');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  // Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = targetDate.getUTCDay();

  // 1. Check if date is blocked by clinic-wide or doctor time-off / public holiday
  let isBlocked = false;
  let blockReason = '';

  if (process.env.DATABASE_URL) {
    const timeOffRows = await query(
      `SELECT reason FROM time_off 
       WHERE (doctor_id = $1 OR doctor_id IS NULL)
         AND $2::date BETWEEN start_date AND end_date`,
      [doctorId, dateStr]
    );
    if (timeOffRows && timeOffRows.length > 0) {
      isBlocked = true;
      blockReason = timeOffRows[0].reason;
    }
  } else {
    const block = memoryStore.timeOff.find(t => 
      (!t.doctorId || t.doctorId === doctorId) &&
      dateStr >= t.startDate && dateStr <= t.endDate
    );
    if (block) {
      isBlocked = true;
      blockReason = block.reason;
    }
  }

  if (isBlocked) {
    return {
      doctorId,
      doctorName: doctor.fullName,
      specialtyName: doctor.specialtyName,
      date: dateStr,
      closed: true,
      closureReason: blockReason,
      slots: []
    };
  }

  // 2. Fetch doctor's working hours for this day of week
  const allHours = await getDoctorHours(doctorId);
  const dayHours = allHours.find(h => Number(h.dayOfWeek) === dayOfWeek);

  if (!dayHours) {
    return {
      doctorId,
      doctorName: doctor.fullName,
      specialtyName: doctor.specialtyName,
      date: dateStr,
      closed: true,
      closureReason: 'Doctor does not hold clinic hours on this day of the week.',
      slots: []
    };
  }

  // 3. Fetch all active appointments for this doctor on this day
  const startOfDay = `${dateStr}T00:00:00Z`;
  const endOfDay = `${dateStr}T23:59:59Z`;
  let bookedAppointments = [];

  if (process.env.DATABASE_URL) {
    bookedAppointments = await query(
      `SELECT start_time as "startTime", end_time as "endTime"
       FROM appointments
       WHERE doctor_id = $1
         AND start_time >= $2::timestamptz
         AND start_time <= $3::timestamptz
         AND status <> 'Cancelled'`,
      [doctorId, startOfDay, endOfDay]
    );
  } else {
    bookedAppointments = memoryStore.appointments.filter(a =>
      a.doctorId === doctorId &&
      a.status !== 'Cancelled' &&
      a.startTime >= startOfDay &&
      a.startTime <= endOfDay
    );
  }

  const bookedStartTimes = new Set(
    bookedAppointments.map(a => new Date(a.startTime).toISOString())
  );

  // 4. Generate slot intervals from startTime to endTime
  const slotMinutes = doctor.slotMinutes || 30;
  const [startH, startM] = dayHours.startTime.split(':').map(Number);
  const [endH, endM] = dayHours.endTime.split(':').map(Number);

  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;

  const generatedSlots = [];
  const now = new Date();

  for (let m = startTotalMinutes; m + slotMinutes <= endTotalMinutes; m += slotMinutes) {
    const slotHour = Math.floor(m / 60);
    const slotMin = m % 60;
    const endSlotHour = Math.floor((m + slotMinutes) / 60);
    const endSlotMin = (m + slotMinutes) % 60;

    const pad = n => String(n).padStart(2, '0');
    const timeDisplay = `${pad(slotHour)}:${pad(slotMin)}`;
    const endTimeDisplay = `${pad(endSlotHour)}:${pad(endSlotMin)}`;

    const slotIsoString = new Date(`${dateStr}T${timeDisplay}:00Z`).toISOString();
    const endSlotIsoString = new Date(`${dateStr}T${endTimeDisplay}:00Z`).toISOString();

    const isTaken = bookedStartTimes.has(slotIsoString);
    const isPast = new Date(slotIsoString) <= now;

    if (!isTaken && !isPast) {
      generatedSlots.push({
        startTime: slotIsoString,
        endTime: endSlotIsoString,
        timeDisplay,
        endTimeDisplay,
        slotMinutes
      });
    }
  }

  return {
    doctorId,
    doctorName: doctor.fullName,
    specialtyName: doctor.specialtyName,
    date: dateStr,
    closed: false,
    slotMinutes,
    slots: generatedSlots
  };
}

module.exports = {
  getFreeSlots
};
