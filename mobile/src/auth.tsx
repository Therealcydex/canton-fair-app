import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL, SESSION_EXPIRED, authFetch, ensureOk, jsonBody, setToken } from './config/api';
import type { User } from './types';
import { AuthContext } from './authContext';

const USER_KEY = 'authUser';

const readUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await ensureOk(
      await authFetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody({ username, password }),
      }),
      'Connexion impossible'
    );
    const data = await res.json();
    setToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, logout);
    return () => window.removeEventListener(SESSION_EXPIRED, logout);
  }, [logout]);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
