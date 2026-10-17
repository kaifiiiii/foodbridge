// frontend/js/api.js
// One place for all backend calls. Pages never call fetch() directly.

async function api(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: {},
    credentials: 'same-origin'   // send the session cookie
  };
  if (options.body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(path, config);
  } catch (networkError) {
    throw new ApiError('Cannot reach the server. Is it running?', 0, {});
  }

  let data = {};
  try { data = await response.json(); } catch (e) { /* empty or non-JSON body */ }

  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong', response.status, data.fields || {});
  }
  return data;
}

// Ask the backend who is logged in; redirect if not allowed.
// This is only for a good user experience. The backend enforces security.
async function requireLogin(role) {
  try {
    const { user } = await api('/api/auth/me');
    if (role && user.role !== role) {
      window.location.href = dashboardFor(user.role);
      return null;
    }
    return user;
  } catch (err) {
    window.location.href = 'login.html';
    return null;
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  window.location.href = 'login.html';
}
class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;   // HTTP status code
    this.fields = fields;   // per-field errors from the backend, if any
  }
}

// Where each role lands after login.
function dashboardFor(role) {
  return role === 'NGO' ? 'ngo-dashboard.html' : 'donor-dashboard.html';
}