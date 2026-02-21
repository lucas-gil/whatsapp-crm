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
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<string>('2592000'); // padrão 30 dias
  const [optionsText, setOptionsText] = useState<string>('{}');

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

      // onLogin agora retorna os dados do servidor (incluindo isAdmin)
      const data: any = await onLogin(key.trim());

      if (data?.isAdmin) {
        // permanecer no modal e mostrar opções de admin para gerar senhas
        setIsAdminMode(true);
        return;
      }

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

            {/* Admin mode: mostrar gerador de senhas */}
            {isAdminMode && (
              <div className="mb-4 border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Modo Admin — Gerar nova senha</h3>
                <label className="block text-sm text-gray-600 mb-1">Duração (segundos)</label>
                <input
                  className="w-full border rounded px-3 py-2 mb-2"
                  value={ttlSeconds}
                  onChange={(e) => setTtlSeconds(e.target.value)}
                  placeholder="Tempo de vida em segundos (ex: 3600)"
                />

                <label className="block text-sm text-gray-600 mb-1">Opções (JSON)</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mb-2"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={4}
                />

                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      setLocalError(null);
                      setGeneratedKey(null);
                      try {
                        const token = localStorage.getItem('authToken');
                        if (!token) throw new Error('Token não encontrado');

                        let parsedOptions = {};
                        try {
                          parsedOptions = JSON.parse(optionsText || '{}');
                        } catch (e) {
                          throw new Error('Opções inválidas: JSON malformado');
                        }

                        const payload: any = {
                          type: 'TEMPORARY_30DAYS',
                          ttlSeconds: Number(ttlSeconds) || undefined,
                          options: parsedOptions,
                        };

                        const res = await fetch('/api/licenses', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify(payload),
                        });

                        if (!res.ok) {
                          const txt = await res.text();
                          throw new Error(txt || 'Falha ao criar chave');
                        }

                        const data = await res.json();
                        setGeneratedKey(data.key);
                      } catch (err: any) {
                        setLocalError(err?.message || 'Erro ao gerar chave');
                      }
                    }}
                    className="bg-whatsapp text-white px-3 py-2 rounded"
                  >
                    Gerar senha
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // finalizar modo admin e fechar modal
                      setIsAdminMode(false);
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
