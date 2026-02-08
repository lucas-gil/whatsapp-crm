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

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chave de Acesso
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Cole sua chave de acesso aqui"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp"
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              A chave foi fornecida pelo administrador
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-whatsapp text-white rounded-lg font-medium hover:bg-whatsapp-dark disabled:opacity-50 transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-600">
            💡 <strong>Primeira vez?</strong> Peça uma chave de acesso ao seu administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
