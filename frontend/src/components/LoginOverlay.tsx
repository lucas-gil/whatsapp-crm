"use client";

import { useState } from 'react';

type Props = {
  onLogin: (key: string, workspace?: string) => Promise<void>;
  onLogout?: () => void;
  onClose?: () => void;
  error?: string | null;
};

export default function LoginOverlay({ onLogin, onLogout, onClose, error }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  // não mostrar a senha por padrão nem oferecer toggle
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (key.trim().length === 0) {
      setLocalError('Você deve informar a chave de acesso');
      return;
    }

    setLoading(true);
    try {
      // debug: registrar tentativa de login (sem expor chave completa nos logs)
      // útil para diagnóstico no navegador remoto
      // eslint-disable-next-line no-console
      console.debug('LoginOverlay: submit', { keyPreview: key.trim().substring(0, 8) + '...' });
      await onLogin(key.trim());
      onClose && onClose();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao autenticar';
      setLocalError(msg.replace(/\"/g, ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      onLogout && onLogout();
      // garantir também limpeza local
      localStorage.removeItem('authToken');
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Entrar no WhatsApp CRM</h2>
          <p className="text-sm text-gray-500">Digite a chave de acesso para entrar</p>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave de Acesso</label>
            <div className="relative">
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Digite a chave de acesso"
                autoFocus
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Workspace removido temporariamente para compatibilidade com backends antigos */}

          {(localError || error) && (
            <div className="mb-3 text-sm text-red-600 break-words">{localError || error}</div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="bg-whatsapp text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:underline"
              >
                Limpar sessão
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onClose && onClose(); }}
                className="text-sm text-gray-500 hover:underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
