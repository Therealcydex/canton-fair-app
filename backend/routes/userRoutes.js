const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/UserController');

// Every route below requires a valid token and the admin (user management, sign-up validation).
router.use(requireAuth, requireAdmin);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
