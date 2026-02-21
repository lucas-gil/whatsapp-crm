"use client";

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginOverlay from './LoginOverlay';

export default function AuthGate() {
  const { token, loading, error, login } = useAuth();

  // Enquanto carrega, não mostrar nada para evitar flicker
  if (loading) return null;

  // Se não há token, mostrar overlay de login
  if (!token) {
    return <LoginOverlay onLogin={login} error={error} />;
  }

  return null;
}
