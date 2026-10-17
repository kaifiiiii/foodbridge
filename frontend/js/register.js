// frontend/js/register.js
// Validates the form, then calls POST /api/auth/register.

const roleFromUrl = new URLSearchParams(window.location.search).get('role');
if (roleFromUrl === 'DONOR' || roleFromUrl === 'NGO') {
  document.getElementById('role').value = roleFromUrl;
}

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  let valid = true;
  if (name.length < 2) { setFieldError('name', 'Please enter your name.'); valid = false; }
  if (!isValidEmail(email)) { setFieldError('email', 'Enter a valid email address.'); valid = false; }
  if (password.length < 8) { setFieldError('password', 'Password must be at least 8 characters.'); valid = false; }
  if (role !== 'DONOR' && role !== 'NGO') { setFieldError('role', 'Choose Donor or NGO.'); valid = false; }
  if (!valid) return;

  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/auth/register', { method: 'POST', body: { name, email, password, role } });
    showMessage('success', 'Account created. Redirecting to log in...');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  } catch (err) {
    // Show the backend's per-field messages if it sent any.
    for (const [field, message] of Object.entries(err.fields)) setFieldError(field, message);
    showMessage('error', err.message);
    button.disabled = false;
  }
});