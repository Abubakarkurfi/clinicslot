// SQL for the reception desk: day overview, one doctor's day, status changes.
// "Which day" is always worked out by Postgres in Cairo time, not by the server clock.
const sql = require('../db/sql');

// One row per active doctor with the count of each status on that date
async function getDayOverview(date) {
  return sql`
    SELECT d.id AS "doctorId", d.full_name AS "doctorName", s.name AS specialty, d.room,
      COUNT(a.id)::int                                          AS total,
      COUNT(a.id) FILTER (WHERE a.status = 'Booked')::int       AS booked,
      COUNT(a.id) FILTER (WHERE a.status = 'CheckedIn')::int    AS "checkedIn",
      COUNT(a.id) FILTER (WHERE a.status = 'Completed')::int    AS completed,
      COUNT(a.id) FILTER (WHERE a.status = 'NoShow')::int       AS "noShow",
      COUNT(a.id) FILTER (WHERE a.status = 'Cancelled')::int    AS cancelled
    FROM doctors d
    JOIN specialties s ON s.id = d.specialty_id
    LEFT JOIN appointments a
      ON a.doctor_id = d.id
     AND (a.start_time AT TIME ZONE 'Africa/Cairo')::date = ${date}::date
    WHERE d.is_active
    GROUP BY d.id, d.full_name, s.name, d.room
    ORDER BY d.full_name`;
}

async function findDoctor(doctorId) {
  const rows = await sql`
    SELECT id, full_name AS "fullName" FROM doctors WHERE id = ${doctorId}`;
  return rows[0] || null;
}

// One doctor's appointments for a date, with the patient's name and phone
async function getDoctorSchedule(doctorId, date) {
  return sql`
    SELECT a.id, a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.reason,
           a.cancel_reason AS "cancelReason", a.checked_in_at AS "checkedInAt",
           u.id AS "patientId", u.full_name AS "patientName", u.phone AS "patientPhone"
    FROM appointments a
    JOIN users u ON u.id = a.patient_id
    WHERE a.doctor_id = ${doctorId}
      AND (a.start_time AT TIME ZONE 'Africa/Cairo')::date = ${date}::date
    ORDER BY a.start_time`;
}

// The facts statusRules needs, all computed by Postgres
async function getAppointmentForStatus(id) {
  const rows = await sql`
    SELECT id, patient_id AS "patientId", status,
      (start_time AT TIME ZONE 'Africa/Cairo')::date
        = (now() AT TIME ZONE 'Africa/Cairo')::date              AS "isToday",
      EXTRACT(EPOCH FROM (start_time - now())) / 60              AS "minutesUntilStart"
    FROM appointments WHERE id = ${id}`;
  if (!rows[0]) return null;
  return { ...rows[0], minutesUntilStart: Number(rows[0].minutesUntilStart) };
}

// Change the status AND write the audit row in ONE statement.
// "AND status = oldStatus" means: if someone else changed it a moment ago, nothing is updated
// (the controller then answers 409 instead of overwriting their change).
async function updateStatus({ id, oldStatus, newStatus, actorId, cancelReason }) {
  const rows = await sql`
    WITH changed AS (
      UPDATE appointments SET
        status        = ${newStatus}::text,
        checked_in_at = CASE WHEN ${newStatus}::text = 'CheckedIn' THEN now() ELSE checked_in_at END,
        cancel_reason = CASE WHEN ${newStatus}::text = 'Cancelled' THEN ${cancelReason}::text ELSE cancel_reason END
      WHERE id = ${id}::uuid AND status = ${oldStatus}::text
      RETURNING id, patient_id, doctor_id, start_time, end_time, status, reason,
                cancel_reason, checked_in_at
    ), logged AS (
      INSERT INTO audit_log (actor_id, action, target_id, details)
      SELECT ${actorId}::uuid, 'APPOINTMENT_' || upper(${newStatus}::text), id,
             ${oldStatus}::text || ' -> ' || ${newStatus}::text
      FROM changed
    )
    SELECT id, patient_id AS "patientId", doctor_id AS "doctorId", start_time AS "startTime",
           end_time AS "endTime", status, reason, cancel_reason AS "cancelReason",
           checked_in_at AS "checkedInAt"
    FROM changed`;
  return rows[0] || null;
}

module.exports = { getDayOverview, findDoctor, getDoctorSchedule, getAppointmentForStatus, updateStatus };
