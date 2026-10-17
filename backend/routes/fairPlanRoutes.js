const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/FairPlanController');

// Every route below requires a valid token. Everyone reads the hall plan; the admin fills it (D42).
router.use(requireAuth, refuseViewer); // D62: a viewer only reads its shared booths

router.get('/', c.list);
router.put('/', requireAdmin, c.setHalls);

module.exports = router;
