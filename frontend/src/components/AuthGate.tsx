"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginOverlay from './LoginOverlay';

export default function AuthGate() {
  const { token, loading, error, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !token) setOpen(true); // abrir automaticamente quando não autenticado

    // Se a URL contém ?forceLogin=1, forçar abertura do modal
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('forceLogin') === '1') {
        setOpen(true);
        // remover o param da URL para não reabrir em reload
        params.delete('forceLogin');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (e) {
      // ignore
    }
  }, [loading, token]);

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

      {/* Floating button to open login modal (to switch account) */}
      <button
        onClick={() => setOpen(true)}
        title="Abrir tela de login"
        className="fixed z-40 right-4 bottom-4 bg-whatsapp text-white p-3 rounded-full shadow-lg hover:scale-105 transition"
      >
        🔐
      </button>
    </>
  );
}
