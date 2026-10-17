// frontend/js/donate.js
// Validates the donation form, then calls POST /api/donations.

requireLogin('DONOR');

document.getElementById('donation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const value = (id) => document.getElementById(id).value.trim();

  const foodName = value('food_name');
  const description = value('description');
  const category = value('category');
  const quantity = Number(value('quantity'));
  const unit = value('unit');
  const preparedAt = value('prepared_at');
  const expiresAt = value('expires_at');
  const pickupArea = value('pickup_area');
  const pickupAddress = value('pickup_address');

  let valid = true;
  const fail = (field, message) => { setFieldError(field, message); valid = false; };

  if (foodName.length < 2) fail('food_name', 'Enter the food name.');
  if (!category) fail('category', 'Choose a category.');
  if (!Number.isInteger(quantity) || quantity < 1) fail('quantity', 'Enter a whole number of 1 or more.');
  if (!unit) fail('unit', 'Choose a unit.');
  if (pickupAddress.length < 5) fail('pickup_address', 'Enter the pickup address.');
  if (pickupArea.length < 3) fail('pickup_area', 'Enter the pickup area.');

  if (!expiresAt) {
    fail('expires_at', 'Choose a collection deadline.');
  } else if (new Date(expiresAt) <= new Date()) {
    fail('expires_at', 'The deadline must be in the future.');
  }

  if (preparedAt) {
    const prepared = new Date(preparedAt);
    if (prepared > new Date()) {
      fail('prepared_at', 'Preparation time cannot be in the future.');
    } else if (expiresAt && prepared >= new Date(expiresAt)) {
      fail('prepared_at', 'Preparation time must be before the deadline.');
    }
  }
  if (!valid) return;

  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/donations', {
      method: 'POST',
      body: {
        food_name: foodName, description, category, quantity, unit,
        prepared_at: preparedAt || null, expires_at: expiresAt,
        pickup_area: pickupArea, pickup_address: pickupAddress
      }
    });
    showMessage('success', 'Donation created. Redirecting to your dashboard...');
    setTimeout(() => { window.location.href = 'donor-dashboard.html'; }, 1000);
  } catch (err) {
    for (const [field, message] of Object.entries(err.fields)) setFieldError(field, message);
    showMessage('error', err.message);
    button.disabled = false;
  }
});