// Shared auth middleware (Student 1 leads; keep theirs if it sets req.user = { id, role }).
const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/validation');

// Reads "Authorization: Bearer <token>", checks signature + expiry, sets req.user
function authenticate(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set'); // fail closed -> 500, nobody gets in

  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Please log in.');
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
        req.user = { id: payload.sub || payload.id, role: payload.role };   // S1's login uses "id"
    next();
  } catch {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Your session has expired or is invalid. Please log in again.');
  }
}

// authorize('Receptionist', 'Admin') -> 403 for any other role
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to do this.');
    }
    next();
  };
}

module.exports = { authenticate, authorize };
