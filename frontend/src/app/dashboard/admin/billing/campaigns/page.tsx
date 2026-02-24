'use client';
import { useEffect, useState } from 'react';

export default function BillingCampaignsPage() {
  const [charges, setCharges] = useState<any[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState<string>('');

  useEffect(() => {
    // Buscar todas as cobranças e status dos contatos
    fetch('/api/billing/charges?workspaceId=demo')
      .then(res => res.json())
      .then(data => setCharges(data.charges || []));
  }, []);

  // Função para agendar mensagem
  function scheduleMessage(type: string, days: number, message: string) {
    setScheduledMessages([...scheduledMessages, { type, days, message }]);
  }

  function removeMessage(idx: number) {
    setScheduledMessages(scheduledMessages.filter((_, i) => i !== idx));
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditMessage(scheduledMessages[idx].message);
  }

  function saveEdit(idx: number) {
    const updated = [...scheduledMessages];
    updated[idx].message = editMessage;
    setScheduledMessages(updated);
    setEditingIdx(null);
    setEditMessage('');
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <p className="text-gray-600 mt-2">Envio programado de mensagens de cobrança para contatos, com múltiplos tipos e datas.</p>

        <div className="bg-white rounded shadow p-6 mt-6">
          <h2 className="font-semibold mb-2">Agendar Mensagem</h2>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>scheduleMessage('antes', 3, 'Sua cobrança vence em breve!')}>Antes do vencimento (3 dias)</button>
            <button onClick={()=>scheduleMessage('no_dia', 0, 'Hoje é o dia do vencimento!')}>No dia do vencimento</button>
            <button onClick={()=>scheduleMessage('depois', 2, 'Sua cobrança está vencida!')}>Depois do vencimento (2 dias)</button>
            <button onClick={()=>scheduleMessage('custom', 7, 'Mensagem customizada para 7 dias após vencimento')}>Customizado (7 dias após)</button>
          </div>
          <div>
            <h3 className="font-bold mb-2">Mensagens agendadas:</h3>
            <ul>
              {scheduledMessages.length === 0 && (
                <li className="text-gray-400">Nenhuma mensagem agendada ainda.</li>
              )}
              {scheduledMessages.map((msg, idx) => (
                <li key={idx} className="mb-2 flex items-center gap-2 bg-gray-50 rounded p-2">
                  <span className="font-semibold text-blue-700">{msg.type}</span>
                  <span className="text-xs text-gray-500">{msg.days} dias</span>
                  {editingIdx === idx ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 text-sm flex-1"
                        value={editMessage}
                        onChange={e => setEditMessage(e.target.value)}
                        autoFocus
                      />
                      <button className="text-green-600 font-bold ml-2" onClick={()=>saveEdit(idx)}>Salvar</button>
                      <button className="text-gray-500 ml-1" onClick={()=>setEditingIdx(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="ml-2 flex-1">{msg.message}</span>
                      <button className="text-yellow-600 font-bold ml-2" onClick={()=>startEdit(idx)}>Editar</button>
                      <button className="text-red-600 font-bold ml-1" onClick={()=>removeMessage(idx)}>Remover</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-semibold mb-2">Status dos contatos/cobranças</h2>
          <table className="w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.client?.name || '-'}</td>
                  <td>R$ {Number(c.amount).toFixed(2)}</td>
                  <td>{c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '-'}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
