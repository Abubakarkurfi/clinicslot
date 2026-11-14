// DEV ONLY: prints a 1-hour test token for a seeded user, until Student 1's login exists.
// Usage:  npm run token -- Receptionist   (or Admin, Patient, Patient2)
require('dotenv').config();
const jwt = require('jsonwebtoken');

const USERS = {
  Admin:        { sub: '00000000-0000-0000-0000-000000000001', role: 'Admin' },
  Receptionist: { sub: '00000000-0000-0000-0000-000000000002', role: 'Receptionist' },
  Patient:      { sub: '00000000-0000-0000-0000-000000000003', role: 'Patient' },  // Sara Ali
  Patient2:     { sub: '00000000-0000-0000-0000-000000000004', role: 'Patient' }   // Youssef Hassan
};

const who = process.argv[2] || 'Receptionist';
if (!USERS[who]) {
  console.error(`Unknown user "${who}". Use one of: ${Object.keys(USERS).join(', ')}`);
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing from backend/.env');
  process.exit(1);
}
console.log(jwt.sign(USERS[who], process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }));
