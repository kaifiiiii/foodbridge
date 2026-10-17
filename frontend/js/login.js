// frontend/js/login.js
// Validates the login form. Does NOT call the backend yet (Phase 9).

document.getElementById('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  let valid = true;
  if (!isValidEmail(email)) { setFieldError('email', 'Enter a valid email address.'); valid = false; }
  if (password.length === 0) { setFieldError('password', 'Enter your password.'); valid = false; }

  if (!valid) return;

  // TEMPORARY: backend call arrives in Phase 9.
  showMessage('success', 'Form is valid. (Not sent to the server yet.)');
});
// frontend/js/login.js
// Validates the form, then calls POST /api/auth/login.

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  let valid = true;
  if (!isValidEmail(email)) { setFieldError('email', 'Enter a valid email address.'); valid = false; }
  if (password.length === 0) { setFieldError('password', 'Enter your password.'); valid = false; }
  if (!valid) return;

  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    window.location.href = dashboardFor(user.role);
  } catch (err) {
    showMessage('error', err.message);
    button.disabled = false;
  }
});