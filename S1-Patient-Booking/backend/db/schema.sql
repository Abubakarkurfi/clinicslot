-- =============================================================================
-- ClinicSlot Database Schema (Neon PostgreSQL)
-- Module: 26CSCN29H Cloud Computing and Cloud Security
-- Group 2: Abubakar Mansur kurfi (244677), Omar Osama (230001), Abdulahi Jama (249663)
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Shared Auth & S3 Walk-ins)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Patient' CHECK (role IN ('Patient', 'Receptionist', 'Admin')),
    failed_login_count INT NOT NULL DEFAULT 0,
    last_failed_login TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on email for rapid lookup during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Specialties Table (S2 Doctor & Schedule)
CREATE TABLE IF NOT EXISTS specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Doctors Table (S2 Doctor & Schedule, S1 Booking Search)
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
    room VARCHAR(20) NOT NULL,
    slot_minutes INT NOT NULL CHECK (slot_minutes IN (15, 20, 30)),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty_id);

-- 4. Doctor Weekly Working Hours (S2 Doctor & Schedule)
-- day_of_week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
CREATE TABLE IF NOT EXISTS doctor_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT chk_hours_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_hours_lookup ON doctor_hours(doctor_id, day_of_week);

-- 5. Time Off & Public Holidays (S2 Doctor & Schedule)
-- doctor_id NULL represents clinic-wide closure (e.g., imported public holidays)
CREATE TABLE IF NOT EXISTS time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(200) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('Manual', 'HolidayAPI')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_time_off_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_time_off_dates ON time_off(start_date, end_date);

-- 6. Appointments Table (S1 Patient Booking & S3 Reception Desk)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow')),
    reason VARCHAR(200),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    cancel_reason VARCHAR(200),
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_appointment_time CHECK (end_time > start_time)
);

-- Crucial Concurrency & Anti-Double-Booking Guard:
-- Partial unique index ensuring only one active appointment can exist for a given doctor & start_time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot 
ON appointments(doctor_id, start_time) 
WHERE status <> 'Cancelled';

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, start_time);

-- 7. Audit Log Table (Shared Security & S3 Audit Log)
-- Append-only security tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    target_id UUID,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- =============================================================================
-- Principle of Least Privilege: Role & Permissions Setup (Neon Postgres)
-- =============================================================================
-- In production, the application connects using 'clinic_app' role, NOT the database owner.
-- The commands below grant ONLY the required CRUD operations on application tables,
-- preventing any DDL modifications or DELETE/UPDATE on audit_log.
/*
CREATE ROLE clinic_app WITH LOGIN PASSWORD 'ReplaceWithStrongGeneratedPassword!';
GRANT CONNECT ON DATABASE clinicslot TO clinic_app;
GRANT USAGE ON SCHEMA public TO clinic_app;
GRANT SELECT, INSERT, UPDATE ON TABLE users, specialties, doctors, doctor_hours, time_off, appointments TO clinic_app;
GRANT SELECT, INSERT ON TABLE audit_log TO clinic_app; -- strictly append-only, no UPDATE or DELETE allowed
REVOKE DELETE ON TABLE appointments FROM clinic_app;  -- appointments are cancelled via status, never deleted
*/
