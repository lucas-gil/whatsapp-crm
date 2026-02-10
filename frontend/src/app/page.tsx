'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona direto para dashboard (sem login)
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-whatsapp to-whatsapp-dark">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">WhatsApp CRM</h1>
        <p className="text-gray-200">Carregando...</p>
      </div>
    </div>
  );
}
