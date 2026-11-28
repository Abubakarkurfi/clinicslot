/**
 * Authentication and Authorization Middleware
 * Enforces JWT verification, token expiration, and role-based access control (RBAC).
 */

const jwt = require('jsonwebtoken');

// Fail closed: no secret = the server refuses to start (no guessable fallback key).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');
/**
 * Enforces authenticated session.
 * Rejects missing, malformed, or expired tokens with 401 UNAUTHENTICATED.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Missing or malformed Bearer token.'
      }
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, fullName, ... }
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: err.name === 'TokenExpiredError' 
          ? 'Session expired. Please log in again.' 
          : 'Invalid or forged authentication token.'
      }
    });
  }
}

/**
 * Optional authentication: attaches user if valid token present, otherwise proceeds as anonymous.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Role-Based Access Control (RBAC)
 * Allows access ONLY if authenticated user has one of the specified roles.
 * Deny by default.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before checking permissions.'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: role '${req.user.role}' lacks permission for this endpoint.`
        }
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  JWT_SECRET
};
