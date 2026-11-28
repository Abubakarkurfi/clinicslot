/**
 * Authentication Service (Shared Auth Lead: Abubakar Mansur kurfi)
 * Implements bcrypt hashing, JWT issuance, rate limiting on failed attempts,
 * and privilege escalation prevention.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, memoryStore } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { recordAuditEvent } = require('./auditService');

const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

/**
 * Register a new patient.
 * Server strictly sets role to 'Patient' regardless of request payload.
 */
async function registerPatient({ fullName, email, phone, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (process.env.DATABASE_URL) {
    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing && existing.length > 0) {
      const err = new Error('An account with this email address already exists.');
      err.code = 'EMAIL_IN_USE';
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'Patient')
       RETURNING id, full_name as "fullName", email, phone, role, created_at as "createdAt"`,
      [fullName.trim(), normalizedEmail, phone.trim(), passwordHash]
    );

    const user = result[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await recordAuditEvent(user.id, 'USER_REGISTERED', user.id, `Patient registered: ${user.email}`);

    return { token, user };
  } else {
    // Fallback store
    const existing = memoryStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      const err = new Error('An account with this email address already exists.');
      err.code = 'EMAIL_IN_USE';
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      role: 'Patient', // Forced
      failedLoginCount: 0,
      lastFailedLogin: null,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    memoryStore.users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, fullName: newUser.fullName },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await recordAuditEvent(newUser.id, 'USER_REGISTERED', newUser.id, `Patient registered: ${newUser.email}`);

    const { passwordHash: _, ...userSafe } = newUser;
    return { token, user: userSafe };
  }
}

/**
 * Log in a user with brute-force / credential-stuffing prevention.
 */
async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  let user = null;

  if (process.env.DATABASE_URL) {
    const rows = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (rows && rows.length > 0) {
      user = rows[0];
    }
  } else {
    user = memoryStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
  }

  // Account lockout check (Threat 1 mitigation)
  if (user && user.failed_login_count >= FAILED_LOGIN_LIMIT) {
    const lastAttempt = new Date(user.last_failed_login || user.lastFailedLogin);
    const minutesSince = (Date.now() - lastAttempt.getTime()) / (1000 * 60);

    if (minutesSince < LOCKOUT_WINDOW_MINUTES) {
      const remainingMinutes = Math.ceil(LOCKOUT_WINDOW_MINUTES - minutesSince);
      const err = new Error(`Too many failed login attempts. Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
      err.code = 'TOO_MANY_ATTEMPTS';
      err.statusCode = 429;
      throw err;
    }
  }

  // Uniform error message for wrong email or wrong password to prevent user enumeration
  const invalidCredentialsError = () => {
    const err = new Error('Invalid email or password.');
    err.code = 'INVALID_CREDENTIALS';
    err.statusCode = 401;
    return err;
  };

  if (!user || !user.is_active && user.isActive === false) {
    await recordAuditEvent(null, 'LOGIN_FAILED', null, `Failed login for email: ${normalizedEmail}`);
    throw invalidCredentialsError();
  }

  const hash = user.password_hash || user.passwordHash;
  const isMatch = await bcrypt.compare(password, hash);

  if (!isMatch) {
    const newCount = (user.failed_login_count || user.failedLoginCount || 0) + 1;
    const nowIso = new Date().toISOString();

    if (process.env.DATABASE_URL) {
      await query(
        'UPDATE users SET failed_login_count = $1, last_failed_login = $2 WHERE id = $3',
        [newCount, nowIso, user.id]
      );
    } else {
      user.failedLoginCount = newCount;
      user.lastFailedLogin = nowIso;
    }

    await recordAuditEvent(user.id, 'LOGIN_FAILED', user.id, `Failed password attempt ${newCount}`);
    throw invalidCredentialsError();
  }

  // Success: reset failed attempts
  if (process.env.DATABASE_URL) {
    await query('UPDATE users SET failed_login_count = 0, last_failed_login = NULL WHERE id = $1', [user.id]);
  } else {
    user.failedLoginCount = 0;
    user.lastFailedLogin = null;
  }

  const userSafe = {
    id: user.id,
    fullName: user.full_name || user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.created_at || user.createdAt
  };

  const token = jwt.sign(
    { id: userSafe.id, email: userSafe.email, role: userSafe.role, fullName: userSafe.fullName },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  await recordAuditEvent(user.id, 'LOGIN_SUCCESS', user.id, `Successful login by ${userSafe.role}`);

  return { token, user: userSafe };
}

module.exports = {
  registerPatient,
  loginUser
};
