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
        // Force a re-login: clear server/client auth and open modal
        (async () => {
          try {
            await logout();
          } catch (e) {}
          setOpen(true);
          params.delete('forceLogin');
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, document.title, newUrl);
        })();
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


  // token exists: render children and floating buttons
  return (
    <>
      {children}
      {/* Botão para abrir tela de login */}
      <button
        id="open-login-btn"
        onClick={() => setOpen(true)}
        title="Abrir tela de login"
        style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2147483647 }}
        className="bg-whatsapp text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform"
      >
        <span style={{ fontSize: 18, lineHeight: '18px' }}>🔐</span>
      </button>

      {/* Botão de reset de login */}
      <button
        id="reset-login-btn"
        onClick={async () => {
          try {
            const authToken = localStorage.getItem('authToken');
            const adminMode = localStorage.getItem('auth_admin_mode');
            localStorage.clear();
            if (authToken) localStorage.setItem('authToken', authToken);
            if (adminMode) localStorage.setItem('auth_admin_mode', adminMode);
            if (authToken) {
              await fetch('/api/billing/clients/delete-all', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
              });
            }
          } catch (e) {}
          window.location.reload();
        }}
        title="Limpar todos os dados do workspace"
        style={{ position: 'fixed', right: 18, bottom: 80, zIndex: 2147483647 }}
        className="bg-red-600 text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform"
      >
        <span style={{ fontSize: 18, lineHeight: '18px' }}>♻️</span>
      </button>

      {/* Botão para limpar dados antigos (vencidos) */}
      <button
        id="delete-old-btn"
        onClick={async () => {
          try {
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
              await fetch('/api/billing/clients/delete-old', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
              });
            }
          } catch (e) {}
          window.location.reload();
        }}
        title="Limpar dados antigos (vencidos) do workspace"
        style={{ position: 'fixed', right: 18, bottom: 140, zIndex: 2147483647 }}
        className="bg-yellow-600 text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform"
      >
        <span style={{ fontSize: 18, lineHeight: '18px' }}>🗑️</span>
      </button>

      {open && (
        <LoginOverlay onLogin={login} onLogout={logout} onClose={() => setOpen(false)} error={error} />
      )}
    </>
  );
}
