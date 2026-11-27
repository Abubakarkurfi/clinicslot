# ClinicSlot - Service 2: Doctor & Schedule
**Module:** Cloud Computing and Cloud Security (26CSCN29H)  
**Academic Year:** 2026–2027 | Semester One  
**Student Name:** **Omar Osama**  
**Student ID:** **230001**  
**Component Role:** S2 Lead & Cloud Deployment Lead  

---

## 📌 Owned Component Overview & Functions
Service 2 provides the core administration and scheduling infrastructure for the clinic, governing doctor profiles, consultation durations, clinic working hours, time-off blocking, and national holiday synchronization.

### Owned Functions:
1. **Manage Doctors & Specialties:** Add, edit details (room, consultation length: 15, 20, 30 mins), and toggle active/inactive status for clinic physicians.
2. **Set Weekly Working Hours:** Configure weekly clinic operating hours per physician across days of the week (Sunday to Thursday).
3. **Block Time-Off & Closures:** Block leave for specific doctors or declare clinic-wide closures to prevent slot generation.
4. **Nager.Date External Holiday Import:** Automated synchronization of official Egyptian national public holidays via outbound REST API (`https://date.nager.at/api/v3/PublicHolidays/{year}/EG`) to automatically block holiday slots.
5. **Dynamic Slot Generation Engine (`slotService.js`):** Algorithmic engine that calculates guaranteed free consultation intervals by factoring in operating hours, interval lengths, approved time-off, and existing bookings.

---

## ☁️ Minimum 3 AWS Cloud Services Integrated

| # | AWS Cloud Service | Operational Function in Service 2 |
|---|---|---|
| 1 | **Amazon S3** (`clinicslot-web-frontend`) | Static website hosting for the entire web application with bucket policy and error/index document configuration. |
| 2 | **AWS Lambda** (`clinicslot-s2-schedule`) | Serverless compute executing doctor catalogue management, holiday synchronization, and slot calculation logic. |
| 3 | **Amazon API Gateway** | Exposes `/api/doctors`, `/api/specialties`, and `/api/holidays` with query string mapping and CORS termination. |
| 4 | **AWS Systems Manager / Secrets** | Stores operational configuration parameters and external holiday API sync timestamps. |
| 5 | **External Database** | **Neon PostgreSQL** (AWS `us-east-2`) providing relational data persistence for doctors, specialties, and hours. |

---

## 📁 Technical File Ownership

### Frontend:
- `frontend/admin.html`: Comprehensive administration console for doctor management, specialty creation, time-off, and Egyptian holiday sync.
- `frontend/index.html`: Public doctor catalogue view.
- `frontend/login.html`: Staff administrative sign-in.
- `frontend/js/admin.js`: Administrative dashboard interactions, doctor CRUD, and holiday import trigger.
- `frontend/js/api.js`: Central HTTP fetch wrapper and XSS-safe DOM textContent rendering.
- `frontend/js/auth.js`: Session token management and dynamic navigation.
- `frontend/js/config.js`: Public configuration parameters.
- `frontend/css/style.css`: Responsive medical UI styling.

### Backend:
- `backend/routes/doctors.js`: Routes for `/api/doctors`, `/api/specialties`, `/api/doctors/:id/slots`, `/api/doctors/:id/hours`, `/api/doctors/:id/time-off`.
- `backend/routes/holidays.js`: Routes for `/api/holidays` (Nager.Date import trigger).
- `backend/controllers/doctorController.js`: Input validation, slot duration range checks (15, 20, 30), and doctor status updates.
- `backend/controllers/holidayController.js`: Holiday import validation and year bounds checking.
- `backend/services/doctorService.js`: Doctor and specialty relational queries and working hour persistence.
- `backend/services/slotService.js`: Core slot calculation engine used by S1 Booking and S3 Reception.
- `backend/services/holidayService.js`: Outbound HTTPS client for Nager.Date API with 6-second timeout and 502 fallback.
- `backend/services/awsClient.js`: Amazon S3 upload and AWS SDK v3 integration.
- `backend/middleware/auth.js`: Admin-only authorization checks (`authorize('Admin')`).
- `backend/lambda.js`: AWS Lambda handler (`s2ScheduleHandler`).

### Database:
- `specialties` table (medical categories).
- `doctors` table (physician profiles, room assignments, slot durations).
- `doctor_hours` table (weekly schedule intervals with `end_time > start_time` CHECK constraint).
- `time_off` table (manual leave blocks and imported holiday records).

---

## 🛡️ Security Controls Implemented
- **Admin-Only RBAC:** Endpoints modifying clinic schedules (`POST /api/doctors`, `POST /api/holidays`) enforce `authorize('Admin')`.
- **External API Resilience:** Nager.Date calls employ a 6-second `AbortController` timeout, validating external payload schemas and safely failing with HTTP 502 `EXTERNAL_API_ERROR` if the third-party service hangs.
- **SQL Injection Prevention:** 100% parameterised tagged templates prevent SQL injection in doctor search and catalog queries.

---

## 🚀 How to Run Locally

1. **Start Backend (Port 3000):**
   ```bash
   cd backend
   npm install
   npm start
   ```
2. **Start Frontend (Port 8080):**
   ```bash
   cd frontend
   npx http-server . -p 8080 -c-1
   ```
3. Open browser at: **`http://localhost:8080/admin.html`**

### Demo Admin Credentials:
- **Email:** `admin@clinicslot.com`
- **Password:** `Password123!`

---

## 📤 How to Push to Your Own GitHub Repository

```bash
cd S2-Doctor-Schedule
git init
git add .
git commit -m "S2: Complete Doctor & Schedule service, Nager.Date holiday sync, and S3 hosting"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```
