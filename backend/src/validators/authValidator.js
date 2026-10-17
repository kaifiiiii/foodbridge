// backend/src/validators/authValidator.js
// Server-side validation. The frontend checks are only for convenience.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_ROLES = ['DONOR', 'NGO'];   // ADMIN is deliberately NOT here

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateRegister(body = {}) {
  const errors = {};
  const name = cleanString(body.name);
  const email = cleanString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role;

  if (name.length < 2 || name.length > 100) errors.name = 'Name must be 2 to 100 characters.';
  if (email.length > 255 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  // bcrypt only uses the first 72 bytes, so we cap the length.
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    errors.password = 'Password must be 8 to 72 characters.';
  }
  if (!PUBLIC_ROLES.includes(role)) errors.role = 'Role must be DONOR or NGO.';

  return { errors, value: { name, email, password, role } };
}

function validateLogin(body = {}) {
  const email = cleanString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};
  if (!email) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return { errors, value: { email, password } };
}

module.exports = { validateRegister, validateLogin };