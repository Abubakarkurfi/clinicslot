/**
 * Audit Logging Service (S3 Reception Desk / Security Lead: Abdulahi Jama)
 * Append-only security tracking in database table 'audit_log'.
 */

const { query, memoryStore } = require('../db');
const crypto = require('crypto');
const { sendToCloudWatchLogs } = require('./awsClient');

async function recordAuditEvent(actorId, action, targetId = null, details = null) {
  try {
    const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;
    
    // CloudWatch Logs Integration (Student 3: Abdulahi)
    sendToCloudWatchLogs('/aws/clinicslot/security-audit', 'audit-stream', {
      timestamp: new Date().toISOString(),
      actorId,
      action,
      targetId,
      details: detailsString
    }).catch(() => {});

    // Attempt database insert if available
    if (process.env.DATABASE_URL) {
      await query(
        'INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, $2, $3, $4)',
        [actorId, action, targetId, detailsString]
      );
    } else {
      memoryStore.auditLog.unshift({
        id: crypto.randomUUID(),
        actorId,
        action,
        targetId,
        details: detailsString,
        createdAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[AUDIT LOG ERROR] Failed to record audit event:', err.message);
  }
}

async function getAuditLogs(limit = 100) {
  if (process.env.DATABASE_URL) {
    const rows = await query(
      `SELECT a.id, a.action, a.target_id as "targetId", a.details, a.created_at as "createdAt",
              u.full_name as "actorName", u.email as "actorEmail", u.role as "actorRole"
       FROM audit_log a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  return memoryStore.auditLog.slice(0, limit).map(log => {
    const actor = memoryStore.users.find(u => u.id === log.actorId);
    return {
      ...log,
      actorName: actor ? actor.fullName : 'System',
      actorEmail: actor ? actor.email : 'system@clinicslot.com',
      actorRole: actor ? actor.role : 'System'
    };
  });
}

module.exports = {
  recordAuditEvent,
  getAuditLogs
};
