"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginOverlay from './LoginOverlay';

export default function AuthGate() {
  const { token, loading, error, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Forçar abertura do modal assim que inicializar (independente de token)
    if (!loading) setOpen(true);

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
