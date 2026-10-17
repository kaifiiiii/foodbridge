// frontend/js/validation.js
// Reusable helpers for form validation and messages.

function setFieldError(fieldId, message) {
  document.getElementById(fieldId + '-error').textContent = message;
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  const box = document.getElementById('form-message');
  box.className = 'form-message';
  box.textContent = '';
}

function showMessage(type, text) {
  const box = document.getElementById('form-message');
  box.className = 'form-message ' + type; // 'error' or 'success'
  box.textContent = text;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}