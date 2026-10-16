// Slows down password guessing on POST /api/login (D21): after MAX_FAILURES failed attempts
// for the same username from the same address within WINDOW_MS, further attempts are refused
// with 429 until the window ends. A successful login clears the counter.
// In memory: it resets when the server restarts, which is enough for a single PM2 instance.
const { fail } = require('../utils/http');

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // key -> { count, first }

const keyOf = (req) => `${req.ip}|${String(req.body?.username || '').trim().toLowerCase()}`;

function current(key) {
  const entry = failures.get(key);
  if (entry && Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return null;
  }
  return entry || null;
}

// Middleware placed before the login controller.
const loginLimiter = (req, res, next) => {
  const entry = current(keyOf(req));
  if (entry && entry.count >= MAX_FAILURES) {
    const minutes = Math.ceil((entry.first + WINDOW_MS - Date.now()) / 60000);
    return fail(res, 429, `Trop de tentatives de connexion. Réessayez dans ${minutes} minute(s).`);
  }
  // Count the outcome once the controller has answered.
  res.on('finish', () => {
    const key = keyOf(req);
    if (res.statusCode === 401) {
      const e = current(key) || { count: 0, first: Date.now() };
      e.count += 1;
      failures.set(key, e);
    } else if (res.statusCode === 200) {
      failures.delete(key);
    }
  });
  next();
};

// Old entries are dropped regularly so the map cannot grow without limit.
setInterval(() => {
  for (const key of failures.keys()) current(key);
}, WINDOW_MS).unref();

module.exports = { loginLimiter, MAX_FAILURES };
