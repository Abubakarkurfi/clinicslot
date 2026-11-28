// SQL for patients: search and walk-in registration.
const sql = require('../db/sql');

// Search by part of the name or phone. % and _ are escaped, so "%%" does not match everyone.
async function search(term) {
  const pattern = '%' + term.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%';
  return sql`
    SELECT id, full_name AS "fullName", phone, email, created_at AS "createdAt"
    FROM users
    WHERE role = 'Patient' AND is_active
      AND (full_name ILIKE ${pattern} OR phone ILIKE ${pattern})
    ORDER BY full_name
    LIMIT 20`;
}

async function findByPhone(phone) {
  const rows = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  return rows[0] || null;
}

// New walk-in patient + audit row in ONE statement. password_hash stays NULL (cannot log in).
async function createWalkIn({ fullName, phone, email, actorId }) {
  const rows = await sql`
    WITH created AS (
      INSERT INTO users (full_name, phone, email, role)
      VALUES (${fullName}, ${phone}, ${email}, 'Patient')
      RETURNING id, full_name, phone, email, role, created_at
    ), logged AS (
      INSERT INTO audit_log (actor_id, action, target_id)
      SELECT ${actorId}::uuid, 'WALKIN_REGISTERED', id FROM created
    )
    SELECT id, full_name AS "fullName", phone, email, role, created_at AS "createdAt"
    FROM created`;
  return rows[0];
}

module.exports = { search, findByPhone, createWalkIn };
