const express = require('express');
const router = express.Router();
const { requireAuth, refuseViewer } = require('../middleware/auth');
const { parseImages } = require('../utils/upload');
const c = require('../controllers/SupplierController');

// Every route below requires a valid token; every buyer sees every supplier. D66: a viewer
// (LECTEUR) only reads the suppliers shared with its companies (the three GET routes below).
router.use(requireAuth);

router.get('/', c.list);
router.get('/provinces', c.provinces); // before /:id
router.get('/categories', c.listCategories); // D69, before /:id
router.post('/categories', refuseViewer, c.addCategory);
router.post('/', refuseViewer, c.create);
router.get('/:id', c.getById);
router.put('/:id', refuseViewer, c.update);
router.delete('/:id', refuseViewer, c.remove);

router.use('/:id/contacts', refuseViewer); // the viewer gets the contacts with GET /:id
router.get('/:id/contacts', c.listContacts);
router.post('/:id/contacts', c.createContact);
router.put('/:id/contacts/:contactId', c.updateContact);
router.delete('/:id/contacts/:contactId', c.removeContact);
router.post('/:id/contacts/:contactId/wechat-qr', parseImages, c.setWechatQr);
router.put('/:id/contacts/:contactId/wechat-qr', c.setWechatContent);
router.delete('/:id/contacts/:contactId/wechat-qr', c.removeWechatQr);

module.exports = router;
