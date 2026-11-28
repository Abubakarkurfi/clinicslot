-- Run once in the Neon SQL Editor (owner role) AFTER schema.sql and app-role.sql.
-- Adds the columns S1 (login lockout) and S2 (specialties, time-off) expect. Safe to run twice.
ALTER TABLE users       ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0;
ALTER TABLE users       ADD COLUMN IF NOT EXISTS last_failed_login  TIMESTAMPTZ;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE time_off    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE audit_log   ALTER COLUMN details TYPE TEXT;
GRANT DELETE ON doctor_hours TO clinic_app;
