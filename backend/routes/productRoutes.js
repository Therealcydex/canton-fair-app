const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { parseImages } = require('../utils/upload');
const c = require('../controllers/ProductController');

// Every route below requires a valid token. A product belongs to its supplier's company;
// companies it is shared with can read it, never change it.
router.use(requireAuth);

// Fixed paths FIRST: '/incoterms' declared after '/:id' would be captured by it.
router.get('/incoterms', (req, res) => res.json({ success: true, data: c.INCOTERMS }));

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/images', parseImages, c.addImages);
router.delete('/:id/images/:imageId', c.removeImage);

router.post('/:id/shares', c.share);
router.delete('/:id/shares/:companyId', c.unshare);

module.exports = router;
