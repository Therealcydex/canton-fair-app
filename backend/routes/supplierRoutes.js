const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { parseImages } = require('../utils/upload');
const c = require('../controllers/SupplierController');

// Every route below requires a valid token; every user of the group sees every supplier.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.get('/:id/contacts', c.listContacts);
router.post('/:id/contacts', c.createContact);
router.put('/:id/contacts/:contactId', c.updateContact);
router.delete('/:id/contacts/:contactId', c.removeContact);
router.post('/:id/contacts/:contactId/wechat-qr', parseImages, c.setWechatQr);
router.delete('/:id/contacts/:contactId/wechat-qr', c.removeWechatQr);

module.exports = router;
