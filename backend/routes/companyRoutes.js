const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const c = require('../controllers/CompanyController');

// Every route below requires a valid token.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', requireSuperAdmin, c.create);
router.put('/:id', requireSuperAdmin, c.update);
router.delete('/:id', requireSuperAdmin, c.remove);

module.exports = router;
