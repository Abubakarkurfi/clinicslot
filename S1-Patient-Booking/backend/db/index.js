/**
 * ClinicSlot Database Client
 * Supports Neon Serverless PostgreSQL with parameterised queries.
 * Includes seamless fallback storage for offline local testing.
 */

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

let sql = null;
const isProduction = process.env.NODE_ENV === 'production';
let databaseUrl = process.env.DATABASE_URL;

// Check if DATABASE_URL is placeholder/dummy template text
const isPlaceholder = !databaseUrl || 
  databaseUrl.includes('YourSecurePasswordHere') || 
  databaseUrl.includes('ep-quiet-pond-123456');

if (isPlaceholder) {
  // Clear placeholder so services seamlessly use the local seeded in-memory store
  delete process.env.DATABASE_URL;
  databaseUrl = null;
  console.log('[DB] Template DATABASE_URL detected. Operating in local in-memory mode seeded with demo accounts & doctors.');
} else if (databaseUrl && databaseUrl.startsWith('postgres')) {
  try {
    sql = neon(databaseUrl);
    console.log('[DB] Connected to Neon PostgreSQL over TLS');
  } catch (err) {
    console.error('[DB] Failed to initialize Neon client:', err.message);
  }
} else {
  console.log('[DB] No DATABASE_URL provided. Operating in robust local in-memory/fallback mode for development & test execution.');
}

// In-Memory store for offline fallback / automated testing
const memoryStore = {
  users: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Clinic Administrator',
      email: 'admin@clinicslot.com',
      phone: '+201001111111',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      role: 'Admin',
      failedLoginCount: 0,
      lastFailedLogin: null,
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      fullName: 'Sarah Receptionist',
      email: 'reception@clinicslot.com',
      phone: '+201002222222',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      role: 'Receptionist',
      failedLoginCount: 0,
      lastFailedLogin: null,
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      fullName: 'Ahmed Patient',
      email: 'patient@clinicslot.com',
      phone: '+201003333333',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      role: 'Patient',
      failedLoginCount: 0,
      lastFailedLogin: null,
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  specialties: [
    { id: 'a0000000-0000-0000-0000-000000000001', name: 'Cardiology', description: 'Heart health, cardiovascular diseases, hypertension and ECG assessment' },
    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Dermatology', description: 'Skin disorders, allergy patch tests, acne care and dermatological procedures' },
    { id: 'a0000000-0000-0000-0000-000000000003', name: 'Pediatrics', description: 'Child healthcare, vaccinations, pediatric check-ups and growth monitoring' },
    { id: 'a0000000-0000-0000-0000-000000000004', name: 'Orthopedics', description: 'Bones, joints, sports injuries, fractures and musculoskeletal conditions' }
  ],
  doctors: [
    { id: 'd0000000-0000-0000-0000-000000000001', fullName: 'Dr. Mahmoud Hassan', specialtyId: 'a0000000-0000-0000-0000-000000000001', room: 'Room 101', slotMinutes: 30, isActive: true },
    { id: 'd0000000-0000-0000-0000-000000000002', fullName: 'Dr. Dina El-Sayed', specialtyId: 'a0000000-0000-0000-0000-000000000002', room: 'Room 102', slotMinutes: 20, isActive: true },
    { id: 'd0000000-0000-0000-0000-000000000003', fullName: 'Dr. Tarek Fouad', specialtyId: 'a0000000-0000-0000-0000-000000000003', room: 'Room 103', slotMinutes: 15, isActive: true },
    { id: 'd0000000-0000-0000-0000-000000000004', fullName: 'Dr. Layla Mansour', specialtyId: 'a0000000-0000-0000-0000-000000000004', room: 'Room 104', slotMinutes: 30, isActive: true }
  ],
  doctorHours: [
    { id: 'h1', doctorId: 'd0000000-0000-0000-0000-000000000001', dayOfWeek: 0, startTime: '09:00', endTime: '14:00' },
    { id: 'h2', doctorId: 'd0000000-0000-0000-0000-000000000001', dayOfWeek: 1, startTime: '09:00', endTime: '14:00' },
    { id: 'h3', doctorId: 'd0000000-0000-0000-0000-000000000001', dayOfWeek: 2, startTime: '09:00', endTime: '14:00' },
    { id: 'h4', doctorId: 'd0000000-0000-0000-0000-000000000001', dayOfWeek: 3, startTime: '09:00', endTime: '14:00' },
    { id: 'h5', doctorId: 'd0000000-0000-0000-0000-000000000002', dayOfWeek: 1, startTime: '10:00', endTime: '15:00' },
    { id: 'h6', doctorId: 'd0000000-0000-0000-0000-000000000002', dayOfWeek: 2, startTime: '10:00', endTime: '15:00' },
    { id: 'h7', doctorId: 'd0000000-0000-0000-0000-000000000002', dayOfWeek: 3, startTime: '10:00', endTime: '15:00' },
    { id: 'h8', doctorId: 'd0000000-0000-0000-0000-000000000002', dayOfWeek: 4, startTime: '10:00', endTime: '15:00' }
  ],
  timeOff: [
    { id: 't1', doctorId: null, startDate: '2026-01-07', endDate: '2026-01-07', reason: 'Coptic Christmas Day', source: 'HolidayAPI' },
    { id: 't2', doctorId: null, startDate: '2026-04-25', endDate: '2026-04-25', reason: 'Sinai Liberation Day', source: 'HolidayAPI' }
  ],
  appointments: [],
  auditLog: [
    { id: 'l1', actorId: '11111111-1111-1111-1111-111111111111', action: 'SYSTEM_INITIALIZED', targetId: null, details: 'Initialized fallback store', createdAt: new Date().toISOString() }
  ]
};

async function query(text, params = []) {
  if (sql) {
    // If Neon is configured, execute parameterised query
    return await sql(text, params);
  }
  return null;
}

module.exports = {
  sql,
  query,
  memoryStore
};
