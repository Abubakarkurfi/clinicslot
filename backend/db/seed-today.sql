-- Demo appointments for TODAY (Cairo time). Run again on demo day to reset them.
DELETE FROM appointments
WHERE (start_time AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date;

WITH today AS (SELECT (now() AT TIME ZONE 'Africa/Cairo')::date AS d),
demo(patient_id, doctor_id, at_time, minutes, reason) AS (
  VALUES
  ('00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, time '09:00', 30, 'Check-up'),
  ('00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, time '10:30', 30, 'Chest pain follow-up'),
  ('00000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, time '14:00', 30, 'Blood pressure'),
  ('00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, time '11:00', 20, 'Rash'),
  ('00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, time '13:20', 20, NULL),
  ('00000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, time '09:30', 30, 'Vaccination'),
  ('00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, time '12:00', 30, NULL),
  ('00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, time '16:00', 30, 'Fever')
)
INSERT INTO appointments (patient_id, doctor_id, start_time, end_time, reason, created_by)
SELECT demo.patient_id, demo.doctor_id,
       (today.d + demo.at_time) AT TIME ZONE 'Africa/Cairo',
       (today.d + demo.at_time + make_interval(mins => demo.minutes)) AT TIME ZONE 'Africa/Cairo',
       demo.reason,
       '00000000-0000-0000-0000-000000000002'
FROM demo CROSS JOIN today;

-- Show what was created
SELECT a.id, d.full_name AS doctor, u.full_name AS patient,
       to_char(a.start_time AT TIME ZONE 'Africa/Cairo', 'HH24:MI') AS starts, a.status
FROM appointments a
JOIN doctors d ON d.id = a.doctor_id
JOIN users u ON u.id = a.patient_id
WHERE (a.start_time AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date
ORDER BY d.full_name, a.start_time;