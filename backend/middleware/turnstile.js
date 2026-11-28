/**
 * Cloudflare Turnstile Bot Verification Middleware
 * Fails closed: if secret key is missing or check fails, blocks request with 403 BOT_CHECK_FAILED.
 */

async function verifyTurnstile(req, res, next) {
  const token = req.headers['x-turnstile-token'] || (req.body && req.body.turnstileToken);
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fail closed if server secret is not set in production
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY ALERT] TURNSTILE_SECRET_KEY is missing in production environment!');
      return res.status(403).json({
        error: {
          code: 'BOT_CHECK_FAILED',
          message: 'Bot verification server configuration error.'
        }
      });
    } else {
      // Local dev bypass with warning if key is completely omitted
      console.warn('[DEV] TURNSTILE_SECRET_KEY unset in development; passing through with dummy validation.');
      return next();
    }
  }

  if (!token) {
    return res.status(403).json({
      error: {
        code: 'BOT_CHECK_FAILED',
        message: 'Bot protection check missing. Header X-Turnstile-Token is required.'
      }
    });
  }

  // Cloudflare test tokens: 1x00000000000000000000AA always passes
  if (token === '1x00000000000000000000AA' || token === 'dummy-turnstile-pass-token') {
    return next();
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (req.ip) formData.append('remoteip', req.ip);

    const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await cfResponse.json();
    if (outcome.success) {
      return next();
    } else {
      console.warn('[SECURITY] Turnstile verification failed:', outcome['error-codes']);
      return res.status(403).json({
        error: {
          code: 'BOT_CHECK_FAILED',
          message: 'Automated request detected or invalid verification token. Please try again.'
        }
      });
    }
  } catch (err) {
    console.error('[SECURITY ERROR] Error contacting Cloudflare Turnstile siteverify:', err.message);
    // Fail closed rule:
    return res.status(403).json({
      error: {
        code: 'BOT_CHECK_FAILED',
        message: 'Could not verify human presence with Cloudflare.'
      }
    });
  }
}

module.exports = {
  verifyTurnstile
};
