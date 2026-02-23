"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function BillingClientsPage() {
  const { fetchWithAuth, loading: authLoading, token } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase ? apiBase.replace(/\/$/, '') : typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3000';

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !token) return;
    (async () => {
      try {
        const meRes = await fetchWithAuth(`${api}/auth/me`);
        if (!meRes.ok) return;
        const me = await meRes.json();
        setWorkspaceId(me?.workspaceId || null);
      } catch (err) {
        console.error('Erro ao obter workspace', err);
      }
    })();
  }, [authLoading, token]);

  const loadContacts = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetchWithAuth(`${api}/whatsapp/contacts`);
      if (!res.ok) {
        setMsg('Erro ao buscar contatos (verifique conexão).');
        setContacts([]);
        return;
      }
      const data = await res.json();
      setContacts(data || []);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const syncContacts = async () => {
    setLoading(true);
    setMsg('Sincronizando contatos...');
    try {
      const res = await fetchWithAuth(`${api}/whatsapp/sync-contacts`, { method: 'POST' });
      if (!res.ok) {
        setMsg('Falha ao sincronizar.');
        return;
      }
      setMsg('Sincronização iniciada. Carregue contatos novamente.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao sincronizar contatos');
    } finally {
      setLoading(false);
    }
  };

  const createClientAndCharge = async (contact: any, amount: number, dueDate: string, description?: string) => {
    setMsg('Criando cliente e cobrança...');
    try {
      // criar cliente
      const clientRes = await fetchWithAuth(`${api}/billing/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: contact.name || contact.phoneNumber, phoneNumber: contact.phoneNumber, email: contact.email || null }),
      });
      if (!clientRes.ok) {
        const txt = await clientRes.text();
        setMsg(`Erro ao criar cliente: ${txt}`);
        return;
      }
      const client = await clientRes.json();

      // criar cobrança
      const chargeRes = await fetchWithAuth(`${api}/billing/clients/${client.id}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, description: description || 'Cobrança via WhatsApp', amount, dueDate }),
      });
      if (!chargeRes.ok) {
        const txt = await chargeRes.text();
        setMsg(`Cliente criado, mas erro ao criar cobrança: ${txt}`);
        return;
      }
      setMsg('Cliente e cobrança criados com sucesso');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao criar cliente/cobrança');
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-gray-600 mt-2">Gerencie clientes e crie cobranças a partir dos contatos do WhatsApp.</p>

        <div className="mt-6 flex gap-2">
          <button onClick={loadContacts} className="px-4 py-2 bg-whatsapp text-white rounded">Carregar contatos WhatsApp</button>
          <button onClick={syncContacts} className="px-4 py-2 bg-gray-200 rounded">Sincronizar contatos</button>
        </div>

        {msg && <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">{msg}</div>}

        <div className="mt-6 space-y-4">
          {loading && <p>Carregando...</p>}

          {contacts.map((c) => (
            <ContactRow key={c.phoneNumber || c.jid || c.id} contact={c} onCreate={createClientAndCharge} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactRow({ contact, onCreate }: { contact: any; onCreate: (contact: any, amount: number, dueDate: string, description?: string) => void }) {
  const [amount, setAmount] = useState<number | ''>('' as any);
  const [dueDate, setDueDate] = useState<string>('');
  const [desc, setDesc] = useState<string>('');

  return (
    <div className="bg-white p-4 rounded shadow flex items-start gap-4">
      <div className="flex-1">
        <div className="font-semibold">{contact.name || contact.pushname || contact.jid || contact.phoneNumber}</div>
        <div className="text-sm text-gray-500">{contact.phoneNumber || contact.jid}</div>
        <div className="mt-2 flex gap-2">
          <input type="date" className="border p-1 rounded" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <input type="number" className="border p-1 rounded w-32" placeholder="Valor (R$)" value={amount as any} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
          <input type="text" className="border p-1 rounded flex-1" placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div>
        <button disabled={!dueDate || !amount} onClick={() => onCreate(contact, Number(amount), dueDate, desc)} className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50">Criar cobrança</button>
      </div>
    </div>
  );
}
