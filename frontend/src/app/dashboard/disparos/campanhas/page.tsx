'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Lead = {
  id: string;
  name: string;
  phoneNumber: string;
  optIn: boolean;
  pipelineStage?: string;
  tags?: { tag: { name: string } }[];
};

type Contact = {
  id: string;
  name: string;
  phoneNumber: string;
  jid?: string | null;
};

type Group = {
  id: string;
  name: string;
  participantCount: number;
};

const stageOptions = [
  { value: '', label: 'Todas as etapas' },
  { value: 'novo', label: 'Novo' },
  { value: 'qualificando', label: 'Qualificando' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'perdido', label: 'Perdido' },
];

export default function DisparoCampanhasPage() {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [messagesPerMinute, setMessagesPerMinute] = useState(20);
  const [scheduleType, setScheduleType] = useState<'now' | 'once' | 'recurring'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [recurrenceTime, setRecurrenceTime] = useState('09:00');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  const [audienceMode, setAudienceMode] = useState<'leads' | 'manual'>('leads');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase
    ? apiBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3000';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz || 'America/Sao_Paulo');
  }, []);

  useEffect(() => {
    if (!token) return;

    const loadContacts = async () => {
      try {
        const [contactsResponse, groupsResponse] = await Promise.all([
          fetch(`${api}/whatsapp/contacts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${api}/whatsapp/groups`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (contactsResponse.ok) {
          const data = await contactsResponse.json();
          setContacts(Array.isArray(data) ? data : []);
        }

        if (groupsResponse.ok) {
          const data = await groupsResponse.json();
          setGroups(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        setStatus('Erro ao carregar contatos/grupos');
      }
    };

    loadContacts();
  }, [api, token]);

  const tagFilter = useMemo(() => {
    return tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [tagsInput]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (!lead.optIn) return false;
      if (stageFilter && lead.pipelineStage !== stageFilter) {
        return false;
      }
      if (tagFilter.length) {
        const leadTags = (lead.tags || []).map((tag) => tag.tag.name.toLowerCase());
        return tagFilter.every((tag) => leadTags.includes(tag.toLowerCase()));
      }
      return true;
    });
  }, [leads, stageFilter, tagFilter]);

  const selectedContactTargets = useMemo(() => {
    return contacts
      .filter((contact) => selectedContacts[contact.id])
      .map((contact) => contact.jid || contact.phoneNumber);
  }, [contacts, selectedContacts]);

  const selectedGroupTargets = useMemo(() => {
    return groups.filter((group) => selectedGroups[group.id]).map((group) => group.id);
  }, [groups, selectedGroups]);

  const fetchLeads = async (): Promise<Lead[]> => {
    if (!token) {
      setStatus('Token nao disponivel');
      return [];
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch(`${api}/crm/leads?limit=200`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar leads');
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setLeads(list);
      setStatus('Leads carregados');
      return list;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao carregar leads');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleSyncContacts = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch(`${api}/whatsapp/sync-contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao sincronizar contatos');
      }

      const data = await response.json();
      setStatus(`Sincronizados: ${data.created || 0} novo(s)`);
      await fetchLeads();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao sincronizar');
    } finally {
      setLoading(false);
    }
  };

  const computeNextRun = () => {
    const now = new Date();
    const [hours, minutes] = recurrenceTime.split(':').map(Number);
    const base = new Date(now);
    base.setHours(hours || 0, minutes || 0, 0, 0);

    if (recurrence === 'daily') {
      if (base <= now) {
        base.setDate(base.getDate() + 1);
      }
      return base;
    }

    if (recurrence === 'weekly') {
      const weekDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const selectedDays = daysOfWeek.length ? daysOfWeek : ['mon'];
      for (let i = 0; i < 7; i += 1) {
        const candidate = new Date(base);
        candidate.setDate(base.getDate() + i);
        const dayKey = weekDays[candidate.getDay()];
        if (selectedDays.includes(dayKey) && candidate > now) {
          return candidate;
        }
      }
      base.setDate(base.getDate() + 7);
      return base;
    }

    const day = Math.min(Math.max(dayOfMonth, 1), 31);
    const candidate = new Date(base);
    candidate.setDate(day);
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);
      candidate.setDate(day);
    }
    return candidate;
  };

  const handleSubmit = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    if (!name.trim()) {
      setStatus('Informe o nome da campanha');
      return;
    }

    if (!message && !file) {
      setStatus('Informe um texto ou selecione uma midia');
      return;
    }

    if (scheduleType === 'once' && !scheduledFor) {
      setStatus('Informe a data e hora do agendamento');
      return;
    }

    if (scheduleType !== 'now' && file) {
      setStatus('Agendamento com midia ainda nao suportado');
      return;
    }

    const usingManualSelection = audienceMode === 'manual';
    const currentLeads = leads.length ? leads : await fetchLeads();
    const targets = usingManualSelection
      ? []
      : currentLeads.filter((lead) => {
          if (!lead.optIn) return false;
          if (stageFilter && lead.pipelineStage !== stageFilter) return false;
          if (tagFilter.length) {
            const leadTags = (lead.tags || []).map((tag) => tag.tag.name.toLowerCase());
            return tagFilter.every((tag) => leadTags.includes(tag.toLowerCase()));
          }
          return true;
        });

    if (usingManualSelection) {
      if (!selectedContactTargets.length && !selectedGroupTargets.length) {
        setStatus('Selecione contatos ou grupos para enviar');
        return;
      }
    } else if (!targets.length) {
      setStatus('Nenhum lead encontrado para a segmentacao informada');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      if (file) {
        const delayMs = Math.max(1, Math.floor(60000 / Math.max(messagesPerMinute, 1)));

        const manualTargets = usingManualSelection
          ? [...selectedContactTargets, ...selectedGroupTargets]
          : [];
        const sendTargets = usingManualSelection ? manualTargets : targets.map((lead) => lead.phoneNumber);

        for (const target of sendTargets) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('to', target);
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

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        setStatus(`Envio concluido: ${sendTargets.length} contato(s)`);
        return;
      }

      const scheduleConfig =
        scheduleType === 'recurring'
          ? {
              type: recurrence,
              time: recurrenceTime,
              daysOfWeek,
              dayOfMonth,
            }
          : { type: scheduleType };

      const scheduledForValue =
        scheduleType === 'once'
          ? new Date(scheduledFor).toISOString()
          : scheduleType === 'recurring'
            ? computeNextRun().toISOString()
            : undefined;

      const createResponse = await fetch(`${api}/broadcasts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          message,
          tagFilter: usingManualSelection ? [] : tagFilter,
          stageFilter: usingManualSelection ? undefined : stageFilter || undefined,
          messagesPerMinute,
          scheduledFor: scheduledForValue || undefined,
          scheduleConfig,
          scheduleTimezone: timezone,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Falha ao criar campanha');
      }

      const broadcast = await createResponse.json();

      if (usingManualSelection) {
        if (selectedContactTargets.length) {
          const recipientsResponse = await fetch(
            `${api}/broadcasts/${broadcast.id}/recipients`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phoneNumbers: selectedContactTargets,
              }),
            },
          );

          if (!recipientsResponse.ok) {
            throw new Error('Falha ao adicionar destinatarios');
          }
        }

        if (selectedGroupTargets.length) {
          const groupResponse = await fetch(
            `${api}/broadcasts/${broadcast.id}/groups`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                groupIds: selectedGroupTargets,
              }),
            },
          );

          if (!groupResponse.ok) {
            throw new Error('Falha ao adicionar grupos');
          }
        }
      } else {
        const recipientsResponse = await fetch(
          `${api}/broadcasts/${broadcast.id}/recipients`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phoneNumbers: targets.map((lead) => lead.phoneNumber),
            }),
          },
        );

        if (!recipientsResponse.ok) {
          throw new Error('Falha ao adicionar destinatarios');
        }
      }

      if (!scheduledForValue) {
        await fetch(`${api}/broadcasts/${broadcast.id}/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const totalTargets = usingManualSelection
        ? selectedContactTargets.length + selectedGroupTargets.length
        : targets.length;
      setStatus(`Campanha criada: ${totalTargets} contato(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const toggleWeekday = (day: string) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Envio em Massa</h1>
          <Link
            href="/dashboard/disparos"
            className="text-sm text-whatsapp hover:text-whatsapp-dark"
          >
            Voltar para Disparos
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Publico</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAudienceMode('leads')}
                className={`px-3 py-2 rounded text-sm border ${
                  audienceMode === 'leads'
                    ? 'border-whatsapp text-whatsapp'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                Segmentacao (leads)
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode('manual')}
                className={`px-3 py-2 rounded text-sm border ${
                  audienceMode === 'manual'
                    ? 'border-whatsapp text-whatsapp'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                Contatos e grupos
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome da campanha
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Campanha de boas-vindas"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Use variaveis como {nome}, {cidade}"
              rows={5}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
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

          {audienceMode === 'leads' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tags (separadas por virgula)
              </label>
              <input
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="Ex: cliente, vip"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Etapa do funil
              </label>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {stageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            </div>
          )}

          {audienceMode === 'manual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Contatos</p>
                <div className="max-h-48 overflow-auto space-y-2">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhum contato encontrado.</p>
                  ) : (
                    contacts.map((contact) => (
                      <label key={contact.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!selectedContacts[contact.id]}
                          onChange={() =>
                            setSelectedContacts((prev) => ({
                              ...prev,
                              [contact.id]: !prev[contact.id],
                            }))
                          }
                        />
                        <span>{contact.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Grupos</p>
                <div className="max-h-48 overflow-auto space-y-2">
                  {groups.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhum grupo encontrado.</p>
                  ) : (
                    groups.map((group) => (
                      <label key={group.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!selectedGroups[group.id]}
                          onChange={() =>
                            setSelectedGroups((prev) => ({
                              ...prev,
                              [group.id]: !prev[group.id],
                            }))
                          }
                        />
                        <span>{group.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Rate limit (mensagens por minuto)
            </label>
            <input
              type="number"
              min={1}
              value={messagesPerMinute}
              onChange={(event) => setMessagesPerMinute(Number(event.target.value || 1))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="border border-gray-200 rounded p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Agendamento</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: 'now', label: 'Enviar agora' },
                { id: 'once', label: 'Data e hora' },
                { id: 'recurring', label: 'Recorrente' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScheduleType(option.id as typeof scheduleType)}
                  className={`px-3 py-2 rounded text-sm border ${
                    scheduleType === option.id
                      ? 'border-whatsapp text-whatsapp'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {scheduleType === 'once' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Data e hora</label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Fuso horario</label>
                  <input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {scheduleType === 'recurring' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Recorrencia</label>
                    <select
                      value={recurrence}
                      onChange={(event) => setRecurrence(event.target.value as typeof recurrence)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="daily">Diaria</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Horario</label>
                    <input
                      type="time"
                      value={recurrenceTime}
                      onChange={(event) => setRecurrenceTime(event.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Fuso horario</label>
                    <input
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {recurrence === 'weekly' && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Dias da semana
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'mon', label: 'Seg' },
                        { id: 'tue', label: 'Ter' },
                        { id: 'wed', label: 'Qua' },
                        { id: 'thu', label: 'Qui' },
                        { id: 'fri', label: 'Sex' },
                        { id: 'sat', label: 'Sab' },
                        { id: 'sun', label: 'Dom' },
                      ].map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleWeekday(day.id)}
                          className={`px-3 py-2 rounded text-sm border ${
                            daysOfWeek.includes(day.id)
                              ? 'border-whatsapp text-whatsapp'
                              : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recurrence === 'monthly' && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Dia do mes</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(event) => setDayOfMonth(Number(event.target.value || 1))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fetchLeads}
              className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700"
              disabled={loading}
            >
              Atualizar audiencia
            </button>
            <button
              type="button"
              onClick={handleSyncContacts}
              className="px-4 py-2 border border-whatsapp text-whatsapp rounded text-sm"
              disabled={loading}
            >
              Sincronizar contatos
            </button>
            <span className="text-sm text-gray-600">
              {audienceMode === 'manual'
                ? `Selecionados: ${selectedContactTargets.length + selectedGroupTargets.length}`
                : `Contatos encontrados: ${filteredLeads.length}`}
            </span>
          </div>

          {status && (
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
              {status}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 px-4 bg-whatsapp text-white rounded hover:bg-whatsapp-dark disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Criar campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}
