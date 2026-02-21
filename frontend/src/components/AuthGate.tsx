"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginOverlay from './LoginOverlay';

export default function AuthGate() {
  const { token, loading, error, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const initializedRef = useRef(false);

  useEffect(() => {
    // Abrir o modal apenas na primeira vez que o carregamento inicial terminar.
    // Isso evita que o modal seja reaberto automaticamente após um login/logout
    // que altera o estado `loading`.
    if (!initializedRef.current && !loading) {
      setOpen(true);
      initializedRef.current = true;
    }

    // Se a URL contém ?forceLogin=1, garantir abertura do modal e limpar o param
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('forceLogin') === '1') {
        setOpen(true);
        params.delete('forceLogin');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (e) {
      // ignore
    }
  }, [loading]);

  // Wrap global fetch to avoid making unauthenticated API calls while no token
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__auth_fetch_wrapped) return;

    const originalFetch = window.fetch.bind(window);

    (window as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        // Only intercept internal API calls
        const isApi = url.startsWith('/api') || url.includes('/api/');
        if (isApi) {
          const token = localStorage.getItem('authToken');
          if (!token) {
            // Return a fake 401 Response to avoid real network request and 500s
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }
          // inject Authorization header if not present
          init = init || {};
          init.headers = Object.assign({}, init.headers || {}, { Authorization: `Bearer ${token}` });
        }
        return originalFetch(input, init);
      } catch (err) {
        return originalFetch(input, init);
      }
    };

    (window as any).__auth_fetch_wrapped = true;
    return () => {
      // restore original if needed
      if ((window as any).__auth_fetch_wrapped) {
        try {
          // can't easily restore original without storing; leave wrapped for app lifetime
        } catch (e) {}
      }
    };
  }, []);

  if (loading) return null;

  return (
    <>
      {open && (
        <LoginOverlay
          onLogin={login}
          onLogout={logout}
          onClose={() => setOpen(false)}
          error={error}
        />
      )}

      {/* Prominent floating button to open login modal (to switch account) */}
      <button
        id="open-login-btn"
        onClick={() => setOpen(true)}
        title="Abrir tela de login"
        style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2147483647 }}
        className="bg-whatsapp text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform"
      >
        <span style={{ fontSize: 18, lineHeight: '18px' }}>🔐</span>
      </button>
    </>
  );
}
