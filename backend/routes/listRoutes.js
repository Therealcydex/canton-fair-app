const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/ListController');

// Every route below requires a valid token. Read-only reference lists.
router.use(requireAuth);

router.get('/provinces', c.provinces);
router.get('/shipping-types', c.shippingTypes);
router.get('/canton-categories', c.cantonCategories);

module.exports = router;
