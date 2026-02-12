'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Contact = {
  id: string;
  name: string;
  phoneNumber: string;
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
};

type FollowUpConfig = {
  question: string;
  options: string[];
  introTitle?: string;
  introInfo?: string;
  introMessage?: string;
};

const defaultMenuOptions = [
  'Pagamento',
  'Entrega',
  'Suporte',
  'Promocoes',
  'Informacoes',
];

const defaultFollowUps: Record<string, FollowUpConfig> = {
  '0': {
    question: 'Sobre pagamento, como podemos ajudar?',
    options: ['Pix', 'Cartao', 'Boleto', 'Parcelamento', 'Falar com financeiro', 'Voltar ao menu principal'],
  },
  '1': {
    question: 'Sobre entrega, o que voce precisa?',
    options: ['Prazo', 'Rastreamento', 'Endereco', 'Reagendar', 'Retirada', 'Voltar ao menu principal'],
  },
  '2': {
    question: 'Suporte tecnico: qual assunto?',
    options: ['Problema no produto', 'Instalacao', 'Garantia', 'Troca', 'Outro', 'Voltar ao menu principal'],
  },
  '3': {
    question: 'Promocoes: o que voce procura?',
    options: ['Ofertas atuais', 'Cupons', 'Lancamentos', 'Combos', 'Avise-me', 'Voltar ao menu principal'],
  },
  '4': {
    question: 'Informacoes gerais: escolha uma opcao',
    options: ['Horarios', 'Enderecos', 'Catalogo', 'Contato', 'Falar com atendente', 'Voltar ao menu principal'],
  },
};

export default function EnquetesPage() {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [introTitle, setIntroTitle] = useState('Bem-vindo!');
  const [introInfo, setIntroInfo] = useState('Selecione uma opcao para continuar.');
  const [introMessage, setIntroMessage] = useState('Atendimento automatico 24h.');
  const [question, setQuestion] = useState('Como podemos ajudar?');
  const [options, setOptions] = useState<string[]>(defaultMenuOptions);
  const [followUps, setFollowUps] = useState<Record<string, FollowUpConfig>>(
    defaultFollowUps,
  );
  const [followUpFiles, setFollowUpFiles] = useState<Record<string, File | null>>({});
  const [useNative, setUseNative] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [autoStart, setAutoStart] = useState(true);
  const [sendNow, setSendNow] = useState(false);
  const [includeMenuReturn, setIncludeMenuReturn] = useState(true);
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
      .map((contact) => contact.phoneNumber);
  }, [contacts, selectedContacts]);

  const selectedGroupIds = useMemo(() => {
    return groups.filter((group) => selectedGroups[group.id]).map((group) => group.id);
  }, [groups, selectedGroups]);

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const addOption = () => {
    setOptions((prev) => {
      const next = [...prev, ''];
      setFollowUps((current) => ({
        ...current,
        [String(next.length - 1)]: current[String(next.length - 1)] || {
          question: '',
          options: [''],
          introTitle: '',
          introInfo: '',
          introMessage: '',
        },
      }));
      return next;
    });
  };

  const removeOption = (index: number) => {
    setOptions((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setFollowUps((current) => {
        const nextFollowUps: Record<string, FollowUpConfig> = {};
        next.forEach((_, idx) => {
          const sourceIndex = idx >= index ? idx + 1 : idx;
          const source = current[String(sourceIndex)];
          if (source) {
            nextFollowUps[String(idx)] = source;
          }
        });
        return nextFollowUps;
      });
      setFollowUpFiles((current) => {
        const nextFiles: Record<string, File | null> = {};
        next.forEach((_, idx) => {
          const sourceIndex = idx >= index ? idx + 1 : idx;
          if (current[String(sourceIndex)]) {
            nextFiles[String(idx)] = current[String(sourceIndex)] || null;
          }
        });
        return nextFiles;
      });
      return next;
    });
  };

  const updateFollowUpQuestion = (index: number, value: string) => {
    setFollowUps((prev) => ({
      ...prev,
      [String(index)]: {
        question: value,
        options: prev[String(index)]?.options || [''],
        introTitle: prev[String(index)]?.introTitle || '',
        introInfo: prev[String(index)]?.introInfo || '',
        introMessage: prev[String(index)]?.introMessage || '',
      },
    }));
  };

  const updateFollowUpIntro = (
    index: number,
    field: 'introTitle' | 'introInfo' | 'introMessage',
    value: string,
  ) => {
    setFollowUps((prev) => {
      const current = prev[String(index)] || { question: '', options: [''] };
      return {
        ...prev,
        [String(index)]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const updateFollowUpOptions = (index: number, valueIndex: number, value: string) => {
    setFollowUps((prev) => {
      const current = prev[String(index)] || { question: '', options: [''] };
      const optionsList = current.options.map((item, idx) => (idx === valueIndex ? value : item));
      return {
        ...prev,
        [String(index)]: {
          question: current.question,
          options: optionsList,
          introTitle: current.introTitle || '',
          introInfo: current.introInfo || '',
          introMessage: current.introMessage || '',
        },
      };
    });
  };

  const addFollowUpOption = (index: number) => {
    setFollowUps((prev) => {
      const current = prev[String(index)] || { question: '', options: [''] };
      return {
        ...prev,
        [String(index)]: {
          question: current.question,
          options: [...current.options, ''],
          introTitle: current.introTitle || '',
          introInfo: current.introInfo || '',
          introMessage: current.introMessage || '',
        },
      };
    });
  };

  const updateFollowUpFile = (index: number, fileValue: File | null) => {
    setFollowUpFiles((prev) => ({
      ...prev,
      [String(index)]: fileValue,
    }));
  };

  const handleSend = async () => {
    if (!token) {
      setStatus('Token nao disponivel');
      return;
    }

    const cleanedOptions = options.map((option) => option.trim()).filter(Boolean);
    const normalizedFollowUps = Object.entries(followUps).reduce(
      (acc, [key, value]) => {
        const questionValue = value.question?.trim() || '';
        const cleanedFollowOptions = (value.options || [])
          .map((option) => option.trim())
          .filter(Boolean);

        const withMenuReturn = includeMenuReturn
          ? cleanedFollowOptions.includes('Voltar ao menu principal')
            ? cleanedFollowOptions
            : [...cleanedFollowOptions, 'Voltar ao menu principal']
          : cleanedFollowOptions;

        if (questionValue && withMenuReturn.length >= 2) {
          acc[key] = {
            question: questionValue,
            options: withMenuReturn,
            introTitle: value.introTitle?.trim() || undefined,
            introInfo: value.introInfo?.trim() || undefined,
            introMessage: value.introMessage?.trim() || undefined,
          };
        }

        return acc;
      },
      {} as Record<string, FollowUpConfig>,
    );

    if (!name.trim() || !question.trim() || cleanedOptions.length < 2) {
      setStatus('Preencha nome, pergunta e no minimo 2 opcoes');
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
          introTitle,
          introInfo,
          introMessage,
          question,
          options: cleanedOptions,
          followUps: Object.keys(normalizedFollowUps).length ? normalizedFollowUps : undefined,
          useNative,
          autoStart,
        }),
      });

      if (!pollResponse.ok) {
        throw new Error('Falha ao criar enquete');
      }

      const poll = await pollResponse.json();
      setPollId(poll.id);

      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(`${api}/polls/${poll.id}/intro-file`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Falha ao anexar arquivo da introducao');
        }
      }

      const followUpFileEntries = Object.entries(followUpFiles);
      for (const [index, followUpFile] of followUpFileEntries) {
        if (!followUpFile || !normalizedFollowUps[index]) continue;

        const formData = new FormData();
        formData.append('file', followUpFile);

        const uploadResponse = await fetch(
          `${api}/polls/${poll.id}/followup-file/${index}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error('Falha ao anexar arquivo do submenu');
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Apresentacao</label>
              <input
                value={introTitle}
                onChange={(event) => setIntroTitle(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Informacao</label>
              <textarea
                value={introInfo}
                onChange={(event) => setIntroInfo(event.target.value)}
                rows={2}
                className={textAreaClass}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem</label>
              <textarea
                value={introMessage}
                onChange={(event) => setIntroMessage(event.target.value)}
                rows={3}
                className={textAreaClass}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pergunta do menu principal
              </label>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Opcoes</label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      className={inputClass}
                      placeholder={`Opcao ${index + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-sm text-red-500"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-sm text-whatsapp hover:text-whatsapp-dark"
              >
                + Adicionar opcao
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Arquivo (opcional)</label>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="text-xs text-slate-600"
              />
              {file?.name && (
                <p className="mt-1 text-xs text-slate-500">{file.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Submenus por opcao</label>
              <div className="space-y-4">
                {options.map((option, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        Submenu: {option || `Opcao ${index + 1}`}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <input
                        value={followUps[String(index)]?.introTitle || ''}
                        onChange={(event) =>
                          updateFollowUpIntro(index, 'introTitle', event.target.value)
                        }
                        placeholder="Titulo do submenu"
                        className={inputClass}
                      />
                      <input
                        value={followUps[String(index)]?.introInfo || ''}
                        onChange={(event) =>
                          updateFollowUpIntro(index, 'introInfo', event.target.value)
                        }
                        placeholder="Informacao curta"
                        className={inputClass}
                      />
                    </div>

                    <textarea
                      value={followUps[String(index)]?.introMessage || ''}
                      onChange={(event) =>
                        updateFollowUpIntro(index, 'introMessage', event.target.value)
                      }
                      placeholder="Mensagem adicional do submenu"
                      rows={2}
                      className={`${textAreaClass} mt-3`}
                    />

                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-slate-500 mb-2">
                        Arquivo do submenu (opcional)
                      </label>
                      <input
                        type="file"
                        onChange={(event) =>
                          updateFollowUpFile(index, event.target.files?.[0] || null)
                        }
                        className="text-xs text-slate-600"
                      />
                      {followUpFiles[String(index)]?.name && (
                        <p className="mt-1 text-xs text-slate-500">
                          {followUpFiles[String(index)]?.name}
                        </p>
                      )}
                    </div>

                    <input
                      value={followUps[String(index)]?.question || ''}
                      onChange={(event) => updateFollowUpQuestion(index, event.target.value)}
                      placeholder="Pergunta da enquete seguinte"
                      className={`${inputClass} mt-4`}
                    />

                    <div className="mt-3 space-y-2">
                      {(followUps[String(index)]?.options || ['']).map((value, optionIndex) => (
                        <input
                          key={optionIndex}
                          value={value}
                          onChange={(event) =>
                            updateFollowUpOptions(index, optionIndex, event.target.value)
                          }
                          placeholder={`Opcao ${optionIndex + 1}`}
                          className={inputClass}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addFollowUpOption(index)}
                      className="mt-3 text-sm font-semibold text-amber-700"
                    >
                      + Adicionar opcao
                    </button>
                  </div>
                ))}
              </div>
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
                  checked={includeMenuReturn}
                  onChange={(event) => setIncludeMenuReturn(event.target.checked)}
                />
                Adicionar opcao "Voltar ao menu principal" nos submenus
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useNative}
                onChange={(event) => setUseNative(event.target.checked)}
              />
              Usar enquete nativa (envia tambem fallback 1/2/3)
            </label>

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
