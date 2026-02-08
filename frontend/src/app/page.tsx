'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona direto para o dashboard sem autenticação
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-whatsapp">WhatsApp CRM</h1>
        <p className="text-gray-500 mt-2">Carregando...</p>
      </div>
    </div>
  );
}
