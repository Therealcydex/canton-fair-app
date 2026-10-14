const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/BoothController');

// Every route below requires a valid token; booths belong to the company of their supplier.
router.use(requireAuth);

// Fixed paths FIRST: '/visits' declared after '/:id' would be captured by it.
router.get('/visits', c.listVisits);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/visits', c.createVisit);
router.put('/:id/visits/:visitId', c.updateVisit);
router.delete('/:id/visits/:visitId', c.removeVisit);

module.exports = router;
