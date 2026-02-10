'use client';

import { useState, useEffect } from 'react';

export default function ConversasPage() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/crm/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      setError('Erro ao carregar conversas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando conversas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Conversas</h1>
        <p className="text-gray-500 mb-8">Todas as suas conversas com clientes</p>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {conversations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma conversa encontrada</p>
          ) : (
            <div className="space-y-4">
              {conversations.map((conv: any) => (
                <div key={conv.id} className="border border-gray-200 rounded p-4 hover:bg-gray-50">
                  <p className="font-semibold text-gray-900">{conv.name || 'Conversa sem nome'}</p>
                  <p className="text-sm text-gray-500">{conv.lastMessage || 'Sem mensagens'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
