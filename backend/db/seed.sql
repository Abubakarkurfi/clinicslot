-- =============================================================================
-- ClinicSlot Initial Seed Data
-- =============================================================================

-- Passwords for demo accounts: "Password123!"
-- Generated using bcryptjs with 10 salt rounds:
-- Hash: $2a$10$e8w.p8p47qR8k7Y26u787.e4z6/X3P5J.Xn9q6XhE4lq7hK1Y0dKG

INSERT INTO users (id, full_name, email, phone, password_hash, role) VALUES
('11111111-1111-1111-1111-111111111111', 'Clinic Administrator', 'admin@clinicslot.com', '+201001111111', '$2a$10$e8w.p8p47qR8k7Y26u787.e4z6/X3P5J.Xn9q6XhE4lq7hK1Y0dKG', 'Admin'),
('22222222-2222-2222-2222-222222222222', 'Sarah Receptionist', 'reception@clinicslot.com', '+201002222222', '$2a$10$e8w.p8p47qR8k7Y26u787.e4z6/X3P5J.Xn9q6XhE4lq7hK1Y0dKG', 'Receptionist'),
('33333333-3333-3333-3333-333333333333', 'Ahmed Patient', 'patient@clinicslot.com', '+201003333333', '$2a$10$e8w.p8p47qR8k7Y26u787.e4z6/X3P5J.Xn9q6XhE4lq7hK1Y0dKG', 'Patient')
ON CONFLICT (email) DO NOTHING;

-- Specialties
INSERT INTO specialties (id, name, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'Cardiology', 'Heart health, cardiovascular diseases, hypertension and ECG assessment'),
('a0000000-0000-0000-0000-000000000002', 'Dermatology', 'Skin disorders, allergy patch tests, acne care and dermatological procedures'),
('a0000000-0000-0000-0000-000000000003', 'Pediatrics', 'Child healthcare, vaccinations, pediatric check-ups and growth monitoring'),
('a0000000-0000-0000-0000-000000000004', 'Orthopedics', 'Bones, joints, sports injuries, fractures and musculoskeletal conditions')
ON CONFLICT (name) DO NOTHING;

-- Doctors
INSERT INTO doctors (id, full_name, specialty_id, room, slot_minutes, is_active) VALUES
('d0000000-0000-0000-0000-000000000001', 'Dr. Mahmoud Hassan', 'a0000000-0000-0000-0000-000000000001', 'Room 101', 30, true),
('d0000000-0000-0000-0000-000000000002', 'Dr. Dina El-Sayed', 'a0000000-0000-0000-0000-000000000002', 'Room 102', 20, true),
('d0000000-0000-0000-0000-000000000003', 'Dr. Tarek Fouad', 'a0000000-0000-0000-0000-000000000003', 'Room 103', 15, true),
('d0000000-0000-0000-0000-000000000004', 'Dr. Layla Mansour', 'a0000000-0000-0000-0000-000000000004', 'Room 104', 30, true)
ON CONFLICT (id) DO NOTHING;

-- Doctor Working Hours (Sunday=0 to Thursday=4 for Egypt clinic standard)
-- Dr. Mahmoud Hassan: Sun-Wed 09:00 - 14:00
INSERT INTO doctor_hours (doctor_id, day_of_week, start_time, end_time) VALUES
('d0000000-0000-0000-0000-000000000001', 0, '09:00:00', '14:00:00'),
('d0000000-0000-0000-0000-000000000001', 1, '09:00:00', '14:00:00'),
('d0000000-0000-0000-0000-000000000001', 2, '09:00:00', '14:00:00'),
('d0000000-0000-0000-0000-000000000001', 3, '09:00:00', '14:00:00'),
-- Dr. Dina El-Sayed: Mon-Thu 10:00 - 15:00
('d0000000-0000-0000-0000-000000000002', 1, '10:00:00', '15:00:00'),
('d0000000-0000-0000-0000-000000000002', 2, '10:00:00', '15:00:00'),
('d0000000-0000-0000-0000-000000000002', 3, '10:00:00', '15:00:00'),
('d0000000-0000-0000-0000-000000000002', 4, '10:00:00', '15:00:00'),
-- Dr. Tarek Fouad: Sun, Tue, Thu 09:00 - 13:00
('d0000000-0000-0000-0000-000000000003', 0, '09:00:00', '13:00:00'),
('d0000000-0000-0000-0000-000000000003', 2, '09:00:00', '13:00:00'),
('d0000000-0000-0000-0000-000000000003', 4, '09:00:00', '13:00:00'),
-- Dr. Layla Mansour: Sun-Wed 11:00 - 16:00
('d0000000-0000-0000-0000-000000000004', 0, '11:00:00', '16:00:00'),
('d0000000-0000-0000-0000-000000000004', 1, '11:00:00', '16:00:00'),
('d0000000-0000-0000-0000-000000000004', 2, '11:00:00', '16:00:00'),
('d0000000-0000-0000-0000-000000000004', 3, '11:00:00', '16:00:00');

-- Initial audit log entry
INSERT INTO audit_log (actor_id, action, details) VALUES
('11111111-1111-1111-1111-111111111111', 'SYSTEM_INITIALIZED', 'Database seed loaded successfully with default staff and specialties');
