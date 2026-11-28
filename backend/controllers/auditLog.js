// GET /api/audit-log?limit=50   (Admin only)
const auditService = require('../services/auditLogService');
const { sendError } = require('../utils/validation');

async function getAuditLog(req, res) {
  const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'limit must be a whole number from 1 to 500.');
  }
  res.status(200).json(await auditService.list(limit));
}

module.exports = { getAuditLog };
