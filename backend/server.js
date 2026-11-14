// ClinicSlot API entry point (shared file: merge with teammates' version, don't overwrite).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sendError } = require('./utils/validation');

const receptionRoutes = require('./routes/reception');      // S3
// const appointmentRoutes = require('./routes/appointments'); // S1 uncomments
// const doctorRoutes = require('./routes/doctors');           // S2 uncomments

const app = express();

// 1. Request logger: time, method, PATH only. The query string is left out on purpose:
//    ?search=Sara would put patient names into Vercel Logs.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

// 2. CORS: only the origins listed in CORS_ORIGINS (comma separated, no trailing slash)
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

// 3. JSON bodies, max 10 kB
app.use((req, res, next) => {
  const started = Date.now();
  const path = req.originalUrl.split('?')[0];   // full path, read now, without the query string
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

// 5. Service routes
app.use('/api', receptionRoutes);
// app.use('/api', appointmentRoutes);
// app.use('/api', doctorRoutes);

// 6. Unknown route
app.use((req, res) => sendError(res, 404, 'ROUTE_NOT_FOUND', 'Route not found.'));

// 7. Central error handler: real error in the logs, generic message to the client
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'The request body is not valid JSON.');
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }
  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
});

// Locally: listen on PORT. On Vercel: Vercel imports the app and runs it as a function.
const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`ClinicSlot API listening on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

module.exports = app;
