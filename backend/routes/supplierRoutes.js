const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/SupplierController');

// Every route below requires a valid token; data is scoped to req.user.company_id.
router.use(requireAuth);

// Fixed paths FIRST: '/provinces' declared after '/:id' would be captured by it.
router.get('/provinces', c.provinces);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.get('/:id/contacts', c.listContacts);
router.post('/:id/contacts', c.createContact);
router.put('/:id/contacts/:contactId', c.updateContact);
router.delete('/:id/contacts/:contactId', c.removeContact);

module.exports = router;
