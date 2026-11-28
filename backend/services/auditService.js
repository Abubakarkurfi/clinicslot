// The audit_log table. Teammates call record() too, e.g. after a login or a booking:
//   await auditService.record({ actorId: req.user.id, action: 'LOGIN_SUCCESS', targetId: user.id });
const sql = require('../db/sql');

async function record({ actorId = null, action, targetId = null, details = null }) {
  await sql`
    INSERT INTO audit_log (actor_id, action, target_id, details)
    VALUES (${actorId}, ${action}, ${targetId}, ${details})`;
}

async function list(limit = 100) {
  return sql`
    SELECT l.id, l.action, l.target_id AS "targetId", l.details, l.created_at AS "createdAt",
           l.actor_id AS "actorId", u.full_name AS "actorName", u.role AS "actorRole"
    FROM audit_log l
    LEFT JOIN users u ON u.id = l.actor_id
    ORDER BY l.created_at DESC
    LIMIT ${limit}`;
}

module.exports = { record, list };
