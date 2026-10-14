const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/loginLimiter');
const c = require('../controllers/AuthController');

// The only public route of the API.
router.post('/login', loginLimiter, c.login);

// Identity always comes from req.user, never from req.query or req.body.
router.get('/me', requireAuth, c.me);

module.exports = router;
