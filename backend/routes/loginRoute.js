const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require('../middleware/loginLimiter');
const c = require('../controllers/AuthController');

// The only public routes of the API: login and sign-up.
router.post('/login', loginLimiter, c.login);
router.get('/signup/companies', c.signupCompanies);
router.post('/signup', signupLimiter, c.signup);

// Identity always comes from req.user, never from req.query or req.body.
router.get('/me', requireAuth, c.me);

module.exports = router;
