"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type LoginResponse = { accessToken: string; isAdmin?: boolean } & Record<string, any>;

type AuthContextType = {
  token: string | null;
  isAdmin: boolean;
  loading: boolean;
  ready: boolean; // initial check done
  error: string | null;
  login: (key: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getApiBase() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  let api = apiBase ? apiBase.replace(/\/$/, '') : '/api';

  if (typeof window !== 'undefined' && apiBase) {
    try {
      const apiUrl = new URL(apiBase, window.location.origin);
      if (apiUrl.host !== window.location.host || apiUrl.hostname === 'localhost') {
        api = '/api';
      }
    } catch (err) {
      api = '/api';
    }
  }

  return api;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const currentBuild =
          process.env.NEXT_PUBLIC_APP_BUILD ||
          process.env.NEXT_PUBLIC_GIT_SHA ||
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          process.env.NEXT_PUBLIC_APP_NAME ||
          'dev';

        const saved = localStorage.getItem('app_build');
        if (saved && saved !== currentBuild) {
          // app was updated — force re-login
          try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('auth_admin_mode');
          } catch (e) {}
        }
        try {
          localStorage.setItem('app_build', String(currentBuild));
        } catch (e) {}
      } catch (e) {
        // ignore if localStorage not available
      }

      try {
        const stored = localStorage.getItem('authToken');
        if (stored) {
          const api = getApiBase();
          const res = await fetch(`${api}/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (!mounted) return;
            setToken(stored);
            setIsAdmin(Boolean(data?.isAdmin));
          } else {
            localStorage.removeItem('authToken');
            setToken(null);
            setIsAdmin(false);
          }
        }
      } catch (err) {
        // ignore network errors here — user will login manually
        // eslint-disable-next-line no-console
        console.debug('Auth init error', err);
      } finally {
        if (!mounted) return;
        setLoading(false);
        setReady(true);
      }
    };

    init();

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'authToken') {
        setToken(ev.newValue);
      }
      if (ev.key === 'auth_admin_mode' && ev.newValue == null) {
        // admin mode cleared
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mounted = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const api = getApiBase();
      const res = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        let txt = await res.text();
        try {
          const parsed = JSON.parse(txt);
          txt = parsed?.message || parsed?.error || txt;
        } catch (e) {}
        throw new Error(txt || `Login failed (${res.status})`);
      }
      const data = await res.json();
      const newToken = data.accessToken;
      localStorage.setItem('authToken', newToken);
      setToken(newToken);
      setIsAdmin(Boolean(data.isAdmin));
      return data as LoginResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
      setReady(true);
    }
  };

  const logout = async () => {
    try {
      const api = getApiBase();
      const stored = localStorage.getItem('authToken');
      if (stored) {
        await fetch(`${api}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${stored}` } });
      }
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_admin_mode');
    setToken(null);
    setIsAdmin(false);
  };

  const fetchWithAuth = async (input: RequestInfo, init?: RequestInit) => {
    const stored = localStorage.getItem('authToken');
    if (!stored) throw new Error('Not authenticated');
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', `Bearer ${stored}`);
    return fetch(input, { ...init, headers });
  };

  const value = useMemo(
    () => ({ token, isAdmin, loading, ready, error, login, logout, fetchWithAuth }),
    [token, isAdmin, loading, ready, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
