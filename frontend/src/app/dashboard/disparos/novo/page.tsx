'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Contact = {
  id: string;
  name: string;
  phoneNumber: string;
};

export default function DisparoNovoPage() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
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

    const fetchContacts = async () => {
      try {
        const response = await fetch(`${api}/whatsapp/contacts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar contatos');
        }

        const data = await response.json();
        setContacts(Array.isArray(data) ? data : []);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Erro ao buscar contatos');
      }
    };

    fetchContacts();
  }, [api, token]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(term) ||
        contact.phoneNumber.includes(term)
      );
    });
  }, [contacts, search]);

  const selectedContacts = useMemo(() => {
    return contacts.filter((contact) => selected[contact.id]);
  }, [contacts, selected]);

  const toggleSelected = (contactId: string) => {
    setSelected((prev) => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };

  const handleSend = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    if (!selectedContacts.length) {
      setStatus('Selecione pelo menos um contato');
      return;
    }

    if (!message && !file) {
      setStatus('Informe um texto ou selecione uma midia');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      for (const contact of selectedContacts) {
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('to', contact.phoneNumber);
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
              to: contact.phoneNumber,
              text: message,
            }),
          });

          if (!response.ok) {
            throw new Error('Falha ao enviar mensagem');
          }
        }
      }

      setStatus(`Envio concluido: ${selectedContacts.length} contato(s)`);
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
          <h1 className="text-3xl font-bold text-gray-900">Envio 1:1</h1>
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
                Buscar contato
              </label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite nome ou numero"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded max-h-80 overflow-auto">
              {filteredContacts.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  Nenhum contato encontrado.
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[contact.id]}
                      onChange={() => toggleSelected(contact.id)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.phoneNumber}</p>
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
              Selecionados: {selectedContacts.length}
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
