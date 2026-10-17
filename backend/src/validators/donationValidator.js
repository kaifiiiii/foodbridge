// backend/src/validators/donationValidator.js
// Server-side checks for creating a donation.

const CATEGORIES = ['COOKED_MEAL', 'BAKERY', 'FRUITS_VEGETABLES', 'PACKAGED', 'DAIRY', 'OTHER'];
const UNITS = ['PORTIONS', 'KG', 'ITEMS', 'LITRES'];

// The browser's datetime-local input sends e.g. "2026-10-16T18:30"
const LOCAL_DT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Returns { date, sql } or null. "sql" is the DATETIME format MySQL stores.
// With no "Z" or offset, JavaScript reads it as the server's local time,
// which matches MySQL's NOW() when both run on the same machine.
function parseLocalDateTime(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const m = LOCAL_DT.exec(trimmed);
  if (!m) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return { date, sql: `${m[1]} ${m[2]}:${m[3] || '00'}` };
}

function validateDonation(body = {}) {
  const errors = {};
  const now = new Date();

  const foodName = text(body.food_name);
  const description = text(body.description);
  const pickupArea = text(body.pickup_area);
  const pickupAddress = text(body.pickup_address);

  if (foodName.length < 2 || foodName.length > 100) errors.food_name = 'Food name must be 2 to 100 characters.';
  if (description.length > 500) errors.description = 'Description can be at most 500 characters.';
  if (!CATEGORIES.includes(body.category)) errors.category = 'Choose a valid category.';
  if (!UNITS.includes(body.unit)) errors.unit = 'Choose a valid unit.';
  if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100000) {
    errors.quantity = 'Quantity must be a whole number from 1 to 100000.';
  }
  if (pickupArea.length < 3 || pickupArea.length > 100) errors.pickup_area = 'Pickup area must be 3 to 100 characters.';
  if (pickupAddress.length < 5 || pickupAddress.length > 255) errors.pickup_address = 'Pickup address must be 5 to 255 characters.';

  const expires = parseLocalDateTime(body.expires_at);
  if (!expires) {
    errors.expires_at = 'Enter a valid collection deadline.';
  } else if (expires.date <= now) {
    errors.expires_at = 'The deadline must be in the future.';
  }

  let prepared = null;
  if (body.prepared_at !== undefined && body.prepared_at !== null && body.prepared_at !== '') {
    prepared = parseLocalDateTime(body.prepared_at);
    if (!prepared) {
      errors.prepared_at = 'Enter a valid preparation time.';
    } else if (prepared.date > now) {
      errors.prepared_at = 'Preparation time cannot be in the future.';
    } else if (expires && prepared.date >= expires.date) {
      errors.prepared_at = 'Preparation time must be before the deadline.';
    }
  }

  return {
    errors,
    value: {
      food_name: foodName,
      description: description || null,
      category: body.category,
      quantity: body.quantity,
      unit: body.unit,
      prepared_at: prepared ? prepared.sql : null,
      expires_at: expires ? expires.sql : null,
      pickup_area: pickupArea,
      pickup_address: pickupAddress
    }
  };
}

module.exports = { validateDonation, CATEGORIES, UNITS };