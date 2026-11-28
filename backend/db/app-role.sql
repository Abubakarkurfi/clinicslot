-- Least-privilege role the API uses (run once, as the owner, AFTER schema.sql).
-- Replace the password ONLY in the Neon editor. Never commit the real password.

CREATE ROLE clinic_app WITH LOGIN PASSWORD 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';

GRANT USAGE ON SCHEMA public TO clinic_app;
GRANT SELECT, INSERT, UPDATE ON users, specialties, doctors, doctor_hours, appointments TO clinic_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON time_off TO clinic_app;
GRANT SELECT, INSERT ON audit_log TO clinic_app;

-- Check: audit_log must list only INSERT and SELECT
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'clinic_app'
GROUP BY table_name
ORDER BY table_name;