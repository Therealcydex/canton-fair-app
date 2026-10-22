const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, refuseViewer } = require('../middleware/auth');
const c = require('../controllers/ProductController');

// Every route below requires a valid token; every buyer sees every product. Only the admin
// decides (D38). D62: products are no longer shared (booths are).
router.use(requireAuth, refuseViewer); // D66: a viewer only reads its shared suppliers

router.get('/', c.list);
router.post('/', c.create);
router.get('/review', c.review); // before /:id
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.put('/:id/decision', requireAdmin, c.decide);

router.post('/:id/images', c.addImages); // D61: JSON, Base64 photos
router.delete('/:id/images/:imageId', c.removeImage);

module.exports = router;
