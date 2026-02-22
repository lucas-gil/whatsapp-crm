"use client";

import React from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import AuthGate from './AuthGate';

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
