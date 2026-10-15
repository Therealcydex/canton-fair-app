// frontend/src/config/config.js reads process.env (set by Create React App at build time);
// in the browser bundle there is no `process`, so give it an empty one before anything else loads.
if (typeof globalThis.process === 'undefined') globalThis.process = { env: {} };
