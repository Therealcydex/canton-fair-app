// One response shape everywhere: { success: true, data } or { success: false, message }.
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Unexpected error: log the detail on the server, send a plain French message.
const serverError = (res, tag, error, message = 'Erreur interne du serveur') => {
  console.error(`[${tag}]`, error);
  return fail(res, 500, message);
};

// Wraps an async controller so a thrown error always ends in a 500 without SQL in the message.
const handle = (tag, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    serverError(res, tag, error);
  }
};

// Parses a positive integer id (route param or body field). Returns null when invalid.
const toId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Trims a string; returns null for empty or missing values.
const clean = (value) => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
};

// Escapes the LIKE wildcards of a search text so '%' and '_' are matched literally.
const likeContains = (text) => `%${String(text).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { fail, serverError, handle, toId, clean, likeContains, EMAIL_RE };
