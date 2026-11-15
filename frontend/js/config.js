// Shared (Student 1 leads). Picks the API address from where the page was opened.
const API_BASE_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://YOUR-API-PROJECT.vercel.app/api';   // <- replace with your real API domain in Step 14

// Cloudflare Turnstile site key (public by design). This is Cloudflare's "always passes" test key.
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
