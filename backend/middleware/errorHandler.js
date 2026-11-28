/**
 * Central Error Handler Middleware
 * Adheres strictly to the course standard error response format:
 * { "error": { "code": "ERROR_CODE", "message": "Human readable explanation" } }
 * Never leaks stack traces, passwords, or internal infrastructure details.
 */

function errorHandler(err, req, res, next) {
  // If headers were already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle express.json() parse errors (invalid JSON payload)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload in request body.'
      }
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const errorMessage = err.message || 'An unexpected internal server error occurred.';

  // Log error details privately to Vercel Logs / console, avoiding client exposure
  console.error(`[ERROR] [${req.method} ${req.originalUrl}] ${statusCode} ${errorCode}:`, err.stack || err.message);

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: statusCode === 500 ? 'An unexpected server error occurred. Please try again later.' : errorMessage
    }
  });
}

module.exports = errorHandler;
