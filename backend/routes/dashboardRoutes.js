const express = require('express');
const router = express.Router();
const { requireAuth, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/DashboardController');

// Every route below requires a valid token. Read only: the figures of the web home page (D40).
router.use(requireAuth, refuseViewer); // D66: a viewer only reads its shared suppliers

router.get('/', c.summary);

module.exports = router;
