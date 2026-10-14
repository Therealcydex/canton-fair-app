// The only place where the API address is defined (set VITE_API_BASE_URL at build time).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Uploaded files (product photos) are served next to the API: "/uploads/...".
export const fileUrl = (path?: string | null) => (path ? `${API_BASE_URL.replace(/\/api\/?$/, '')}${path}` : undefined);

const TOKEN_KEY = 'authToken';
export const SESSION_EXPIRED = 'auth:expired';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

// fetch with "Authorization: Bearer <token>" added. A 401 (expired token, deactivated
// account) ends the session.
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new Error('Serveur injoignable, vérifiez votre connexion');
  }
  if (res.status === 401 && !url.endsWith('/login')) window.dispatchEvent(new Event(SESSION_EXPIRED));
  return res;
}

// fetch does NOT fail on 400/403/409: without this check a refused save looks successful.
// Throws the server's French message on any non-2xx response; call it after EVERY request.
export async function ensureOk(res: Response, fallback: string): Promise<Response> {
  if (res.ok) return res;
  let message = fallback;
  try {
    const body = await res.clone().json();
    if (body?.message) message = body.message;
  } catch {
    // not JSON: keep the fallback
  }
  throw new Error(message);
}

// GET/POST/PUT/DELETE a JSON endpoint and return its `data`.
export async function api<T>(path: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await ensureOk(await authFetch(`${API_BASE_URL}${path}`, { ...init, headers }), fallback);
  return (await res.json()).data as T;
}

export const jsonBody = (data: unknown) => JSON.stringify(data);
