/**
 * Holiday Controller (S2 Doctor & Schedule Lead: Omar Osama)
 * Handles triggering public holiday sync from Nager.Date API.
 */

const holidayService = require('../services/holidayService');

async function importHolidays(req, res, next) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const result = await holidayService.importEgyptianHolidays(req.user.id, year);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  importHolidays
};
