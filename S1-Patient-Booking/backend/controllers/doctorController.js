/**
 * Doctor Controller (S2 Doctor & Schedule Lead: Omar Osama)
 * Trust boundary validation for doctor catalogue, specialties, hours, and slots.
 */

const doctorService = require('../services/doctorService');
const slotService = require('../services/slotService');

// Specialties
async function listSpecialties(req, res, next) {
  try {
    const list = await doctorService.getSpecialties();
    res.json(list);
  } catch (err) {
    next(err);
  }
}

async function createSpecialty(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { name, description } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Specialty name is required (2 to 60 characters).' }
      });
    }

    const created = await doctorService.createSpecialty(req.user.id, { name, description });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// Doctors
async function listDoctors(req, res, next) {
  try {
    const { specialty, name } = req.query;
    const doctors = await doctorService.getDoctors({ specialty, name, includeInactive: false });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

async function getDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const doctor = await doctorService.getDoctorById(id);
    if (!doctor) {
      return res.status(404).json({
        error: { code: 'DOCTOR_NOT_FOUND', message: 'Requested doctor does not exist.' }
      });
    }
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function createDoctor(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { fullName, specialtyId, room, slotMinutes } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Doctor full name is required (2 to 100 characters).' }
      });
    }

    if (!specialtyId || typeof specialtyId !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid specialty ID is required.' }
      });
    }

    if (!room || typeof room !== 'string' || room.trim().length > 20) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Room identifier is required (up to 20 characters).' }
      });
    }

    const allowedMinutes = [15, 20, 30];
    if (!slotMinutes || !allowedMinutes.includes(Number(slotMinutes))) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'slotMinutes must be either 15, 20, or 30.' }
      });
    }

    const doctor = await doctorService.createDoctor(req.user.id, {
      fullName,
      specialtyId,
      room,
      slotMinutes: Number(slotMinutes)
    });

    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

async function updateDoctor(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { id } = req.params;
    const { fullName, room, slotMinutes, isActive } = req.body || {};

    const fields = {};
    if (fullName !== undefined) fields.fullName = fullName;
    if (room !== undefined) fields.room = room;
    if (slotMinutes !== undefined) {
      if (![15, 20, 30].includes(Number(slotMinutes))) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'slotMinutes must be either 15, 20, or 30.' }
        });
      }
      fields.slotMinutes = Number(slotMinutes);
    }
    if (isActive !== undefined) fields.isActive = Boolean(isActive);

    const updated = await doctorService.updateDoctor(req.user.id, id, fields);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Slots
async function getDoctorSlots(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter date is required in YYYY-MM-DD format.' }
      });
    }

    const freeSlots = await slotService.getFreeSlots(id, date);
    res.json(freeSlots);
  } catch (err) {
    next(err);
  }
}

// Working Hours
async function getHours(req, res, next) {
  try {
    const { id } = req.params;
    const hours = await doctorService.getDoctorHours(id);
    res.json(hours);
  } catch (err) {
    next(err);
  }
}

async function setHours(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { id } = req.params;
    const { hours } = req.body || {};

    if (!Array.isArray(hours)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Working hours must be provided as an array.' }
      });
    }

    // Validate each day entry
    for (const h of hours) {
      if (h.dayOfWeek < 0 || h.dayOfWeek > 6 || !h.startTime || !h.endTime || h.endTime <= h.startTime) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid working hours range: endTime must be greater than startTime, dayOfWeek must be 0-6.' }
        });
      }
    }

    const updated = await doctorService.setDoctorHours(req.user.id, id, hours);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Time Off
async function addTimeOff(req, res, next) {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' }
      });
    }

    const { id } = req.params; // doctor ID or null/undefined
    const { startDate, endDate, reason } = req.body || {};

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'startDate, endDate, and reason are required.' }
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'endDate cannot be before startDate.' }
      });
    }

    const record = await doctorService.addTimeOff(req.user.id, {
      doctorId: id === 'clinic' ? null : id,
      startDate,
      endDate,
      reason
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSpecialties,
  createSpecialty,
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  getDoctorSlots,
  getHours,
  setHours,
  addTimeOff
};
