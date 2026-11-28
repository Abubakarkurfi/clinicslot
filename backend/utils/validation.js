// Small helpers shared by the S3 controllers.

// Every error uses the Lab 3 shape: { "error": { "code": "...", "message": "..." } }
function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// "2026-11-16" and a real calendar day (rejects 2026-02-30)
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Today's date in Cairo as YYYY-MM-DD (the Vercel server runs in UTC)
function cairoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}

// Trimmed string or '' (never undefined), so length checks are simple
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = { sendError, isUuid, isDate, cairoToday, clean };
