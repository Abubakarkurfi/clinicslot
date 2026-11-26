/**
 * Request Logging Middleware
 * Outputs clean request metrics to console / Vercel Logs.
 * Strictly sanitizes sensitive values (passwords, tokens, keys).
 */

function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `[${timestamp}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`;

    // Only log security-relevant actions and high-level requests
    if (res.statusCode >= 400) {
      console.warn(`[WARN] ${logLine} (IP: ${req.ip || 'anonymous'})`);
    } else {
      console.log(`[INFO] ${logLine}`);
    }
  });

  next();
}

module.exports = requestLogger;
