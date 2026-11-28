/**
 * Central API Client and XSS-Safe DOM Helpers
 * Enforces textContent rendering to completely neutralize Stored/Reflected XSS attacks.
 */

async function apiRequest(endpoint, options = {}) {
  const url = `${window.CONFIG.API_BASE_URL}${endpoint}`;
  const headers = { ...options.headers };

  // Attach session token if logged in
  const token = localStorage.getItem('token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach Content-Type if payload provided
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const res = await fetch(url, fetchOptions);
    let data = null;
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : {};
    }

    if (!res.ok) {
      const errorObj = new Error(data.error?.message || `HTTP ${res.status}: Request failed`);
      errorObj.status = res.status;
      errorObj.code = data.error?.code || 'UNKNOWN_ERROR';
      errorObj.data = data;
      throw errorObj;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      console.error('[API NETWORK ERROR] Could not connect to API server at:', url);
      const networkError = new Error('Cannot connect to ClinicSlot server. Please check your connection or CORS configuration.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw err;
  }
}

/**
 * XSS-Safe Helper: Assign text safely using textContent.
 * Never sets innerHTML to prevent script execution (Threat 6 mitigation).
 */
function safeText(element, text) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.textContent = text !== null && text !== undefined ? String(text) : '';
  }
}

/**
 * Helper to display alerts safely without innerHTML
 */
function showAlert(containerId, message, type = 'error') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = ''; // clear previous
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  container.appendChild(alertDiv);
}

function clearAlert(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

window.apiRequest = apiRequest;
window.safeText = safeText;
window.showAlert = showAlert;
window.clearAlert = clearAlert;
