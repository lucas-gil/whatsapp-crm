'use client';
import { useEffect, useState } from 'react';

export default function BillingInboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  useEffect(() => {
    // Buscar conversas dos clientes (simulação)
    fetch('/api/billing/conversations?workspaceId=demo')
      .then(res => res.json())
      .then(data => setConversations(data.conversations || []));
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Caixa de entrada</h1>
        <p className="text-gray-600 mt-2">Veja as respostas dos clientes agrupadas por contato, igual a um email, mas para WhatsApp.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-semibold mb-2">Contatos</h2>
            <ul>
              {conversations.map((conv, idx) => (
                <li key={idx} className={selectedClient === conv.client?.id ? 'font-bold' : ''}>
                  <button onClick={()=>setSelectedClient(conv.client?.id)}>{conv.client?.name || '-'}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded shadow p-4 col-span-2">
            <h2 className="font-semibold mb-2">Mensagens</h2>
            {selectedClient ? (
              <ul>
                {conversations.find((c: any) => c.client?.id === selectedClient)?.messages?.map((msg: any, idx: number) => (
                  <li key={idx} className="mb-2">
                    <span className="block text-xs text-gray-400">{msg.date ? new Date(msg.date).toLocaleString() : '-'}</span>
                    <span className="block text-sm">{msg.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Selecione um contato para ver as mensagens.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
