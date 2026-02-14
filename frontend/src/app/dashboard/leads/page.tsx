'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Lead = {
  id: string;
  name: string;
  phoneNumber?: string | null;
  email?: string | null;
  pipelineStage?: string | null;
  optIn?: boolean | null;
  origin?: string | null;
  responsibleUser?: string | null;
  tags?: { tag: { name: string } }[];
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  jid?: string | null;
};

type Group = {
  id: string;
  name: string;
  participantCount: number;
};

type ChatMessage = {
  id: string;
  from: 'lead' | 'me';
  text: string;
  timestamp: string;
};

type ConversationTarget = {
  type: 'contact' | 'group';
  id: string;
  name: string;
  phoneNumber?: string | null;
  jid?: string | null;
};

const stageDefaults = ['Novo', 'Qualificando', 'Proposta', 'Fechado', 'Perdido'];

const stageStyles: Record<string, string> = {
  Novo: 'bg-sky-100 text-sky-700',
  Qualificando: 'bg-amber-100 text-amber-700',
  Proposta: 'bg-violet-100 text-violet-700',
  Fechado: 'bg-emerald-100 text-emerald-700',
  Perdido: 'bg-rose-100 text-rose-700',
};

export default function LeadsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncAttempted, setSyncAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState<'contatos' | 'grupos'>('contatos');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ConversationTarget | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [notesByLead, setNotesByLead] = useState<Record<string, string>>({});
  const [tagsByLead, setTagsByLead] = useState<Record<string, string[]>>({});
  const [pipeline, setPipeline] = useState(stageDefaults);
  const [editPipeline, setEditPipeline] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messagesByTarget, setMessagesByTarget] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const list = await fetchLeads(headers);
      await fetchGroups(headers);

      if (!list.length && !syncAttempted) {
        await syncContacts(true);
      }
    } catch (err) {
      setError('Erro ao carregar leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (headers: Record<string, string>) => {
    const [contactsResponse, leadsResponse] = await Promise.all([
      fetch('/api/whatsapp/contacts', { headers }),
      fetch('/api/crm/leads', { headers }),
    ]);

    if (!contactsResponse.ok) {
      setError('Erro ao carregar contatos do WhatsApp');
      return [] as Lead[];
    }

    const contactsData = await contactsResponse.json();
    const contactsList = Array.isArray(contactsData) ? contactsData : [];

    const leadsData = leadsResponse.ok ? await leadsResponse.json() : [];
    const leadsList = Array.isArray(leadsData) ? leadsData : [];
    const leadsByPhone = new Map<string, Lead>();
    leadsList.forEach((lead: Lead) => {
      if (lead.phoneNumber) {
        leadsByPhone.set(lead.phoneNumber, lead);
      }
    });

    const merged: Lead[] = contactsList.map((contact: any) => {
      const leadMatch = contact.phoneNumber ? leadsByPhone.get(contact.phoneNumber) : undefined;
      return {
        id: leadMatch?.id || contact.id,
        name: leadMatch?.name || contact.name || contact.phoneNumber || 'Contato',
        phoneNumber: leadMatch?.phoneNumber || contact.phoneNumber,
        email: leadMatch?.email || null,
        pipelineStage: leadMatch?.pipelineStage || 'Novo',
        optIn: leadMatch?.optIn ?? true,
        origin: leadMatch?.origin || null,
        responsibleUser: leadMatch?.responsibleUser || null,
        tags: leadMatch?.tags || [],
        jid: contact.jid || contact.id || null,
        lastMessage: leadMatch?.lastMessage || null,
        lastMessageAt: leadMatch?.lastMessageAt || null,
      };
    });

    leadsList.forEach((lead: Lead) => {
      if (!lead.phoneNumber) return;
      if (!merged.some((item) => item.phoneNumber === lead.phoneNumber)) {
        merged.push({ ...lead, pipelineStage: lead.pipelineStage || 'Novo' });
      }
    });

    setLeads(merged);
    if (merged.length) {
      setSelectedLeadId(merged[0].id);
      setSelectedTarget({
        type: 'contact',
        id: merged[0].id,
        name: merged[0].name,
        phoneNumber: merged[0].phoneNumber,
        jid: merged[0].jid,
      });
    }
    return merged as Lead[];
  };

  const fetchGroups = async (headers: Record<string, string>) => {
    const groupsResponse = await fetch('/api/whatsapp/groups', { headers });
    if (!groupsResponse.ok) {
      setError('Erro ao carregar grupos');
      return [] as Group[];
    }

    const data = await groupsResponse.json();
    const list = Array.isArray(data) ? data : [];
    setGroups(list as Group[]);
    return list as Group[];
  };

  const syncContacts = async (silent?: boolean) => {
    if (!token) return;
    setSyncing(true);
    setSyncAttempted(true);

    try {
      const response = await fetch('/api/whatsapp/sync-contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Falha ao sincronizar contatos');
      }

      const data = await response.json();
      if (!silent) {
        setStatus(`Sincronizados: ${data.created || 0} novo(s)`);
      }

      await fetchLeads({ Authorization: `Bearer ${token}` });
    } catch (err) {
      if (!silent) {
        setStatus('Erro ao sincronizar contatos');
      }
    } finally {
      setSyncing(false);
    }
  };

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedTag = tagFilter.trim().toLowerCase();

    return leads.filter((lead) => {
      const stageMatch = stageFilter
        ? (lead.pipelineStage || '').toLowerCase() === stageFilter.toLowerCase()
        : true;
      const searchMatch = normalizedSearch
        ? [lead.name, lead.phoneNumber, lead.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      const leadTags = [
        ...(lead.tags || []).map((item) => item.tag.name),
        ...(tagsByLead[lead.id] || []),
      ].map((tag) => tag.toLowerCase());
      const tagMatch = normalizedTag ? leadTags.some((tag) => tag.includes(normalizedTag)) : true;
      return stageMatch && searchMatch && tagMatch;
    });
  }, [leads, search, stageFilter, tagFilter, tagsByLead]);

  const selectedLead = useMemo(() => {
    if (selectedTarget?.type !== 'contact') return null;
    return leads.find((lead) => lead.id === selectedLeadId) || null;
  }, [leads, selectedLeadId, selectedTarget]);

  const chatMessages = useMemo(() => {
    if (!selectedTarget) return [];
    const key = `${selectedTarget.type}:${selectedTarget.id}`;
    return messagesByTarget[key] || [];
  }, [messagesByTarget, selectedTarget]);

  const stageOptions = useMemo(() => {
    return pipeline.length ? pipeline : stageDefaults;
  }, [pipeline]);

  const handleSendMessage = async () => {
    if (!selectedTarget || !messageInput.trim() || !token) return;
    const text = messageInput.trim();
    const newMessage: ChatMessage = {
      id: `${selectedTarget.id}-${Date.now()}`,
      from: 'me',
      text,
      timestamp: new Date().toISOString(),
    };
    const key = `${selectedTarget.type}:${selectedTarget.id}`;
    setMessagesByTarget((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newMessage],
    }));
    setMessageInput('');

    try {
      const targetValue =
        selectedTarget.type === 'group'
          ? selectedTarget.id
          : selectedTarget.jid || selectedTarget.phoneNumber || selectedTarget.id;
      const response = await fetch('/api/whatsapp/send-text', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: targetValue, text }),
      });

      if (!response.ok) {
        setStatus('Nao foi possivel enviar a mensagem');
      }
    } catch (err) {
      setStatus('Erro ao enviar mensagem');
    }
  };

  const handleAddTag = (value: string) => {
    if (!selectedLead || !value.trim()) return;
    const nextTag = value.trim();
    setTagsByLead((prev) => {
      const existing = prev[selectedLead.id] || [];
      if (existing.includes(nextTag)) return prev;
      return { ...prev, [selectedLead.id]: [...existing, nextTag] };
    });
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedLead) return;
    setTagsByLead((prev) => {
      const existing = prev[selectedLead.id] || [];
      return { ...prev, [selectedLead.id]: existing.filter((item) => item !== tag) };
    });
  };

  const handlePipelineRename = (index: number, value: string) => {
    setPipeline((prev) => prev.map((stage, idx) => (idx === index ? value : stage)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Carregando leads...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap');
        .leads-ui { font-family: 'Manrope', sans-serif; }
        .leads-ui-display { font-family: 'Sora', sans-serif; }
        .wa-chat-bg {
          background-image: radial-gradient(circle at 1px 1px, rgba(134, 150, 160, 0.18) 1px, transparent 0);
          background-size: 24px 24px;
        }
      `}</style>

      <div className="leads-ui mx-auto max-w-[1600px] px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
          <div>
            <h1 className="leads-ui-display text-2xl tracking-tight">Leads</h1>
            <p className="text-xs text-slate-300">
              Visual estilo WhatsApp com funil, tags e organizacao.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="rounded-full border border-[#2a3942] bg-[#111b21] px-4 py-2 text-xs text-slate-200"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => syncContacts()}
              disabled={syncing}
              className="rounded-full border border-[#2a3942] bg-[#111b21] px-4 py-2 text-xs text-slate-200 disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar contatos'}
            </button>
            <button
              type="button"
              onClick={() => setEditPipeline((prev) => !prev)}
              className="rounded-full border border-[#2a3942] bg-[#111b21] px-4 py-2 text-xs text-slate-200"
            >
              {editPipeline ? 'Fechar funil' : 'Editar funil'}
            </button>
          </div>
        </div>

        {status && (
          <div className="mb-4 rounded-xl border border-[#2a3942] bg-[#111b21] p-3 text-xs text-slate-200">
            {status}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/60 bg-rose-500/20 p-3 text-rose-100">
            {error}
          </div>
        )}

        {editPipeline && (
          <div className="mb-5 rounded-2xl border border-[#2a3942] bg-[#111b21] p-4 text-white">
            <p className="text-sm font-semibold mb-3">Pipeline</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {pipeline.map((stage, index) => (
                <input
                  key={stage + index}
                  value={stage}
                  onChange={(event) => handlePipelineRename(index, event.target.value)}
                  className="rounded-xl border border-[#2a3942] bg-[#0b141a] px-3 py-2 text-sm text-white"
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_320px] gap-0 rounded-2xl overflow-hidden border border-[#2a3942] shadow-2xl">
          <div className="bg-[#111b21] text-white">
            <div className="flex items-center justify-between border-b border-[#202c33] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-semibold">
                  CRM
                </div>
                <div>
                  <p className="text-sm font-semibold">Caixa de entrada</p>
                  <p className="text-[11px] text-slate-400">{filteredLeads.length} contatos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <button type="button" className="rounded-full px-2 py-1 text-xs">+</button>
                <button type="button" className="rounded-full px-2 py-1 text-xs">⋮</button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-[#202c33]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar ou iniciar conversa"
                className="w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('contatos')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                    activeTab === 'contatos'
                      ? 'border-[#00a884] text-[#00a884]'
                      : 'border-[#202c33] text-slate-400'
                  }`}
                >
                  Contatos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('grupos')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                    activeTab === 'grupos'
                      ? 'border-[#00a884] text-[#00a884]'
                      : 'border-[#202c33] text-slate-400'
                  }`}
                >
                  Grupos
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded-full text-[11px] font-semibold border border-[#202c33] text-slate-400"
                >
                  Nao lidas
                </button>
              </div>

              {activeTab === 'contatos' && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <select
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                    className="w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
                  >
                    <option value="">Todas as etapas</option>
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  <input
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    placeholder="Filtrar por tag"
                    className="w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-auto">
              {activeTab === 'grupos' ? (
                <div className="p-4 text-sm text-slate-400">
                  {groups.length === 0 ? 'Nenhum grupo sincronizado.' : ''}
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          setSelectedTarget({
                            type: 'group',
                            id: group.id,
                            name: group.name,
                          })
                        }
                        className={`w-full text-left rounded-xl border border-[#202c33] bg-[#0b141a] p-3 transition ${
                          selectedTarget?.type === 'group' && selectedTarget.id === group.id
                            ? 'bg-[#202c33]'
                            : 'hover:bg-[#1f2a30]'
                        }`}
                      >
                        <p className="text-sm font-semibold text-white">{group.name}</p>
                        <p className="text-xs text-slate-400">
                          {group.participantCount} participantes
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#202c33]">
                  {filteredLeads.length === 0 && (
                    <p className="p-4 text-sm text-slate-400">Nenhum lead encontrado.</p>
                  )}
                  {filteredLeads.map((lead) => {
                    const stageLabel = lead.pipelineStage || 'Novo';
                    const tagList = [
                      ...(lead.tags || []).map((item) => item.tag.name),
                      ...(tagsByLead[lead.id] || []),
                    ];
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => {
                          setSelectedLeadId(lead.id);
                          setSelectedTarget({
                            type: 'contact',
                            id: lead.id,
                            name: lead.name,
                            phoneNumber: lead.phoneNumber,
                            jid: lead.jid,
                          });
                        }}
                        className={`w-full text-left px-4 py-3 transition ${
                          selectedLeadId === lead.id ? 'bg-[#202c33]' : 'hover:bg-[#1f2a30]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#2a3942] text-white flex items-center justify-center text-sm font-semibold">
                            {lead.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{lead.name}</p>
                            <p className="text-xs text-slate-400">
                              {lead.lastMessage || 'Sem mensagens recentes'}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) : ''}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              stageStyles[stageLabel] || 'bg-[#202c33] text-slate-200'
                            }`}
                          >
                            {stageLabel}
                          </span>
                          {tagList.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[#202c33] px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0b141a] text-white flex flex-col">
            <div className="flex items-center justify-between border-b border-[#202c33] px-4 py-3">
              {selectedTarget ? (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#2a3942] flex items-center justify-center text-sm font-semibold">
                    {selectedTarget.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedTarget.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {selectedTarget.type === 'group' ? 'Grupo' : 'Online agora'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Selecione um lead</p>
              )}
              <div className="flex items-center gap-2 text-slate-400">
                <button type="button" className="rounded-full px-2 py-1 text-xs">🔍</button>
                <button type="button" className="rounded-full px-2 py-1 text-xs">⋮</button>
              </div>
            </div>

            <div className="wa-chat-bg flex-1 p-6 space-y-4 overflow-auto">
              {selectedTarget && chatMessages.length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma mensagem ainda.</p>
              )}
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow ${
                    message.from === 'me'
                      ? 'bg-[#005c4b] text-white ml-auto'
                      : 'bg-[#202c33] text-slate-100'
                  }`}
                >
                  <p>{message.text}</p>
                  <p className="mt-1 text-[10px] text-slate-300">
                    {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#202c33] px-4 py-3">
              <div className="flex items-center gap-2">
                <button type="button" className="text-slate-400">😊</button>
                <button type="button" className="text-slate-400">📎</button>
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Digite uma mensagem"
                  className="flex-1 rounded-2xl border border-[#202c33] bg-[#1f2a30] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="rounded-2xl bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a]"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#111b21] text-white">
            <div className="border-b border-[#202c33] px-4 py-3">
              <p className="text-xs uppercase text-slate-400">Detalhes do lead</p>
              <p className="text-lg font-semibold">
                {selectedLead?.name || 'Sem lead selecionado'}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {selectedLead ? (
                <>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Etapa do funil</p>
                    <select
                      value={selectedLead.pipelineStage || stageOptions[0]}
                      onChange={(event) => {
                        const nextStage = event.target.value;
                        setLeads((prev) =>
                          prev.map((lead) =>
                            lead.id === selectedLead.id
                              ? { ...lead, pipelineStage: nextStage }
                              : lead,
                          ),
                        );
                      }}
                      className="mt-2 w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
                    >
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-400">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ...(selectedLead.tags || []).map((item) => item.tag.name),
                        ...(tagsByLead[selectedLead.id] || []),
                      ].map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full bg-[#202c33] px-3 py-1 text-xs text-slate-200"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-[10px] text-slate-400"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      placeholder="Adicionar tag"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleAddTag((event.target as HTMLInputElement).value);
                          (event.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-400">Notas</p>
                    <textarea
                      value={notesByLead[selectedLead.id] || ''}
                      onChange={(event) =>
                        setNotesByLead((prev) => ({
                          ...prev,
                          [selectedLead.id]: event.target.value,
                        }))
                      }
                      placeholder="Escreva observacoes importantes"
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-[#202c33] bg-[#0b141a] px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                      <p className="text-xs text-slate-400">Telefone</p>
                      <p className="text-slate-100">{selectedLead.phoneNumber || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                      <p className="text-xs text-slate-400">Email</p>
                      <p className="text-slate-100">{selectedLead.email || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="text-slate-100">
                        {selectedLead.optIn === false ? 'Opt-out' : 'Opt-in'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                      <p className="text-xs text-slate-400">Origem</p>
                      <p className="text-slate-100">{selectedLead.origin || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                      <p className="text-xs text-slate-400">Responsavel</p>
                      <p className="text-slate-100">{selectedLead.responsibleUser || '-'}</p>
                    </div>
                  </div>
                </>
              ) : selectedTarget?.type === 'group' ? (
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                    <p className="text-xs text-slate-400">Tipo</p>
                    <p>Grupo</p>
                  </div>
                  <div className="rounded-xl border border-[#202c33] bg-[#0b141a] p-3">
                    <p className="text-xs text-slate-400">Nome</p>
                    <p>{selectedTarget.name}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Selecione um lead para ver detalhes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
