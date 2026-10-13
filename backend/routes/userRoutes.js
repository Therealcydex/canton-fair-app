const express = require('express');
const router = express.Router();
const { requireAuth, requireLevel } = require('../middleware/auth');
const { ADMIN_LEVEL } = require('../utils/access');
const c = require('../controllers/UserController');

// Every route below requires a valid token and a company admin (or the super-admin).
router.use(requireAuth, requireLevel(ADMIN_LEVEL));

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);

module.exports = router;
