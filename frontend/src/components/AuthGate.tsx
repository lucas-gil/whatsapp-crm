"use client";

import React, { useState, useEffect, useRef, PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginOverlay from './LoginOverlay';

export default function AuthGate({ children }: PropsWithChildren) {
  const { token, ready, loading, needsLogin, error, login, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const initializedRef = useRef(false);

  useEffect(() => {
    // Abrir o modal apenas na primeira vez que o carregamento inicial terminar.
    if (!initializedRef.current && ready) {
      // open only if no token or backend indicated needsLogin
      if (!token || needsLogin) setOpen(true);
      initializedRef.current = true;
    }

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
  }, [ready]);

  // If token just appeared, close login modal unless admin mode is active
  useEffect(() => {
    if (token) {
      // close modal after login unless user is admin
      if (!isAdmin) setOpen(false);
    }
  }, [token, isAdmin]);

  // If backend indicates we need login (token expired), open modal
  useEffect(() => {
    if (needsLogin) setOpen(true);
  }, [needsLogin]);

  // If initial auth check not finished, render nothing to avoid FOUC
  if (!ready) return null;

  // If no token, block rendering children and show modal
  if (!token) {
    return (
      <>
        {open && (
          <LoginOverlay onLogin={login} onLogout={logout} onClose={() => {}} error={error} />
        )}
      </>
    );
  }


  // token exists: render children and a floating button to re-open login modal
  return (
    <>
      {children}
      <button
        id="open-login-btn"
        onClick={() => setOpen(true)}
        title="Abrir tela de login"
        style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2147483647 }}
        className="bg-whatsapp text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform"
      >
        <span style={{ fontSize: 18, lineHeight: '18px' }}>🔐</span>
      </button>
      {open && (
        <LoginOverlay onLogin={login} onLogout={logout} onClose={() => setOpen(false)} error={error} />
      )}
    </>
  );
}
