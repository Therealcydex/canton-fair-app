const express = require('express');
const router = express.Router();
const { requireAuth, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/BoothController');

// Every route below requires a valid token; every buyer sees every booth. D66: a viewer (LECTEUR)
// only reads the booths of the suppliers shared with its companies; it changes nothing.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', refuseViewer, c.create);
router.get('/:id', c.getById);
router.put('/:id', refuseViewer, c.update);
router.patch('/:id/visited', refuseViewer, c.setVisited);
router.delete('/:id', refuseViewer, c.remove);

module.exports = router;
