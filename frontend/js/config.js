/**
 * ClinicSlot Frontend Configuration
 * No secrets stored here: API URL and Turnstile site key are public by design.
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
  // Points to local server during testing, or production Vercel Function
    // Port 8080 = local http-server -> local API. Anything else (Floci S3 on 4566, real AWS) -> Vercel API.
  API_BASE_URL: window.location.port === '8080' ? 'http://localhost:3000/api' : 'https://clinicslot-api.vercel.app/api',
  // Cloudflare Turnstile Public Site Key (Use testing key 1x00000000000000000000AA)
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
};

window.CONFIG = CONFIG;
