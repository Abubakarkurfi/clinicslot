# ClinicSlot - Service 1: Patient Booking
**Module:** Cloud Computing and Cloud Security (26CSCN29H)  
**Academic Year:** 2026–2027 | Semester One  
**Student Name:** **Abubakar Mansur kurfi**  
**Student ID:** **244677**  
**Component Role:** S1 Lead & Shared Identity / Authentication Lead  

---

## 📌 Owned Component Overview & Functions
Service 1 provides the end-to-end self-service appointment scheduling capability for clinic patients, protected by strict authentication, concurrency guards, and bot prevention.

### Owned Functions:
1. **Search Doctors & Specialties:** Filter active clinic doctors by medical specialty and name.
2. **View Live Free Slots:** Inspect real-time available consultation intervals for any selected doctor and date.
3. **Book Appointments (Double-Booking Protected):** Secure a slot with concurrency protection enforced by PostgreSQL partial unique indexes.
4. **Reschedule & Cancel:** Self-service modification of upcoming bookings, enforcing the 2-hour pre-appointment cancellation window.
5. **Shared Authentication & Identity:** Patient self-registration (role forced to `Patient`), password hashing with bcrypt (salt 10), signed JWT session management, Cloudflare Turnstile bot verification, and brute-force account lockout.

---

## ☁️ Minimum 3 AWS Cloud Services Integrated

| # | AWS Cloud Service | Operational Function in Service 1 |
|---|---|---|
| 1 | **AWS Lambda** (`clinicslot-s1-booking`) | Serverless compute executing patient booking logic, slot availability verification, and cancellation rules. |
| 2 | **Amazon API Gateway** | Exposes `/api/appointments`, `/api/users`, and `/api/sessions` with CORS headers and request payload validation. |
| 3 | **AWS Secrets Manager** (`clinicslot/auth-secrets`) | Secure storage of `JWT_SECRET` and `TURNSTILE_SECRET_KEY`, eliminating hardcoded secrets in Git. |
| 4 | **Amazon SNS** (`clinicslot-booking-events`) | Publishes real-time booking and cancellation notification events. |
| 5 | **External Database** | **Neon PostgreSQL** (AWS `us-east-2`) providing relational data persistence and concurrency safety. |

---

## 📁 Technical File Ownership

### Frontend:
- `frontend/index.html`: Doctor search and specialist discovery catalogue.
- `frontend/login.html`: Patient sign-in and self-registration with Cloudflare Turnstile bot protection.
- `frontend/book.html`: Interactive appointment booking form with live slot selection grid.
- `frontend/my-appointments.html`: Patient appointment management dashboard with status badges, rescheduling modal, and cancellation.
- `frontend/js/booking.js`: Booking interactions, doctor filtering, and live slot loading.
- `frontend/js/auth.js`: Session token management and dynamic navigation.
- `frontend/js/api.js`: Central HTTP fetch wrapper and XSS-safe DOM textContent rendering.
- `frontend/js/config.js`: Public configuration parameters.
- `frontend/css/style.css`: Responsive medical UI styling.

### Backend:
- `backend/routes/appointments.js`: Routes for `/api/appointments` and `/api/appointments/:id`.
- `backend/routes/auth.js`: Routes for `/api/users`, `/api/sessions`, `/api/auth/me`.
- `backend/controllers/appointmentController.js`: Input validation, 415 media checks, and payload sanitization.
- `backend/controllers/authController.js`: Registration/login validation and parameter tampering prevention.
- `backend/services/appointmentService.js`: Concurrency checks, 3-booking patient quota limit, and 2-hour cancellation window.
- `backend/services/authService.js`: Bcrypt password hashing, JWT generation, and account lockout after 5 failed attempts.
- `backend/services/awsClient.js`: AWS Secrets Manager and Amazon SNS integration.
- `backend/middleware/auth.js`: JWT verification and RBAC authorization middleware.
- `backend/middleware/turnstile.js`: Cloudflare Turnstile verification (fails closed).
- `backend/lambda.js`: AWS Lambda handler (`s1BookingHandler`).

### Database:
- `appointments` table (with partial unique index `(doctor_id, start_time) WHERE status <> 'Cancelled'`).
- `users` table (patient accounts, password hashes, and failed login tracking).

---

## 🛡️ Security Controls Implemented
- **IDOR Protection:** In `appointmentService.js`, patient requests enforce `patient_id === req.user.id`. Unauthorized access returns HTTP 404 `APPOINTMENT_NOT_FOUND` to conceal record existence.
- **Anti-Double-Booking Concurrency Index:** Database partial unique index guarantees that simultaneous requests return HTTP 409 `SLOT_TAKEN`.
- **Bot Defense:** Cloudflare Turnstile widget required on registration and booking (`403 BOT_CHECK_FAILED`).
- **Parameter Tampering Defense:** Client-supplied `"role": "Admin"` or `"status": "CheckedIn"` are discarded by controllers.

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
3. Open browser at: **`http://localhost:8080`**

### Demo Patient Credentials:
- **Email:** `patient@clinicslot.com`
- **Password:** `Password123!`

---

## 📤 How to Push to Your Own GitHub Repository

```bash
cd S1-Patient-Booking
git init
git add .
git commit -m "S1: Complete Patient Booking service, authentication, and AWS integration"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```
