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
  const [activeTab, setActiveTab] = useState<'contatos' | 'grupos'>('contatos');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [notesByLead, setNotesByLead] = useState<Record<string, string>>({});
  const [tagsByLead, setTagsByLead] = useState<Record<string, string[]>>({});
  const [pipeline, setPipeline] = useState(stageDefaults);
  const [editPipeline, setEditPipeline] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messagesByLead, setMessagesByLead] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [leadsResponse, groupsResponse] = await Promise.all([
        fetch('/api/crm/leads', { headers }),
        fetch('/api/whatsapp/groups', { headers }),
      ]);

      if (leadsResponse.ok) {
        const data = await leadsResponse.json();
        const list = Array.isArray(data) ? data : [];
        setLeads(list);
        setSelectedLeadId(list[0]?.id || null);
      }

      if (groupsResponse.ok) {
        const data = await groupsResponse.json();
        setGroups(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError('Erro ao carregar leads');
      console.error(err);
    } finally {
      setLoading(false);
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
    return leads.find((lead) => lead.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  const chatMessages = useMemo(() => {
    if (!selectedLead) return [];
    return messagesByLead[selectedLead.id] || [];
  }, [messagesByLead, selectedLead]);

  const stageOptions = useMemo(() => {
    return pipeline.length ? pipeline : stageDefaults;
  }, [pipeline]);

  const handleSendMessage = () => {
    if (!selectedLead || !messageInput.trim()) return;
    const newMessage: ChatMessage = {
      id: `${selectedLead.id}-${Date.now()}`,
      from: 'me',
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessagesByLead((prev) => ({
      ...prev,
      [selectedLead.id]: [...(prev[selectedLead.id] || []), newMessage],
    }));
    setMessageInput('');
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f3ea,_#eef2f6_60%,_#e8eff7_100%)]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;700&display=swap');
        .leads-ui { font-family: 'Space Grotesk', sans-serif; }
        .leads-ui-display { font-family: 'Newsreader', serif; }
      `}</style>

      <div className="leads-ui max-w-[1400px] mx-auto p-6 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="leads-ui-display text-3xl lg:text-4xl text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">
              Organize contatos e grupos com funil, tags e historico.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm text-slate-700"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setEditPipeline((prev) => !prev)}
              className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm text-slate-700"
            >
              {editPipeline ? 'Fechar funil' : 'Editar funil'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        )}

        {editPipeline && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">Pipeline</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {pipeline.map((stage, index) => (
                <input
                  key={stage + index}
                  value={stage}
                  onChange={(event) => handlePipelineRename(index, event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('contatos')}
                  className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                    activeTab === 'contatos'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Contatos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('grupos')}
                  className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                    activeTab === 'grupos'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Grupos
                </button>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, telefone"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />

              {activeTab === 'contatos' && (
                <div className="mt-3 space-y-2">
                  <select
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="max-h-[640px] overflow-auto">
              {activeTab === 'grupos' ? (
                <div className="p-4 text-sm text-slate-500">
                  {groups.length === 0 ? 'Nenhum grupo sincronizado.' : ''}
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-700">{group.name}</p>
                        <p className="text-xs text-slate-500">
                          {group.participantCount} participantes
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredLeads.length === 0 && (
                    <p className="p-4 text-sm text-slate-500">Nenhum lead encontrado.</p>
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
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full text-left p-4 transition ${
                          selectedLeadId === lead.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                            {lead.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{lead.name}</p>
                            <p className="text-xs text-slate-500">
                              {lead.lastMessage || 'Sem mensagens recentes'}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              stageStyles[stageLabel] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {stageLabel}
                          </span>
                        </div>
                        {tagList.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tagList.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur flex flex-col">
            <div className="border-b border-slate-200 p-4 flex items-center justify-between">
              {selectedLead ? (
                <div>
                  <p className="text-sm text-slate-500">Conversa</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedLead.name}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Selecione um lead</p>
              )}
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
              >
                Anexar arquivo
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-auto">
              {selectedLead && chatMessages.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p>
              )}
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[70%] rounded-3xl px-4 py-2 text-sm ${
                    message.from === 'me'
                      ? 'bg-slate-900 text-white ml-auto'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <p>{message.text}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Digite uma mensagem"
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur">
            <div className="border-b border-slate-200 p-4">
              <p className="text-sm text-slate-500">Detalhes do lead</p>
              <p className="text-lg font-semibold text-slate-900">
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
                          className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-400">Telefone</p>
                      <p className="text-slate-700">{selectedLead.phoneNumber || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-400">Email</p>
                      <p className="text-slate-700">{selectedLead.email || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="text-slate-700">
                        {selectedLead.optIn === false ? 'Opt-out' : 'Opt-in'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-400">Origem</p>
                      <p className="text-slate-700">{selectedLead.origin || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-400">Responsavel</p>
                      <p className="text-slate-700">{selectedLead.responsibleUser || '-'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Selecione um lead para ver detalhes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
