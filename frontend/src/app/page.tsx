'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, workspaceSlug: 'default' }),
        }
      );

      if (!response.ok) {
        throw new Error('Chave inválida ou expirada');
      }

      const data = await response.json();
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('workspaceId', data.workspaceId);
      localStorage.setItem('isAdmin', data.isAdmin);

      toast.success('Login realizado com sucesso!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-whatsapp to-whatsapp-dark">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-whatsapp">WhatsApp CRM</h1>
          <p className="text-gray-500 mt-2">Conecte via chave de acesso</p>
        </div>

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
