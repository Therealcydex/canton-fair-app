const express = require('express');
const router = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const c = require('../controllers/CategoryController');

// Every route below requires a valid token. Categories are global (D3): only the
// super-admin changes them.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', requireSuperAdmin, c.create);
router.put('/:id', requireSuperAdmin, c.update);
router.delete('/:id', requireSuperAdmin, c.remove);

module.exports = router;
