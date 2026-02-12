'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

type Interaction = {
  selectedOption?: string | null;
  rawText?: string | null;
  createdAt: string;
  phoneNumber?: string | null;
  sectionTitle?: string | null;
};

type SectionOption = {
  label: string;
  nextSection: number | null;
  replyTitle: string;
  replyInfo: string;
  replyMessage: string;
};

type Section = {
  title: string;
  info: string;
  message: string;
  question: string;
  options: SectionOption[];
};

const defaultSections: Section[] = [
  {
    title: 'Apresentacao',
    info: 'Escolha uma opcao para continuar.',
    message: 'Atendimento automatico 24h.',
    question: 'Como podemos ajudar?',
    options: [
      { label: 'Precos e planos', nextSection: 1, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Pagamento', nextSection: 2, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Suporte', nextSection: 3, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Entrega', nextSection: 4, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Falar com atendente', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
    ],
  },
  {
    title: 'Precos e planos',
    info: 'Veja opcoes de planos e promocoes.',
    message: '',
    question: 'Qual assunto sobre precos?',
    options: [
      { label: 'Ver planos', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Falar com vendedor', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Voltar ao inicio', nextSection: 0, replyTitle: '', replyInfo: '', replyMessage: '' },
    ],
  },
  {
    title: 'Pagamento',
    info: 'Resolva pagamentos rapidamente.',
    message: '',
    question: 'Como podemos ajudar no pagamento?',
    options: [
      { label: 'Pix', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Cartao', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Boleto', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Voltar ao inicio', nextSection: 0, replyTitle: '', replyInfo: '', replyMessage: '' },
    ],
  },
  {
    title: 'Suporte',
    info: 'Suporte tecnico e pos-venda.',
    message: '',
    question: 'Qual assunto do suporte?',
    options: [
      { label: 'Instalacao', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Garantia', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Troca', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Voltar ao inicio', nextSection: 0, replyTitle: '', replyInfo: '', replyMessage: '' },
    ],
  },
  {
    title: 'Entrega',
    info: 'Informacoes de envio e rastreio.',
    message: '',
    question: 'O que voce precisa na entrega?',
    options: [
      { label: 'Prazo', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Rastreamento', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Endereco', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
      { label: 'Voltar ao inicio', nextSection: 0, replyTitle: '', replyInfo: '', replyMessage: '' },
    ],
  },
];

export default function EnquetesPage() {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [sectionFiles, setSectionFiles] = useState<Record<string, File | null>>({});
  const [optionFiles, setOptionFiles] = useState<Record<string, File | null>>({});
  const [autoStart, setAutoStart] = useState(true);
  const [sendNow, setSendNow] = useState(false);
  const [pollsEnabled, setPollsEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollId, setPollId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [counts, setCounts] = useState<Array<{ option: string; total: number }>>([]);
  const [sectionSummary, setSectionSummary] = useState<Array<{ section: string; total: number }>>(
    [],
  );

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase
    ? apiBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3000';

  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        const [contactsResponse, groupsResponse, settingsResponse] = await Promise.all([
          fetch(`${api}/whatsapp/contacts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${api}/whatsapp/groups`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${api}/whatsapp/settings`, {
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

        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          setPollsEnabled(data.pollsEnabled ?? true);
        }
      } catch (error) {
        setStatus('Erro ao carregar contatos/grupos');
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadData();
  }, [api, token]);

  const handleTogglePolls = async (value: boolean) => {
    if (!token) return;
    setPollsEnabled(value);

    try {
      const response = await fetch(`${api}/whatsapp/settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pollsEnabled: value }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar configuracao');
      }
    } catch (error) {
      setStatus('Nao foi possivel atualizar a configuracao de enquetes');
      setPollsEnabled(!value);
    }
  };

  const selectedPhoneNumbers = useMemo(() => {
    return contacts
      .filter((contact) => selectedContacts[contact.id])
      .map((contact) => contact.jid || contact.phoneNumber);
  }, [contacts, selectedContacts]);

  const selectedGroupIds = useMemo(() => {
    return groups.filter((group) => selectedGroups[group.id]).map((group) => group.id);
  }, [groups, selectedGroups]);

  const updateSectionField = (
    index: number,
    field: keyof Section,
    value: string,
  ) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section,
      ),
    );
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        title: `Secao ${prev.length + 1}`,
        info: '',
        message: '',
        question: 'Qual opcao voce deseja?',
        options: [
          { label: 'Opcao 1', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
          { label: 'Opcao 2', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
        ],
      },
    ]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.map((section) => ({
        ...section,
        options: section.options.map((option) => {
          if (option.nextSection === index) {
            return { ...option, nextSection: null };
          }
          if (typeof option.nextSection === 'number' && option.nextSection > index) {
            return { ...option, nextSection: option.nextSection - 1 };
          }
          return option;
        }),
      }));
    });

    setSectionFiles((prev) => {
      const nextFiles: Record<string, File | null> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const currentIndex = Number.parseInt(key, 10);
        if (Number.isNaN(currentIndex) || currentIndex === index) return;
        const adjustedIndex = currentIndex > index ? currentIndex - 1 : currentIndex;
        nextFiles[String(adjustedIndex)] = value;
      });
      return nextFiles;
    });

    setOptionFiles((prev) => {
      const nextFiles: Record<string, File | null> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const [sectionKey, optionKey] = key.split('-');
        const sectionIndex = Number.parseInt(sectionKey, 10);
        if (Number.isNaN(sectionIndex) || sectionIndex === index) return;
        const adjustedSection = sectionIndex > index ? sectionIndex - 1 : sectionIndex;
        nextFiles[`${adjustedSection}-${optionKey}`] = value;
      });
      return nextFiles;
    });
  };

  const addSectionOption = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              options: [
                ...section.options,
                { label: 'Nova opcao', nextSection: null, replyTitle: '', replyInfo: '', replyMessage: '' },
              ],
            }
          : section,
      ),
    );
  };

  const updateSectionOption = (
    sectionIndex: number,
    optionIndex: number,
    field: 'label' | 'nextSection' | 'replyTitle' | 'replyInfo' | 'replyMessage',
    value: string,
  ) => {
    setSections((prev) =>
      prev.map((section, idx) => {
        if (idx !== sectionIndex) return section;
        const nextOptions = section.options.map((option, optIdx) => {
          if (optIdx !== optionIndex) return option;
          if (field === 'nextSection') {
            const parsed = Number.parseInt(value, 10);
            return {
              ...option,
              nextSection: Number.isNaN(parsed) || parsed < 0 ? null : parsed,
            };
          }
          if (field === 'label') {
            return { ...option, label: value };
          }
          return { ...option, [field]: value };
        });
        return { ...section, options: nextOptions };
      }),
    );
  };

  const removeSectionOption = (sectionIndex: number, optionIndex: number) => {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIndex
          ? { ...section, options: section.options.filter((_, optIdx) => optIdx !== optionIndex) }
          : section,
      ),
    );

    setOptionFiles((prev) => {
      const nextFiles: Record<string, File | null> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const [sectionKey, optionKey] = key.split('-');
        const parsedSection = Number.parseInt(sectionKey, 10);
        const parsedOption = Number.parseInt(optionKey, 10);
        if (Number.isNaN(parsedSection) || Number.isNaN(parsedOption)) return;
        if (parsedSection !== sectionIndex) {
          nextFiles[key] = value;
          return;
        }
        if (parsedOption === optionIndex) return;
        const adjustedOption = parsedOption > optionIndex ? parsedOption - 1 : parsedOption;
        nextFiles[`${parsedSection}-${adjustedOption}`] = value;
      });
      return nextFiles;
    });
  };

  const updateSectionFile = (index: number, fileValue: File | null) => {
    setSectionFiles((prev) => ({
      ...prev,
      [String(index)]: fileValue,
    }));
  };

  const updateOptionFile = (
    sectionIndex: number,
    optionIndex: number,
    fileValue: File | null,
  ) => {
    setOptionFiles((prev) => ({
      ...prev,
      [`${sectionIndex}-${optionIndex}`]: fileValue,
    }));
  };

  const handleSend = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    const normalizedSections = sections.map((section) => {
      const cleanedOptions = section.options
        .map((option) => ({
          label: option.label.trim(),
          nextSection: option.nextSection,
          replyTitle: option.replyTitle?.trim() || undefined,
          replyInfo: option.replyInfo?.trim() || undefined,
          replyMessage: option.replyMessage?.trim() || undefined,
        }))
        .filter((option) => option.label);

      return {
        title: section.title.trim() || 'Secao',
        info: section.info.trim() || undefined,
        message: section.message.trim() || undefined,
        question: section.question.trim(),
        options: cleanedOptions,
      };
    });

    const invalidSection = normalizedSections.find(
      (section) => !section.question || section.options.length < 2,
    );

    if (!name.trim() || invalidSection) {
      setStatus('Preencha nome, perguntas e no minimo 2 opcoes por secao');
      return;
    }

    if (!pollsEnabled) {
      setStatus('As enquetes estao desativadas no WhatsApp');
      return;
    }

    if (sendNow && !selectedPhoneNumbers.length && !selectedGroupIds.length) {
      setStatus('Selecione contatos ou grupos para enviar agora');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const pollResponse = await fetch(`${api}/polls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          question: normalizedSections[0].question,
          options: normalizedSections[0].options.map((option) => option.label),
          sections: normalizedSections,
          useNative: true,
          autoStart,
        }),
      });

      if (!pollResponse.ok) {
        throw new Error('Falha ao criar enquete');
      }

      const poll = await pollResponse.json();
      setPollId(poll.id);

      const sectionFileEntries = Object.entries(sectionFiles);
      for (const [index, sectionFile] of sectionFileEntries) {
        if (!sectionFile) continue;

        const formData = new FormData();
        formData.append('file', sectionFile);

        const uploadResponse = await fetch(
          `${api}/polls/${poll.id}/section-file/${index}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error('Falha ao anexar arquivo da secao');
        }
      }

      const optionFileEntries = Object.entries(optionFiles);
      for (const [key, optionFile] of optionFileEntries) {
        if (!optionFile) continue;
        const [sectionIndex, optionIndex] = key.split('-');
        if (!sectionIndex || !optionIndex) continue;

        const formData = new FormData();
        formData.append('file', optionFile);

        const uploadResponse = await fetch(
          `${api}/polls/${poll.id}/section-option-file/${sectionIndex}/${optionIndex}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error('Falha ao anexar arquivo da opcao');
        }
      }

      if (sendNow) {
        const sendResponse = await fetch(`${api}/polls/${poll.id}/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumbers: selectedPhoneNumbers,
            groupIds: selectedGroupIds,
          }),
        });

        if (!sendResponse.ok) {
          throw new Error('Falha ao enviar enquete');
        }

        setStatus('Enquete enviada com sucesso');
        await loadInteractions(poll.id);
      } else {
        setStatus('Fluxo salvo com sucesso');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao enviar enquete');
    } finally {
      setLoading(false);
    }
  };

  const loadInteractions = async (id: string) => {
    if (!token) return;
    const response = await fetch(`${api}/polls/${id}/interactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    setInteractions(Array.isArray(data.interactions) ? data.interactions : []);
    setCounts(Array.isArray(data.counts) ? data.counts : []);
    setSectionSummary(Array.isArray(data.sectionSummary) ? data.sectionSummary : []);
  };

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-amber-200';
  const textAreaClass =
    'w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#f8f4ef_45%,_#f1f5f9_100%)] text-slate-900">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;700&display=swap');
        .polls-font { font-family: 'Space Grotesk', sans-serif; }
        .polls-display { font-family: 'Fraunces', serif; }
      `}</style>

      <div className="polls-font max-w-6xl mx-auto px-6 py-10 lg:py-14">
        <div className="mb-8 rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Fluxo inteligente</p>
              <h1 className="polls-display text-3xl font-semibold text-slate-900 lg:text-4xl">
                Enquetes com menus e submenus
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Texto + arquivo opcional, cada resposta vira outra enquete. Perfeito para precos,
                pagamento, suporte e entrega.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-700">
                Auto-atendimento
              </span>
              <Link
                href="/dashboard/disparos"
                className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
              >
                Voltar para Disparos
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              title: 'Preco e planos',
              text: 'Mostre planos, anexos e leve o cliente direto ao pagamento.',
            },
            {
              title: 'Suporte rapido',
              text: 'Submenu com garantia, troca e atendimento humano sob demanda.',
            },
            {
              title: 'Entrega e rastreio',
              text: 'Perguntas prontas e arquivos com prazos ou politicas.',
            },
          ].map((idea) => (
            <div
              key={idea.title}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-600 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-amber-600">Ideia</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{idea.title}</p>
              <p className="mt-1 text-sm text-slate-600">{idea.text}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {sendNow && (
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-lg backdrop-blur">
              <p className="text-sm font-semibold text-slate-700 mb-3">Destinatarios</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Contatos</p>
                  <div className="max-h-48 overflow-auto rounded-2xl border border-slate-200 bg-white/70">
                    {contacts.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">Nenhum contato encontrado.</div>
                    ) : (
                      contacts.map((contact) => (
                        <label key={contact.id} className="flex gap-2 p-2 text-sm text-slate-700">
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

                <div>
                  <p className="text-xs text-gray-500 mb-2">Grupos</p>
                  <div className="max-h-48 overflow-auto rounded-2xl border border-slate-200 bg-white/70">
                    {groups.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">Nenhum grupo encontrado.</div>
                    ) : (
                      groups.map((group) => (
                        <label key={group.id} className="flex gap-2 p-2 text-sm text-slate-700">
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
            </div>
          )}

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur lg:col-span-2 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">Secoes do fluxo</label>
              <button
                type="button"
                onClick={addSection}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700"
              >
                + Adicionar secao
              </button>
            </div>

            <div className="space-y-4">
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Secao {sectionIndex + 1}
                    </p>
                    {sectionIndex > 0 && (
                      <button
                        type="button"
                        onClick={() => removeSection(sectionIndex)}
                        className="text-xs font-semibold text-rose-500"
                      >
                        Remover secao
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <input
                      value={section.title}
                      onChange={(event) => updateSectionField(sectionIndex, 'title', event.target.value)}
                      placeholder="Titulo da secao"
                      className={inputClass}
                    />
                    <input
                      value={section.info}
                      onChange={(event) => updateSectionField(sectionIndex, 'info', event.target.value)}
                      placeholder="Informacao curta"
                      className={inputClass}
                    />
                  </div>

                  <textarea
                    value={section.message}
                    onChange={(event) => updateSectionField(sectionIndex, 'message', event.target.value)}
                    placeholder="Mensagem da secao"
                    rows={2}
                    className={`${textAreaClass} mt-3`}
                  />

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      Arquivo da secao (opcional)
                    </label>
                    <input
                      type="file"
                      onChange={(event) =>
                        updateSectionFile(sectionIndex, event.target.files?.[0] || null)
                      }
                      className="text-xs text-slate-600"
                    />
                    {sectionFiles[String(sectionIndex)]?.name && (
                      <p className="mt-1 text-xs text-slate-500">
                        {sectionFiles[String(sectionIndex)]?.name}
                      </p>
                    )}
                  </div>

                  <input
                    value={section.question}
                    onChange={(event) => updateSectionField(sectionIndex, 'question', event.target.value)}
                    placeholder="Pergunta da secao"
                    className={`${inputClass} mt-4`}
                  />

                  <div className="mt-3 space-y-3">
                    {section.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                        <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                          <input
                            value={option.label}
                            onChange={(event) =>
                              updateSectionOption(sectionIndex, optionIndex, 'label', event.target.value)
                            }
                            placeholder={`Opcao ${optionIndex + 1}`}
                            className={inputClass}
                          />
                          <select
                            value={option.nextSection ?? -1}
                            onChange={(event) =>
                              updateSectionOption(
                                sectionIndex,
                                optionIndex,
                                'nextSection',
                                event.target.value,
                              )
                            }
                            className={inputClass}
                          >
                            <option value={-1}>Encerrar</option>
                            {sections.map((sectionItem, idx) => (
                              <option key={idx} value={idx}>
                                Secao {idx + 1} - {sectionItem.title || 'Sem titulo'}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeSectionOption(sectionIndex, optionIndex)}
                            className="text-xs font-semibold text-rose-500"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input
                            value={option.replyTitle}
                            onChange={(event) =>
                              updateSectionOption(
                                sectionIndex,
                                optionIndex,
                                'replyTitle',
                                event.target.value,
                              )
                            }
                            placeholder="Titulo da resposta"
                            className={inputClass}
                          />
                          <input
                            value={option.replyInfo}
                            onChange={(event) =>
                              updateSectionOption(
                                sectionIndex,
                                optionIndex,
                                'replyInfo',
                                event.target.value,
                              )
                            }
                            placeholder="Info da resposta"
                            className={inputClass}
                          />
                        </div>

                        <textarea
                          value={option.replyMessage}
                          onChange={(event) =>
                            updateSectionOption(
                              sectionIndex,
                              optionIndex,
                              'replyMessage',
                              event.target.value,
                            )
                          }
                          placeholder="Mensagem da resposta"
                          rows={2}
                          className={`${textAreaClass} mt-2`}
                        />

                        <div className="mt-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">
                            Arquivo da resposta (opcional)
                          </label>
                          <input
                            type="file"
                            onChange={(event) =>
                              updateOptionFile(
                                sectionIndex,
                                optionIndex,
                                event.target.files?.[0] || null,
                              )
                            }
                            className="text-xs text-slate-600"
                          />
                          {optionFiles[`${sectionIndex}-${optionIndex}`]?.name && (
                            <p className="mt-1 text-xs text-slate-500">
                              {optionFiles[`${sectionIndex}-${optionIndex}`]?.name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSectionOption(sectionIndex)}
                    className="mt-3 text-sm font-semibold text-amber-700"
                  >
                    + Adicionar opcao
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pollsEnabled}
                  disabled={!settingsLoaded}
                  onChange={(event) => handleTogglePolls(event.target.checked)}
                />
                Ativar enquetes no WhatsApp
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(event) => setAutoStart(event.target.checked)}
                />
                Disparar automaticamente na primeira mensagem do cliente
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(event) => setSendNow(event.target.checked)}
                />
                Enviar agora para contatos/grupos selecionados
              </label>
            </div>

            <p className="text-xs text-slate-500">
              As enquetes usam somente o formato nativo do WhatsApp.
            </p>

            {status && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {status}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : sendNow ? 'Salvar e enviar' : 'Salvar fluxo'}
            </button>
          </div>
        </div>

        {pollId && (
          <div className="mt-10 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Relatorio</h2>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo por secao</p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {sectionSummary.map((item) => (
                  <div key={item.section} className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <p className="text-sm font-semibold text-slate-700">{item.section}</p>
                    <p className="text-lg font-bold text-slate-900">{item.total}</p>
                  </div>
                ))}
                {sectionSummary.length === 0 && (
                  <p className="text-sm text-slate-500">Sem interacoes ainda.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
              {counts.map((item) => (
                <div key={item.option} className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <p className="text-sm font-semibold text-slate-700">{item.option}</p>
                  <p className="text-lg font-bold text-slate-900">{item.total}</p>
                </div>
              ))}
              {counts.length === 0 && (
                <p className="text-sm text-slate-500">Sem interacoes ainda.</p>
              )}
            </div>

            <div className="space-y-2">
              {interactions.map((interaction, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm">
                  <p className="font-semibold text-slate-700">
                    {interaction.selectedOption || interaction.rawText}
                  </p>
                  {interaction.sectionTitle && (
                    <p className="text-xs text-slate-500">{interaction.sectionTitle}</p>
                  )}
                  {interaction.phoneNumber && (
                    <p className="text-xs text-slate-500">{interaction.phoneNumber}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {new Date(interaction.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
