const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/BoothController');

// Every route below requires a valid token; every user of the group sees every booth.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.patch('/:id/visited', c.setVisited);
router.delete('/:id', c.remove);

module.exports = router;
