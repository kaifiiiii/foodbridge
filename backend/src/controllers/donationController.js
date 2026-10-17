// backend/src/controllers/donationController.js
// Donation endpoints. Authentication and roles are enforced by middleware in the routes file;
// ownership is enforced inside the SQL here.

const pool = require('../config/db');
const { validateDonation, CATEGORIES } = require('../validators/donationValidator');

// Columns every NGO may see while browsing. pickup_address is deliberately absent.
const PUBLIC_COLUMNS = `d.id, d.food_name, d.description, d.category, d.quantity, d.unit,
  d.prepared_at, d.expires_at, d.pickup_area, d.status, u.name AS donor_name`;

// Mark overdue AVAILABLE donations as EXPIRED so statuses are always truthful.
async function expireOverdue() {
  await pool.execute(
    "UPDATE donations SET status = 'EXPIRED' WHERE status = 'AVAILABLE' AND expires_at <= NOW()"
  );
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Used when an atomic UPDATE changed 0 rows: work out why.
// 404 = does not exist or is not yours (we do not reveal which). 409 = wrong state.
async function explainFailure(res, id, userId, ownerField) {
  const [rows] = await pool.execute(
    'SELECT status, donor_id, claimed_by_ngo_id FROM donations WHERE id = ?',
    [id]
  );
  const d = rows[0];
  if (!d || d[ownerField] !== userId) {
    return res.status(404).json({ error: 'Donation not found' });
  }
  return res.status(409).json({
    error: 'This donation is ' + d.status.toLowerCase() + ' and cannot be changed this way'
  });
}

// POST /api/donations  (DONOR)
async function createDonation(req, res) {
  const { errors, value } = validateDonation(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
  }

  // donor_id comes from the session, never from the request body.
  const [result] = await pool.execute(
    `INSERT INTO donations
       (donor_id, food_name, description, category, quantity, unit,
        prepared_at, expires_at, pickup_area, pickup_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.user.id, value.food_name, value.description, value.category, value.quantity,
     value.unit, value.prepared_at, value.expires_at, value.pickup_area, value.pickup_address]
  );
  res.status(201).json({ donation: { id: result.insertId, status: 'AVAILABLE' } });
}

// GET /api/donations/available?search=&category=  (NGO)
async function listAvailable(req, res) {
  await expireOverdue();

  const where = ["d.status = 'AVAILABLE'", 'd.expires_at > NOW()'];   // fixed text only
  const params = [];

  const { category, search } = req.query;
  if (typeof category === 'string' && category) {
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    where.push('d.category = ?');
    params.push(category);
  }
  if (typeof search === 'string' && search.trim()) {
    where.push('d.food_name LIKE ?');
    params.push('%' + search.trim().slice(0, 100) + '%');
  }

  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS}
       FROM donations d
       JOIN users u ON u.id = d.donor_id
      WHERE ${where.join(' AND ')}
      ORDER BY d.expires_at ASC
      LIMIT 100`,
    params
  );
  res.json({ donations: rows });
}

// GET /api/donations/mine  (DONOR)
async function listMine(req, res) {
  await expireOverdue();
  const [rows] = await pool.execute(
    `SELECT d.id, d.food_name, d.description, d.category, d.quantity, d.unit,
            d.prepared_at, d.expires_at, d.pickup_area, d.pickup_address, d.status,
            d.created_at, n.name AS claimed_by_name
       FROM donations d
       LEFT JOIN users n ON n.id = d.claimed_by_ngo_id
      WHERE d.donor_id = ?
      ORDER BY d.created_at DESC`,
    [req.session.user.id]
  );
  res.json({ donations: rows });
}

// GET /api/donations/claimed  (NGO)
async function listClaimed(req, res) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.food_name, d.description, d.category, d.quantity, d.unit,
            d.prepared_at, d.expires_at, d.pickup_area, d.pickup_address, d.status,
            u.name AS donor_name
       FROM donations d
       JOIN users u ON u.id = d.donor_id
      WHERE d.claimed_by_ngo_id = ?
      ORDER BY d.updated_at DESC`,
    [req.session.user.id]
  );
  res.json({ donations: rows });
}

// GET /api/donations/:id  (any logged-in user; the view depends on who asks)
async function getOne(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid donation id' });

  await expireOverdue();
  const [rows] = await pool.execute(
    `SELECT d.*, u.name AS donor_name, n.name AS claimed_by_name
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       LEFT JOIN users n ON n.id = d.claimed_by_ngo_id
      WHERE d.id = ?`,
    [id]
  );
  const d = rows[0];
  const user = req.session.user;
  if (!d) return res.status(404).json({ error: 'Donation not found' });

  // Full view: the donor who created it, the NGO that claimed it, or an admin.
  if (d.donor_id === user.id || d.claimed_by_ngo_id === user.id || user.role === 'ADMIN') {
    return res.json({ donation: d });
  }

  // Public view: any NGO, but only while the donation is still available.
  if (user.role === 'NGO' && d.status === 'AVAILABLE') {
    const publicView = {
      id: d.id, food_name: d.food_name, description: d.description, category: d.category,
      quantity: d.quantity, unit: d.unit, prepared_at: d.prepared_at, expires_at: d.expires_at,
      pickup_area: d.pickup_area, status: d.status, donor_name: d.donor_name
    };
    return res.json({ donation: publicView });
  }

  // Everyone else gets 404, so we do not reveal that the donation exists.
  res.status(404).json({ error: 'Donation not found' });
}

// PATCH /api/donations/:id/cancel  (DONOR, owner only, AVAILABLE only)
async function cancelDonation(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid donation id' });

  await expireOverdue();
  const [result] = await pool.execute(
    `UPDATE donations SET status = 'CANCELLED'
      WHERE id = ? AND donor_id = ? AND status = 'AVAILABLE'`,
    [id, req.session.user.id]
  );
  if (result.affectedRows === 0) return explainFailure(res, id, req.session.user.id, 'donor_id');
  res.json({ donation: { id, status: 'CANCELLED' } });
}

// PATCH /api/donations/:id/status  (DONOR owner or claiming NGO; ACCEPTED -> COLLECTED only)
async function changeStatus(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid donation id' });

  if (!req.body || req.body.status !== 'COLLECTED') {
    return res.status(400).json({ error: 'Only the status COLLECTED can be set here' });
  }

  // The column name comes from this fixed map, never from the request.
  const ownerField = req.session.user.role === 'NGO' ? 'claimed_by_ngo_id' : 'donor_id';

  const [result] = await pool.execute(
    `UPDATE donations SET status = 'COLLECTED'
      WHERE id = ? AND ${ownerField} = ? AND status = 'ACCEPTED'`,
    [id, req.session.user.id]
  );
  if (result.affectedRows === 0) return explainFailure(res, id, req.session.user.id, ownerField);
  res.json({ donation: { id, status: 'COLLECTED' } });
}
module.exports = {
  createDonation, listAvailable, listMine, listClaimed, getOne,
  cancelDonation, changeStatus, claimDonation
};
// PATCH /api/donations/:id/claim  (NGO)
async function claimDonation(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid donation id' });

  // Atomic: the check and the change happen in ONE statement.
  const [result] = await pool.execute(
    `UPDATE donations
        SET status = 'ACCEPTED', claimed_by_ngo_id = ?
      WHERE id = ? AND status = 'AVAILABLE' AND expires_at > NOW()`,
    [req.session.user.id, id]
  );

  if (result.affectedRows === 0) {
    const [rows] = await pool.execute(
      'SELECT status, expires_at <= NOW() AS overdue FROM donations WHERE id = ?',
      [id]
    );
    const d = rows[0];
    if (!d) return res.status(404).json({ error: 'Donation not found' });
    if (d.status === 'AVAILABLE' && d.overdue) {
      return res.status(409).json({ error: 'This donation has expired' });
    }
    return res.status(409).json({ error: 'This donation is no longer available' });
  }

  // We won. Only now do we reveal the full pickup details.
  const [rows] = await pool.execute(
    `SELECT d.id, d.food_name, d.pickup_area, d.pickup_address, d.status, d.expires_at,
            u.name AS donor_name
       FROM donations d JOIN users u ON u.id = d.donor_id
      WHERE d.id = ?`,
    [id]
  );
  res.json({ donation: rows[0] });
}

module.exports = {
  createDonation, listAvailable, listMine, listClaimed, getOne,
  cancelDonation, changeStatus, claimDonation
};