/**
 * External Holiday Service (S2 Doctor & Schedule Lead: Omar Osama)
 * Integrates with Nager.Date API (GET https://date.nager.at/api/v3/PublicHolidays/{year}/EG)
 * Validates external payload and imports official Egyptian public holidays into time_off.
 */

const { query, memoryStore } = require('../db');
const { recordAuditEvent } = require('./auditService');
const crypto = require('crypto');

async function importEgyptianHolidays(actorId, year) {
  const targetYear = parseInt(year, 10);
  if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2035) {
    const err = new Error('Invalid year parameter. Must be between 2020 and 2035.');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  const url = `https://date.nager.at/api/v3/PublicHolidays/${targetYear}/EG`;
  console.log(`[EXTERNAL API] Fetching Egyptian holidays from Nager.Date: ${url}`);

  let holidayData = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6 second timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Nager.Date responded with status ${response.status}`);
    }

    holidayData = await response.json();
  } catch (err) {
    console.error('[EXTERNAL API ERROR] Nager.Date communication failed:', err.message);
    const apiError = new Error('External public holidays service (Nager.Date) is unavailable or timed out.');
    apiError.code = 'EXTERNAL_API_ERROR';
    apiError.statusCode = 502;
    throw apiError;
  }

  if (!Array.isArray(holidayData)) {
    const apiError = new Error('Invalid response structure returned by external holiday API.');
    apiError.code = 'EXTERNAL_API_ERROR';
    apiError.statusCode = 502;
    throw apiError;
  }

  const importedHolidays = [];

  for (const h of holidayData) {
    // Validate each external item before saving (Threat 11 mitigation)
    if (!h.date || !h.localName && !h.name) continue;

    const holidayDate = h.date; // YYYY-MM-DD
    const holidayName = (h.localName || h.name || 'Public Holiday').substring(0, 190);

    if (process.env.DATABASE_URL) {
      // Check existing to prevent duplicates
      const existing = await query(
        "SELECT id FROM time_off WHERE doctor_id IS NULL AND start_date = $1 AND source = 'HolidayAPI'",
        [holidayDate]
      );

      if (!existing || existing.length === 0) {
        const res = await query(
          `INSERT INTO time_off (doctor_id, start_date, end_date, reason, source)
           VALUES (NULL, $1, $1, $2, 'HolidayAPI')
           RETURNING id, start_date as "startDate", end_date as "endDate", reason, source`,
          [holidayDate, holidayName]
        );
        importedHolidays.push(res[0]);
      }
    } else {
      const exists = memoryStore.timeOff.some(t => !t.doctorId && t.startDate === holidayDate && t.source === 'HolidayAPI');
      if (!exists) {
        const item = {
          id: crypto.randomUUID(),
          doctorId: null,
          startDate: holidayDate,
          endDate: holidayDate,
          reason: holidayName,
          source: 'HolidayAPI',
          createdAt: new Date().toISOString()
        };
        memoryStore.timeOff.push(item);
        importedHolidays.push(item);
      }
    }
  }

  await recordAuditEvent(
    actorId,
    'HOLIDAYS_IMPORTED',
    null,
    `Imported ${importedHolidays.length} official Egyptian public holidays for year ${targetYear}`
  );

  return {
    year: targetYear,
    count: importedHolidays.length,
    holidays: importedHolidays
  };
}

module.exports = {
  importEgyptianHolidays
};
