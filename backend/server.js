/**
 * ClinicSlot Express Server
 * Module: 26CSCN29H Cloud Computing and Cloud Security
 * Group 2: Abubakar Mansur kurfi (244677), Omar Osama (230001), Abdulahi Jama (249663)
 * 
 * Layered Express 5 Architecture running locally and as a Vercel Function.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const receptionRoutes = require('./routes/reception');   // S3: schedules, status, patients, audit log
const holidayRoutes = require('./routes/holidays');

const app = express();

// =============================================================================
// Security Controls & Middlewares
// =============================================================================

// 1. CORS Configuration: Strict Whitelist (Threat 9 Mitigation)
// Never allows wildcard (*) in production
const defaultOrigins = ['http://localhost:8080', 'http://localhost:3000', 'https://clinicslot-web.vercel.app'];
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''))
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser calls (like curl, Postman, server-to-server) where origin is undefined
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: Origin '${origin}' is not authorized by CORS_ORIGINS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Turnstile-Token']
}));

// 2. HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 3. Request Body Size Limiting (DoS prevention)
app.use(express.json({ limit: '10kb' }));

// 4. Request Logging
app.use(requestLogger);

// =============================================================================
// API Routes
// =============================================================================

// Health Check Endpoint (T-H01)
// Confirms deployment health and runtime status without requiring database access
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'clinicslot-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'Neon Postgres (Connected)' : 'In-Memory / Dev Fallback',
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// Mount modular sub-routers under /api
app.use('/api', authRoutes);
app.use('/api', doctorRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', receptionRoutes);
app.use('/api', holidayRoutes);

// =============================================================================
// Fallbacks & Error Handling
// =============================================================================

// 404 Route Not Found Fallback (T-S01)
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found on this server.`
    }
  });
});

// Central Error Handler
app.use(errorHandler);

// Server startup (only when invoked directly, not when imported as Vercel Function)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 ClinicSlot Backend API listening on port ${PORT}`);
    console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🛡️  Allowed CORS: ${allowedOrigins.join(', ')}`);
    console.log(`=======================================================`);
  });
}

// Export for Vercel Serverless Function
module.exports = app;
