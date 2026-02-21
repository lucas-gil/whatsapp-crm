"use client";

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Props = {
  onLogin: (key: string) => Promise<any>;
  onLogout?: () => void;
  onClose?: () => void;
  error?: string | null;
};

export default function LoginOverlay(props: Props) {
  const { onLogin, onLogout, onClose, error } = props;
  const { fetchWithAuth, isAdmin, token } = useAuth();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<string>('2592000');
  const [optionsText, setOptionsText] = useState<string>('{}');

  const submit = async (e: any) => {
    e.preventDefault();
    setLocalError(null);
    if (String(key || '').trim().length === 0) {
      setLocalError('Você deve informar a chave de acesso');
      return;
    }

    setLoading(true);
    try {
      const data: any = await onLogin(String(key).trim());
      if (data?.isAdmin) {
        setIsAdminMode(true);
        try { localStorage.setItem('auth_admin_mode', '1'); } catch (e) {}
        return;
      }
      onClose && onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      onLogout && onLogout();
      localStorage.removeItem('authToken');
      try { localStorage.removeItem('auth_admin_mode'); } catch (e) {}
    } catch (e) {}
  };

  const generateKey = async () => {
    setLocalError(null);
    setGeneratedKey(null);

    // Garantir que o usuário atual seja admin e que exista um token salvo
    if (!token || !isAdmin) {
      setLocalError('Você precisa estar logado como admin para gerar senhas');
      return;
    }
    try {
      let parsedOptions: any = {};
      const raw = String(optionsText || '').trim();
      let durationOverride: number | undefined = undefined;

      if (raw.length > 0) {
        try {
          parsedOptions = JSON.parse(raw);
        } catch (e) {
          const asNum = Number(raw);
          if (!Number.isNaN(asNum)) {
            durationOverride = asNum;
          } else {
            const m = raw.match(/-?\d+/);
            if (m) durationOverride = Number(m[0]);
            else throw new Error('Opções inválidas: JSON malformado ou valor não numérico');
          }
        }
      }

      const payload: any = {
        type: 'TEMPORARY_30DAYS',
        ttlSeconds: Number(ttlSeconds) || undefined,
        options: parsedOptions,
      };

      if (durationOverride !== undefined) payload.ttlSeconds = Number(durationOverride);

      const res = await fetchWithAuth('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let txt = await res.text();
        try {
          const parsed = JSON.parse(txt);
          txt = parsed?.message || parsed?.error || txt;
        } catch (e) {}
        if (res.status === 403) {
          setLocalError(txt || 'Sem permissão para criar chaves');
          return;
        }
        throw new Error(txt || 'Falha ao criar chave');
      }

      const data = await res.json();
      setGeneratedKey(data.key);
    } catch (err: any) {
      setLocalError(err?.message || 'Erro ao gerar chave');
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
                onChange={(e) => setKey(String(e.target.value))}
                placeholder="Digite a chave de acesso"
                autoFocus
                autoComplete="current-password"
              />
            </div>
          </div>

          {isAdminMode && (
            <div className="mb-4 border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Modo Admin — Gerar nova senha</h3>
              <label className="block text-sm text-gray-600 mb-1">Duração (segundos)</label>
              <input
                className="w-full border rounded px-3 py-2 mb-2"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(String(e.target.value))}
                placeholder="Tempo de vida em segundos (ex: 3600)"
              />

              <label className="block text-sm text-gray-600 mb-1">Opções (JSON)</label>
              <textarea
                className="w-full border rounded px-3 py-2 mb-2"
                value={optionsText}
                onChange={(e) => setOptionsText(String(e.target.value))}
                rows={4}
              />

              <div className="flex gap-2 items-center">
                <button type="button" onClick={generateKey} className="bg-whatsapp text-white px-3 py-2 rounded">
                  Gerar senha
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAdminMode(false);
                    try { localStorage.removeItem('auth_admin_mode'); } catch (e) {}
                    onClose && onClose();
                  }}
                  className="px-3 py-2 rounded border"
                >
                  Continuar para o sistema
                </button>
              </div>

              {generatedKey && (
                <div className="mt-3 p-2 border rounded bg-gray-50 text-sm break-words">
                  <div className="font-semibold">Senha gerada (copie e salve agora)</div>
                  <div className="mt-1 text-green-700">{generatedKey}</div>
                </div>
              )}
            </div>
          )}

          {(localError || error) && <div className="mb-3 text-sm text-red-600 break-words">{localError || error}</div>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="submit" className="bg-whatsapp text-white px-4 py-2 rounded disabled:opacity-50" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button type="button" onClick={handleLogout} className="text-sm text-gray-600 hover:underline">
                Limpar sessão
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Protegido</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
