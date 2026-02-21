"use client";

import { useState } from 'react';

type Props = {
  onLogin: (key: string, workspace?: string) => Promise<void>;
  error?: string | null;
};

export default function LoginOverlay({ onLogin, error }: Props) {
  const [key, setKey] = useState('');
  const [workspace, setWorkspace] = useState('default');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(key.trim(), workspace.trim() || 'default');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Acesso ao sistema</h2>

        <label className="block text-sm text-gray-600">Chave de Acesso</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Digite a chave (ex: lucas9580)"
          autoFocus
        />

        <label className="block text-sm text-gray-600">Workspace (opcional)</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
        />

        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-whatsapp text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={loading || key.trim().length === 0}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
