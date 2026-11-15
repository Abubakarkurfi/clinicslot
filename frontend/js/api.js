// Shared (Student 1 leads). One helper for every fetch() to the API.
const TOKEN_KEY = 'clinicslot_token';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// The role inside the token, ONLY to show/hide buttons. The API does the real check.
function getRole() {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)).role || null;
  } catch {
    return null;
  }
}

// apiRequest('/schedules?date=2026-11-16')  or  apiRequest('/patients', { method: 'POST', body: {...} })
// Returns the JSON on success; throws an Error with .status and .code on failure.
async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };
  const token = getToken();
  if (token) options.headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, options);
  } catch {
    const err = new Error('Cannot reach the server. Check your connection and try again.');
    err.status = 0;
    throw err;
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(data?.error?.message || `Request failed (${response.status}).`);
    err.status = response.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}
