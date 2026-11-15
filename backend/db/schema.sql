-- ClinicSlot database schema (run once in the Neon SQL Editor, as the owner role)
-- Order matters: tables that others point to come first.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) >= 2),
  email         VARCHAR(254) UNIQUE,
  phone         VARCHAR(20)  UNIQUE,
  password_hash TEXT,                                   -- NULL for walk-ins: they cannot log in
  role          VARCHAR(20) NOT NULL DEFAULT 'Patient'
                CHECK (role IN ('Patient', 'Receptionist', 'Admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS specialties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(300)
);

CREATE TABLE IF NOT EXISTS doctors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    VARCHAR(100) NOT NULL,
  specialty_id UUID NOT NULL REFERENCES specialties(id),
  room         VARCHAR(20),
  slot_minutes INT NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 20, 30)),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id),
  day_of_week INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),   -- 0 = Sunday
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS time_off (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID REFERENCES doctors(id),                -- NULL = whole clinic closed
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  reason     VARCHAR(200),
  source     VARCHAR(20) NOT NULL DEFAULT 'Manual' CHECK (source IN ('Manual', 'HolidayAPI')),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES users(id),
  doctor_id     UUID NOT NULL REFERENCES doctors(id),
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Booked'
                CHECK (status IN ('Booked', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow')),
  reason        VARCHAR(200),
  created_by    UUID REFERENCES users(id),
  cancel_reason VARCHAR(200),
  checked_in_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- One active booking per doctor per start time (cancelled rows free the slot again)
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_active_per_slot
  ON appointments (doctor_id, start_time) WHERE status <> 'Cancelled';
CREATE INDEX IF NOT EXISTS appointments_by_start ON appointments (start_time);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id),
  action     VARCHAR(60) NOT NULL,
  target_id  UUID,
  details    VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_by_time ON audit_log (created_at DESC);

-- ---------- Seed data (fixed ids so every teammate can use them) ----------
INSERT INTO users (id, full_name, email, phone, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Clinic Admin',      'admin@clinicslot.test',     '01000000001', 'Admin'),
  ('00000000-0000-0000-0000-000000000002', 'Nour Reception',    'reception@clinicslot.test', '01000000002', 'Receptionist'),
  ('00000000-0000-0000-0000-000000000003', 'Sara Ali',          'sara@clinicslot.test',      '01011111111', 'Patient'),
  ('00000000-0000-0000-0000-000000000004', 'Youssef Hassan',    'youssef@clinicslot.test',   '01022222222', 'Patient'),
  ('00000000-0000-0000-0000-000000000005', 'Mariam Adel',       NULL,                        '01033333333', 'Patient')
ON CONFLICT (id) DO NOTHING;

INSERT INTO specialties (id, name, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Cardiology',  'Heart and blood vessels'),
  ('10000000-0000-0000-0000-000000000002', 'Dermatology', 'Skin, hair and nails'),
  ('10000000-0000-0000-0000-000000000003', 'Pediatrics',  'Children''s health')
ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, full_name, specialty_id, room, slot_minutes) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Dr. Ahmed Farouk', '10000000-0000-0000-0000-000000000001', 'A1', 30),
  ('20000000-0000-0000-0000-000000000002', 'Dr. Mona Salem',   '10000000-0000-0000-0000-000000000002', 'B2', 20),
  ('20000000-0000-0000-0000-000000000003', 'Dr. Karim Nabil',  '10000000-0000-0000-0000-000000000003', 'C3', 30)
ON CONFLICT (id) DO NOTHING;

-- Every doctor works 09:00-17:00, Sunday to Thursday (0-4)
INSERT INTO doctor_hours (doctor_id, day_of_week, start_time, end_time)
SELECT d.id, dow, '09:00', '17:00'
FROM doctors d CROSS JOIN generate_series(0, 4) AS dow
WHERE NOT EXISTS (SELECT 1 FROM doctor_hours h WHERE h.doctor_id = d.id);