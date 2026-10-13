// The only place where the API address is defined. Never write an API URL anywhere else.
// localhost -> local backend; any other host -> the backend on the same server, port 3000.
// REACT_APP_API_BASE_URL overrides both (set it at build time once the production URL is known).
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isLocal
    ? 'http://localhost:3000/api'
    : `${window.location.protocol}//${window.location.hostname}:3000/api`);
