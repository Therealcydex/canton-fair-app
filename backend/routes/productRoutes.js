const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { parseImages } = require('../utils/upload');
const c = require('../controllers/ProductController');

// Every route below requires a valid token; every user of the group sees every product and
// chooses which of Tarek's companies it is shared with.
router.use(requireAuth);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/images', parseImages, c.addImages);
router.delete('/:id/images/:imageId', c.removeImage);

router.post('/:id/shares', c.share);
router.put('/:id/shares', c.setShares);
router.delete('/:id/shares/:companyId', c.unshare);

module.exports = router;
