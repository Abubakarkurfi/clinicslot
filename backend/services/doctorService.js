/**
 * Doctor & Schedule Service (S2 Doctor & Schedule Lead: Omar Osama)
 * Handles specialties, doctors, weekly working hours, and time-off blocks.
 */

const crypto = require('crypto');
const { query, memoryStore } = require('../db');
const { recordAuditEvent } = require('./auditService');

// 1. Specialties
async function getSpecialties() {
  if (process.env.DATABASE_URL) {
    return await query('SELECT id, name, description, created_at as "createdAt" FROM specialties ORDER BY name ASC');
  }
  return memoryStore.specialties;
}

async function createSpecialty(actorId, { name, description }) {
  const trimmedName = name.trim();
  if (process.env.DATABASE_URL) {
    const res = await query(
      'INSERT INTO specialties (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at as "createdAt"',
      [trimmedName, description ? description.trim() : null]
    );
    await recordAuditEvent(actorId, 'SPECIALTY_CREATED', res[0].id, `Created specialty ${trimmedName}`);
    return res[0];
  } else {
    const existing = memoryStore.specialties.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      const err = new Error('Specialty already exists.');
      err.code = 'DUPLICATE_SPECIALTY';
      err.statusCode = 409;
      throw err;
    }
    const newSpec = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description ? description.trim() : '',
      createdAt: new Date().toISOString()
    };
    memoryStore.specialties.push(newSpec);
    await recordAuditEvent(actorId, 'SPECIALTY_CREATED', newSpec.id, `Created specialty ${trimmedName}`);
    return newSpec;
  }
}

// 2. Doctors
async function getDoctors({ specialty, name, includeInactive = false }) {
  if (process.env.DATABASE_URL) {
    let sqlQuery = `
      SELECT d.id, d.full_name as "fullName", d.specialty_id as "specialtyId", 
             s.name as "specialtyName", d.room, d.slot_minutes as "slotMinutes", 
             d.is_active as "isActive", d.created_at as "createdAt"
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (!includeInactive) {
      sqlQuery += ` AND d.is_active = true`;
    }

    if (specialty) {
      params.push(`%${specialty.trim()}%`);
      sqlQuery += ` AND s.name ILIKE $${params.length}`;
    }

    if (name) {
      params.push(`%${name.trim()}%`);
      sqlQuery += ` AND d.full_name ILIKE $${params.length}`;
    }

    sqlQuery += ` ORDER BY d.full_name ASC`;
    return await query(sqlQuery, params);
  }

  // Fallback memory store
  let docs = memoryStore.doctors;
  if (!includeInactive) {
    docs = docs.filter(d => d.isActive);
  }

  return docs.map(d => {
    const spec = memoryStore.specialties.find(s => s.id === d.specialtyId);
    return {
      ...d,
      specialtyName: spec ? spec.name : 'Unknown'
    };
  }).filter(d => {
    let match = true;
    if (specialty) {
      match = match && d.specialtyName.toLowerCase().includes(specialty.toLowerCase());
    }
    if (name) {
      match = match && d.fullName.toLowerCase().includes(name.toLowerCase());
    }
    return match;
  });
}

async function getDoctorById(id) {
  if (process.env.DATABASE_URL) {
    const rows = await query(
      `SELECT d.id, d.full_name as "fullName", d.specialty_id as "specialtyId", 
              s.name as "specialtyName", d.room, d.slot_minutes as "slotMinutes", 
              d.is_active as "isActive", d.created_at as "createdAt"
       FROM doctors d
       JOIN specialties s ON d.specialty_id = s.id
       WHERE d.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  const doc = memoryStore.doctors.find(d => d.id === id);
  if (!doc) return null;
  const spec = memoryStore.specialties.find(s => s.id === doc.specialtyId);
  return {
    ...doc,
    specialtyName: spec ? spec.name : 'Unknown'
  };
}

async function createDoctor(actorId, { fullName, specialtyId, room, slotMinutes }) {
  if (process.env.DATABASE_URL) {
    const res = await query(
      `INSERT INTO doctors (full_name, specialty_id, room, slot_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name as "fullName", specialty_id as "specialtyId", room, slot_minutes as "slotMinutes", is_active as "isActive", created_at as "createdAt"`,
      [fullName.trim(), specialtyId, room.trim(), slotMinutes]
    );
    await recordAuditEvent(actorId, 'DOCTOR_CREATED', res[0].id, `Added doctor ${fullName}`);
    return res[0];
  }

  const newDoc = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    specialtyId,
    room: room.trim(),
    slotMinutes: Number(slotMinutes),
    isActive: true,
    createdAt: new Date().toISOString()
  };
  memoryStore.doctors.push(newDoc);
  await recordAuditEvent(actorId, 'DOCTOR_CREATED', newDoc.id, `Added doctor ${fullName}`);
  return newDoc;
}

async function updateDoctor(actorId, id, fields) {
  const doc = await getDoctorById(id);
  if (!doc) {
    const err = new Error('Doctor not found.');
    err.code = 'DOCTOR_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const updates = [];
  const params = [id];

  if (fields.fullName !== undefined) {
    params.push(fields.fullName.trim());
    updates.push(`full_name = $${params.length}`);
  }
  if (fields.room !== undefined) {
    params.push(fields.room.trim());
    updates.push(`room = $${params.length}`);
  }
  if (fields.slotMinutes !== undefined) {
    params.push(Number(fields.slotMinutes));
    updates.push(`slot_minutes = $${params.length}`);
  }
  if (fields.isActive !== undefined) {
    params.push(Boolean(fields.isActive));
    updates.push(`is_active = $${params.length}`);
  }

  if (process.env.DATABASE_URL) {
    if (updates.length > 0) {
      const res = await query(
        `UPDATE doctors SET ${updates.join(', ')} WHERE id = $1 RETURNING id, full_name as "fullName", specialty_id as "specialtyId", room, slot_minutes as "slotMinutes", is_active as "isActive"`,
        params
      );
      await recordAuditEvent(actorId, 'DOCTOR_UPDATED', id, `Updated doctor details: ${JSON.stringify(fields)}`);
      return res[0];
    }
    return doc;
  }

  // Memory store fallback
  const memDoc = memoryStore.doctors.find(d => d.id === id);
  if (fields.fullName !== undefined) memDoc.fullName = fields.fullName.trim();
  if (fields.room !== undefined) memDoc.room = fields.room.trim();
  if (fields.slotMinutes !== undefined) memDoc.slotMinutes = Number(fields.slotMinutes);
  if (fields.isActive !== undefined) memDoc.isActive = Boolean(fields.isActive);

  await recordAuditEvent(actorId, 'DOCTOR_UPDATED', id, `Updated doctor details: ${JSON.stringify(fields)}`);
  return memDoc;
}

// 3. Weekly Hours
async function getDoctorHours(doctorId) {
  if (process.env.DATABASE_URL) {
    return await query(
      `SELECT id, doctor_id as "doctorId", day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime"
       FROM doctor_hours WHERE doctor_id = $1 ORDER BY day_of_week ASC, start_time ASC`,
      [doctorId]
    );
  }
  return memoryStore.doctorHours.filter(h => h.doctorId === doctorId);
}

async function setDoctorHours(actorId, doctorId, hoursList) {
  // Validate doctor exists
  const doc = await getDoctorById(doctorId);
  if (!doc) {
    const err = new Error('Doctor not found.');
    err.code = 'DOCTOR_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  if (process.env.DATABASE_URL) {
    await query('DELETE FROM doctor_hours WHERE doctor_id = $1', [doctorId]);
    for (const item of hoursList) {
      await query(
        'INSERT INTO doctor_hours (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [doctorId, item.dayOfWeek, item.startTime, item.endTime]
      );
    }
  } else {
    memoryStore.doctorHours = memoryStore.doctorHours.filter(h => h.doctorId !== doctorId);
    for (const item of hoursList) {
      memoryStore.doctorHours.push({
        id: crypto.randomUUID(),
        doctorId,
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime
      });
    }
  }

  await recordAuditEvent(actorId, 'DOCTOR_HOURS_SET', doctorId, `Set working hours for doctor`);
  return await getDoctorHours(doctorId);
}

// 4. Time Off
async function addTimeOff(actorId, { doctorId = null, startDate, endDate, reason }) {
  if (doctorId) {
    const doc = await getDoctorById(doctorId);
    if (!doc) {
      const err = new Error('Doctor not found.');
      err.code = 'DOCTOR_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
  }

  if (process.env.DATABASE_URL) {
    const res = await query(
      `INSERT INTO time_off (doctor_id, start_date, end_date, reason, source)
       VALUES ($1, $2, $3, $4, 'Manual')
       RETURNING id, doctor_id as "doctorId", start_date as "startDate", end_date as "endDate", reason, source, created_at as "createdAt"`,
      [doctorId, startDate, endDate, reason.trim()]
    );
    await recordAuditEvent(actorId, 'TIME_OFF_ADDED', res[0].id, `Added time off from ${startDate} to ${endDate}`);
    return res[0];
  }

  const record = {
    id: crypto.randomUUID(),
    doctorId,
    startDate,
    endDate,
    reason: reason.trim(),
    source: 'Manual',
    createdAt: new Date().toISOString()
  };
  memoryStore.timeOff.push(record);
  await recordAuditEvent(actorId, 'TIME_OFF_ADDED', record.id, `Added time off from ${startDate} to ${endDate}`);
  return record;
}

async function getTimeOff({ doctorId, year }) {
  if (process.env.DATABASE_URL) {
    let sqlStr = `SELECT id, doctor_id as "doctorId", start_date as "startDate", end_date as "endDate", reason, source FROM time_off WHERE 1=1`;
    const params = [];
    if (doctorId) {
      params.push(doctorId);
      sqlStr += ` AND (doctor_id = $${params.length} OR doctor_id IS NULL)`;
    }
    if (year) {
      params.push(`${year}-01-01`);
      params.push(`${year}-12-31`);
      sqlStr += ` AND start_date BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    sqlStr += ` ORDER BY start_date ASC`;
    return await query(sqlStr, params);
  }

  return memoryStore.timeOff.filter(t => {
    let match = true;
    if (doctorId) {
      match = match && (!t.doctorId || t.doctorId === doctorId);
    }
    if (year) {
      match = match && t.startDate.startsWith(String(year));
    }
    return match;
  });
}

module.exports = {
  getSpecialties,
  createSpecialty,
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  getDoctorHours,
  setDoctorHours,
  addTimeOff,
  getTimeOff
};
