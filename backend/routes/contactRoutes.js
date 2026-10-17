const express = require('express');
const router = express.Router();
const { requireAuth, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/ContactController');

// Every route below requires a valid token. Read only: contacts are changed through
// /api/suppliers/:id/contacts.
router.use(requireAuth, refuseViewer); // D62: a viewer only reads its shared booths

// Fixed paths FIRST: '/export' declared after a '/:id' would be captured by it.
router.get('/export', c.exportCsv);
router.get('/', c.list);

module.exports = router;
