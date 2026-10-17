// backend/src/routes/donationRoutes.js
// Mounted at /api/donations. Everything here requires a logged-in user.

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/donationController');

const router = express.Router();

router.use(requireAuth);

router.post('/', requireRole('DONOR'), c.createDonation);
router.get('/available', requireRole('NGO'), c.listAvailable);
router.get('/mine', requireRole('DONOR'), c.listMine);
router.get('/claimed', requireRole('NGO'), c.listClaimed);
router.get('/:id', c.getOne);                                      // after the fixed paths above
router.patch('/:id/cancel', requireRole('DONOR'), c.cancelDonation);
router.patch('/:id/claim', requireRole('NGO'), c.claimDonation);
router.patch('/:id/status', requireRole('DONOR', 'NGO'), c.changeStatus);

module.exports = router;