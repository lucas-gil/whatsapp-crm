'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Lead = { id: string; name: string; phoneNumber?: string | null; avatarUrl?: string | null };
type ChatMessage = { id: string; text: string; from: 'me' | 'lead'; createdAt: string };

export default function LeadsPage() {
  const { token } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase ? apiBase.replace(/\/$/, '') : (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3000');

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [conversationsCache, setConversationsCache] = useState<Record<string, any>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${api}/crm/leads?page=${Math.max(0, page-1)}&limit=${perPage}${search?`&search=${encodeURIComponent(search)}`:''}`, { headers });
        if (!res.ok) throw new Error('Falha ao carregar leads');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const mapped = list.map((l: any) => ({ id: l.id, name: l.name || l.phoneNumber || 'Sem nome', phoneNumber: l.phoneNumber, avatarUrl: l.avatarUrl }));
        setLeads(mapped);
        prefetchConversations(mapped.map(m => m.id));
      } catch (err) {
        // ignore for now
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, token, page, perPage, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => !q || l.name.toLowerCase().includes(q) || (l.phoneNumber||'').includes(q));
  }, [leads, search]);

  const paged = useMemo(() => filtered.slice((page-1)*perPage, page*perPage), [filtered, page]);

  const openLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setMessages([]);
    setConversationId(null);
    const cached = conversationsCache[lead.id];
    if (cached) {
      setConversationId(cached.id || null);
      const msgs = Array.isArray(cached.messages) ? cached.messages : [];
      setMessages(msgs.map((m: any) => ({ id: m.id, text: m.text || m.lastMessage || '', from: m.direction === 'OUTGOING' ? 'me' : 'lead', createdAt: m.createdAt || m.createdAt })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    try {
      const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
      const convsRes = await fetch(`${api}/crm/conversations?leadId=${lead.id}`, { headers });
      if (convsRes.ok) {
        const convs = await convsRes.json();
        const conv = Array.isArray(convs) && convs[0] ? convs[0] : null;
        if (conv?.id) {
          setConversationId(conv.id);
          const msgRes = await fetch(`${api}/crm/conversations/${conv.id}`, { headers });
          if (msgRes.ok) {
            const data = await msgRes.json();
            const msgs = Array.isArray(data?.messages) ? data.messages : [];
            setMessages(msgs.map((m: any) => ({ id: m.id, text: m.text || m.lastMessage || '', from: m.direction === 'OUTGOING' ? 'me' : 'lead', createdAt: m.createdAt || m.createdAt })));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const prefetchConversations = async (leadIds: string[]) => {
    if (!token || !leadIds?.length) return;
    const headers: Record<string,string> = { Authorization: `Bearer ${token}` };
    for (const id of leadIds) {
      if (conversationsCache[id]) continue;
      (async (leadId) => {
        try {
          await new Promise(r => setTimeout(r, 200));
          const convsRes = await fetch(`${api}/crm/conversations?leadId=${leadId}`, { headers });
          if (!convsRes.ok) return;
          const convs = await convsRes.json();
          const conv = Array.isArray(convs) && convs[0] ? convs[0] : null;
          if (!conv?.id) return;
          const msgRes = await fetch(`${api}/crm/conversations/${conv.id}`, { headers });
          if (!msgRes.ok) return;
          const data = await msgRes.json();
          setConversationsCache(prev => ({ ...prev, [leadId]: { id: conv.id, messages: Array.isArray(data?.messages) ? data.messages : [] } }));
        } catch (err) {
          // ignore individual prefetch errors
        }
      })(id);
    }
  };

  const sendMessage = async () => {
    if (!selectedLead || !messageText.trim()) return;
    setSending(true);
    try {
      const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const body = JSON.stringify({ to: selectedLead.phoneNumber, text: messageText });
      const res = await fetch(`${api}/whatsapp/send-text`, { method: 'POST', headers, body });
      if (!res.ok) throw new Error('Falha ao enviar mensagem');
      const resp = await res.json();
      const now = new Date().toISOString();
      setMessages(prev => [...prev, { id: resp.messageId || `local-${now}`, text: messageText, from: 'me', createdAt: now }]);
      setMessageText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err:any) {
      alert(err?.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="leads-ui mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="w-80">
          <input value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} placeholder="Buscar por nome ou telefone" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded shadow p-4">
          <div className="text-sm text-slate-500 mb-2">Contatos ({filtered.length})</div>
          <div className="divide-y">
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500">Carregando...</div>
            ) : paged.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Nenhum contato</div>
            ) : (
              paged.map(lead => (
                <button key={lead.id} onClick={()=>openLead(lead)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-slate-50 px-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm text-slate-600">{(lead.name||'')[0]}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{lead.name}</div>
                    <div className="text-xs text-slate-400">{lead.phoneNumber || '—'}</div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-slate-500">Página {page}</div>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50">◀</button>
              <button disabled={(page*perPage)>=filtered.length} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50">▶</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded shadow p-4 flex flex-col">
          {!selectedLead ? (
            <div className="h-64 flex items-center justify-center text-slate-500">Selecione um lead para ver a conversa</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <div>
                  <div className="font-semibold">{selectedLead.name}</div>
                  <div className="text-xs text-slate-400">{selectedLead.phoneNumber}</div>
                </div>
                <div className="text-xs text-slate-400">{conversationId ? `Conv: ${conversationId}` : 'Sem conversa'}</div>
              </div>

              <div className="flex-1 overflow-auto" style={{ maxHeight: '56vh' }}>
                <div className="space-y-3 px-2">
                  {messages.map(m => (
                    <div key={m.id} className={`max-w-[70%] ${m.from==='me'?'ml-auto text-right':'text-left'}`}>
                      <div className={`${m.from==='me'?'bg-green-50 text-slate-900':'bg-slate-100 text-slate-900'} inline-block rounded-md px-3 py-2 text-sm`}>{m.text}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="flex gap-2">
                  <input value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="Digite sua mensagem" className="flex-1 border rounded px-3 py-2 text-sm" />
                  <button onClick={sendMessage} disabled={sending} className="px-4 py-2 bg-whatsapp text-white rounded disabled:opacity-60">{sending ? 'Enviando...' : 'Enviar'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
