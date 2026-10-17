const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/CompanyController');

// Every route below requires a valid token; only the admin changes the companies.
router.use(requireAuth, refuseViewer); // D62: a viewer only reads its shared booths

router.get('/', c.list);
router.post('/', requireAdmin, c.create);
router.put('/:id', requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
