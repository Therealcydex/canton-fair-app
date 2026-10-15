const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/DashboardController');

// Every route below requires a valid token. Read only: the figures of the web home page (D40).
router.use(requireAuth);

router.get('/', c.summary);

module.exports = router;
