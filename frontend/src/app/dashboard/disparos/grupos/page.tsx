'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Group = {
  id: string;
  name: string;
  participantCount: number;
};

export default function DisparoGruposPage() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase
    ? apiBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3000';

  useEffect(() => {
    if (!token) return;

    const fetchGroups = async () => {
      try {
        const response = await fetch(`${api}/whatsapp/groups`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar grupos');
        }

        const data = await response.json();
        setGroups(Array.isArray(data) ? data : []);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Erro ao buscar grupos');
      }
    };

    fetchGroups();
  }, [api, token]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(term));
  }, [groups, search]);

  const selectedGroups = useMemo(() => {
    return groups.filter((group) => selected[group.id]);
  }, [groups, selected]);

  const toggleSelected = (groupId: string) => {
    setSelected((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleSend = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    if (!selectedGroups.length) {
      setStatus('Selecione pelo menos um grupo');
      return;
    }

    if (!message && !file) {
      setStatus('Informe um texto ou selecione uma midia');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      for (const group of selectedGroups) {
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('to', group.id);
          if (message) {
            formData.append('caption', message);
          }

          const response = await fetch(`${api}/whatsapp/send-media`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Falha ao enviar midia');
          }
        } else {
          const response = await fetch(`${api}/whatsapp/send-text`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: group.id,
              text: message,
            }),
          });

          if (!response.ok) {
            throw new Error('Falha ao enviar mensagem');
          }
        }
      }

      setStatus(`Envio concluido: ${selectedGroups.length} grupo(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Envio para Grupos</h1>
          <Link
            href="/dashboard/disparos"
            className="text-sm text-whatsapp hover:text-whatsapp-dark"
          >
            Voltar para Disparos
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar grupo
              </label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite o nome do grupo"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded max-h-80 overflow-auto">
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Nenhum grupo encontrado.</div>
              ) : (
                filteredGroups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[group.id]}
                      onChange={() => toggleSelected(group.id)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500">
                        {group.participantCount} participantes
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Digite a mensagem"
                rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Midia (opcional)
              </label>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block text-sm text-gray-600"
              />
              {file && (
                <p className="text-xs text-gray-500 mt-2">Arquivo: {file.name}</p>
              )}
            </div>

            <div className="mb-4 text-sm text-gray-600">
              Selecionados: {selectedGroups.length}
            </div>

            {status && (
              <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
                {status}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full py-3 px-4 bg-whatsapp text-white rounded hover:bg-whatsapp-dark disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar agora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
