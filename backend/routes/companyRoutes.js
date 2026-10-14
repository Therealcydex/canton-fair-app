const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/CompanyController');

// Every route below requires a valid token; only the admin changes the companies.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', requireAdmin, c.create);
router.put('/:id', requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
