'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  notes?: string | null;
  customFields?: { tags?: string[] } | null;
  avatarUrl?: string | null;
  tags?: { tag: { name: string } }[];
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  jid?: string | null;
};

type Group = {
  id: string;
  name: string;
  participantCount: number;
  whatsappGroupId?: string | null;
};

type ChatMessage = {
  id: string;
  from: 'lead' | 'me';
  text: string;
  timestamp: string;
  serverMessageId?: string;
};

type Conversation = {
  id: string;
  leadId?: string | null;
  groupId?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lead?: Lead | null;
  group?: Group | null;
  messages?: Array<{
    id: string;
    text?: string | null;
    type: string;
    direction: 'INCOMING' | 'OUTGOING';
    status?: string;
    createdAt: string;
    attachments?: Array<{ fileName: string }>;
  }>;
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

const emojiList = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😴',
  '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥', '🎉', '❤️',
  '💚', '💙', '💯', '✨',
];

export default function LeadsPage() {
  const { token } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase
    ? apiBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3000';
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsByLeadId, setConversationsByLeadId] = useState<Record<string, Conversation>>({});
  const [conversationsByGroupId, setConversationsByGroupId] = useState<Record<string, Conversation>>({});
  const [conversationsByPhone, setConversationsByPhone] = useState<Record<string, Conversation>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncAttempted, setSyncAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState<'contatos' | 'grupos'>('contatos');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ConversationTarget | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [notesByLead, setNotesByLead] = useState<Record<string, string>>({});
  const [tagsByLead, setTagsByLead] = useState<Record<string, string[]>>({});
  const [pipeline, setPipeline] = useState(stageDefaults);
  const [editPipeline, setEditPipeline] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [messagesByTarget, setMessagesByTarget] = useState<Record<string, ChatMessage[]>>({});
  const [messagesVisibleCount, setMessagesVisibleCount] = useState<number>(25);
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastIncomingByTargetRef = useRef<Record<string, string>>({});
  const initializedTargetsRef = useRef<Set<string>>(new Set());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [unreadByLeadId, setUnreadByLeadId] = useState<Record<string, boolean>>({});
  const [unreadByGroupId, setUnreadByGroupId] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState('');

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      await fetchSelfProfilePicture();
      const list = await fetchLeads(headers);
      await fetchGroups(headers);
      await fetchConversations(headers);

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

  const fetchSelfProfilePicture = async () => {
    if (!token || selfAvatarUrl) return;
    try {
      const response = await fetch(`${api}/whatsapp/profile-picture?to=me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.url) {
        setSelfAvatarUrl(data.url);
      }
    } catch (err) {
      // Ignore self avatar failures.
    }
  };

  const fetchLeads = async (headers: Record<string, string>) => {
    const [contactsResponse, leadsResponse] = await Promise.all([
      fetch(`${api}/whatsapp/contacts`, { headers }),
      fetch(`${api}/crm/leads`, { headers }),
    ]);

    let contactsList: any[] = [];
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      contactsList = Array.isArray(contactsData) ? contactsData : [];
    } else {
      setError('Erro ao carregar contatos do WhatsApp');
    }

    const leadsData = leadsResponse.ok ? await leadsResponse.json() : [];
    if (!leadsResponse.ok) {
      setError('Erro ao carregar leads do CRM');
    }
    const leadsList = Array.isArray(leadsData) ? leadsData : [];
    const leadsByPhone = new Map<string, Lead>();
    leadsList.forEach((lead: Lead) => {
      if (lead.phoneNumber) {
        leadsByPhone.set(lead.phoneNumber, lead);
      }
    });

    const merged: Lead[] = contactsList.map((contact: any) => {
      const leadMatch = contact.phoneNumber ? leadsByPhone.get(contact.phoneNumber) : undefined;
      const fallbackName = contact.phoneNumber || contact.name || 'Contato';
      return {
        id: leadMatch?.id || contact.id,
        name: leadMatch?.name || fallbackName,
        phoneNumber: leadMatch?.phoneNumber || contact.phoneNumber,
        email: leadMatch?.email || null,
        pipelineStage: leadMatch?.pipelineStage || 'Novo',
        optIn: leadMatch?.optIn ?? true,
        origin: leadMatch?.origin || null,
        responsibleUser: leadMatch?.responsibleUser || null,
        notes: leadMatch?.notes || null,
        customFields: leadMatch?.customFields || null,
        avatarUrl: leadMatch?.avatarUrl || null,
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
    const nextTags: Record<string, string[]> = {};
    const nextNotes: Record<string, string> = {};
    merged.forEach((lead) => {
      const storedTags = lead.customFields?.tags || [];
      if (storedTags.length) {
        nextTags[lead.id] = storedTags;
      }
      if (lead.notes) {
        nextNotes[lead.id] = lead.notes;
      }
    });
    setTagsByLead(nextTags);
    setNotesByLead(nextNotes);
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

  const fetchConversations = async (headers: Record<string, string>) => {
    const response = await fetch(`${api}/crm/conversations`, { headers });
    if (!response.ok) {
      setError('Erro ao carregar conversas');
      return [] as Conversation[];
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    setConversations(list as Conversation[]);

    const byLead: Record<string, Conversation> = {};
    const byGroup: Record<string, Conversation> = {};
    const byPhone: Record<string, Conversation> = {};
    const unreadLeads: Record<string, boolean> = {};
    const unreadGroups: Record<string, boolean> = {};
    list.forEach((conversation: Conversation) => {
      if (conversation.leadId) {
        byLead[conversation.leadId] = conversation;
      }
      if (conversation.groupId) {
        byGroup[conversation.groupId] = conversation;
      }
      if (conversation.lead?.phoneNumber) {
        byPhone[conversation.lead.phoneNumber] = conversation;
      }
      const lastMessage = conversation.messages?.[0];
      const hasUnread =
        lastMessage?.direction === 'INCOMING' &&
        lastMessage?.status !== 'READ';
      if (conversation.leadId) {
        unreadLeads[conversation.leadId] = hasUnread;
      }
      if (conversation.groupId) {
        unreadGroups[conversation.groupId] = hasUnread;
      }
    });
    setConversationsByLeadId(byLead);
    setConversationsByGroupId(byGroup);
    setConversationsByPhone(byPhone);
    setUnreadByLeadId(unreadLeads);
    setUnreadByGroupId(unreadGroups);

    return list as Conversation[];
  };

  const markConversationRead = async (
    conversationId: string,
    target: ConversationTarget,
  ) => {
    if (!token) return;
    try {
      await fetch(`${api}/crm/conversations/${conversationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (target.type === 'contact') {
        setUnreadByLeadId((prev) => ({ ...prev, [target.id]: false }));
      } else {
        setUnreadByGroupId((prev) => ({ ...prev, [target.id]: false }));
      }
    } catch (err) {
      // Ignore read sync errors.
    }
  };

  const updateLead = async (leadId: string, data: Partial<Lead>) => {
    if (!token) return;
    try {
      await fetch(`${api}/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      setStatus('Nao foi possivel salvar os dados do lead');
    }
  };

  const loadConversationMessages = async (
    conversationId: string,
    targetKey: string,
  ) => {
    if (!token) return;
    const response = await fetch(`${api}/crm/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const mapped = messages
      .slice()
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return aTime - bTime;
      })
      .map((message: any) => {
      const attachmentLabel = message.attachments?.length
        ? `[Arquivo] ${message.attachments[0]?.fileName || ''}`.trim()
        : null;
      return {
        id: message.id,
        from: message.direction === 'OUTGOING' ? 'me' : 'lead',
        text: message.text || attachmentLabel || `[${message.type}]`,
        timestamp: message.createdAt,
        serverMessageId: message.id,
      } as ChatMessage;
    });

    const lastIncoming = [...mapped].reverse().find((item) => item.from === 'lead');
    if (lastIncoming) {
      const previous = lastIncomingByTargetRef.current[targetKey];
      const isInitialized = initializedTargetsRef.current.has(targetKey);
      if (isInitialized && previous && previous !== lastIncoming.id) {
        const playSound = true;
        if (playSound) {
          try {
            const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
            if (!audioContextRef.current && AudioContextCtor) {
              audioContextRef.current = new AudioContextCtor();
            }
            const ctx = audioContextRef.current;
            if (ctx) {
              const oscillator = ctx.createOscillator();
              const gainNode = ctx.createGain();
              gainNode.gain.value = 0.4;
              oscillator.type = 'sine';
              oscillator.frequency.value = 880;
              oscillator.connect(gainNode);
              gainNode.connect(ctx.destination);
              oscillator.start();
              oscillator.stop(ctx.currentTime + 0.16);
            }
          } catch (err) {
            // Ignore audio errors or blocked autoplay.
          }
        }
      }
      lastIncomingByTargetRef.current[targetKey] = lastIncoming.id;
      initializedTargetsRef.current.add(targetKey);
    }

    setMessagesByTarget((prev) => {
      const existing = prev[targetKey] || [];
      const pendingOptimistic = existing.filter((m) => !m.serverMessageId && m.from === 'me');

      const merged = mapped.map((m: ChatMessage) => {
        const found = existing.find((e) => e.serverMessageId && String(e.serverMessageId) === String(m.serverMessageId));
        if (found) {
          return {
            ...m,
            text: found.text || m.text,
            timestamp: found.timestamp || m.timestamp,
            serverMessageId: m.serverMessageId,
          } as ChatMessage;
        }
        return { ...m, serverMessageId: m.serverMessageId } as ChatMessage;
      });

      // append any optimistic messages that are still pending (no serverMessageId)
      const pendingToAdd = pendingOptimistic.filter((p) => !merged.some((mm: ChatMessage) => mm.id === p.id));

      return { ...prev, [targetKey]: [...merged, ...pendingToAdd] };
    });
    // Mostrar apenas as mensagens mais recentes inicialmente
    setMessagesVisibleCount(Math.min(25, mapped.length));
  };

  const fetchProfilePicture = async (target: ConversationTarget) => {
    if (!token || target.type !== 'contact') return;
    if (profilePhotos[target.id] !== undefined) return;
    const value = target.jid || target.phoneNumber;
    if (!value) return;
    const isValidTarget = value.includes('@') || /^\d{8,}$/.test(value);
    if (!isValidTarget) return;

    try {
      const response = await fetch(
        `${api}/whatsapp/profile-picture?to=${encodeURIComponent(value)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        setProfilePhotos((prev) => ({ ...prev, [target.id]: '' }));
        return;
      }
      const data = await response.json();
      if (data?.url) {
        setProfilePhotos((prev) => ({ ...prev, [target.id]: data.url }));
      } else {
        setProfilePhotos((prev) => ({ ...prev, [target.id]: '' }));
      }
    } catch (err) {
      setProfilePhotos((prev) => ({ ...prev, [target.id]: '' }));
    }
  };

  const fetchGroups = async (headers: Record<string, string>) => {
    const groupsResponse = await fetch(`${api}/whatsapp/groups`, { headers });
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
      const response = await fetch(`${api}/whatsapp/sync-contacts`, {
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

    const next = leads.filter((lead) => {
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
        ...(lead.customFields?.tags || []),
        ...(tagsByLead[lead.id] || []),
      ].map((tag) => tag.toLowerCase());
      const tagMatch = normalizedTag ? leadTags.some((tag) => tag.includes(normalizedTag)) : true;
      const unreadMatch = showUnreadOnly ? !!unreadByLeadId[lead.id] : true;
      return stageMatch && searchMatch && tagMatch && unreadMatch;
    });
    return next.sort((a, b) => {
      const convoA = conversationsByLeadId[a.id];
      const convoB = conversationsByLeadId[b.id];
      const aTime = new Date(convoA?.lastMessageAt || a.lastMessageAt || 0).getTime();
      const bTime = new Date(convoB?.lastMessageAt || b.lastMessageAt || 0).getTime();
      return bTime - aTime;
    });
  }, [
    leads,
    search,
    stageFilter,
    tagFilter,
    tagsByLead,
    showUnreadOnly,
    unreadByLeadId,
    conversationsByLeadId,
  ]);

  const filteredGroups = useMemo(() => {
    const next = showUnreadOnly
      ? groups.filter((group) => unreadByGroupId[group.id])
      : [...groups];
    return next.sort((a, b) => {
      const convoA = conversationsByGroupId[a.id];
      const convoB = conversationsByGroupId[b.id];
      const aTime = new Date(convoA?.lastMessageAt || 0).getTime();
      const bTime = new Date(convoB?.lastMessageAt || 0).getTime();
      return bTime - aTime;
    });
  }, [groups, showUnreadOnly, unreadByGroupId, conversationsByGroupId]);

  const selectedLead = useMemo(() => {
    if (selectedTarget?.type !== 'contact') return null;
    return leads.find((lead) => lead.id === selectedLeadId) || null;
  }, [leads, selectedLeadId, selectedTarget]);

  const chatMessages = useMemo(() => {
    if (!selectedTarget) return [];
    const key = `${selectedTarget.type}:${selectedTarget.id}`;
    return messagesByTarget[key] || [];
  }, [messagesByTarget, selectedTarget]);

  useEffect(() => {
    if (!chatMessages.length) return;
    if (isAtBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
    }
  }, [chatMessages.length, selectedTarget, isAtBottom]);

  const handleChatScroll = () => {
    const node = chatScrollRef.current;
    if (!node) return;
    const threshold = 80;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessages(false);
    }
  };

  const stageOptions = useMemo(() => {
    return pipeline.length ? pipeline : stageDefaults;
  }, [pipeline]);

  const handleSendMessage = async () => {
    console.debug('handleSendMessage start', { selectedTarget, tokenPresent: !!token, messageInput, messageFile, sending });
    if (!selectedTarget || !token) {
      console.debug('handleSendMessage blocked: missing token or target', { selectedTarget, token });
      return;
    }
    if (!messageInput.trim() && !messageFile) {
      console.debug('handleSendMessage blocked: empty message and no file');
      return;
    }
    if (sending) {
      console.debug('handleSendMessage blocked: already sending');
      return;
    }

    const text = messageInput.trim();
    const key = `${selectedTarget.type}:${selectedTarget.id}`;
    let targetValue = '';
    if (selectedTarget.type === 'group') {
      // groups may have a jid or an id that providers understand
      targetValue = selectedTarget.jid || selectedTarget.id || '';
    } else {
      // contacts: prefer phoneNumber, then jid; never use internal DB id as destination
      if (selectedTarget.phoneNumber && String(selectedTarget.phoneNumber).trim()) {
        targetValue = selectedTarget.phoneNumber;
      } else if (selectedTarget.jid && String(selectedTarget.jid).includes('@')) {
        targetValue = selectedTarget.jid;
      } else {
        targetValue = '';
      }
    }

    // fallback: try to resolve phoneNumber from existing conversations if missing
    if (!targetValue && selectedTarget.type === 'contact') {
      const convo = conversationsByLeadId[selectedTarget.id] ||
        (selectedTarget.phoneNumber ? conversationsByPhone[selectedTarget.phoneNumber] : undefined);
      if (convo?.lead?.phoneNumber) {
        targetValue = convo.lead.phoneNumber;
        console.debug('Resolved targetValue from conversation', { targetValue, convoId: convo.id });
      }
    }

    // Accept any non-empty targetValue. backend will resolve JID/phone when possible.
    if (!targetValue) {
      console.debug('Invalid target for send: empty targetValue', { targetValue, selectedTarget });
      setStatus('Contato sem numero do WhatsApp para envio');
      return;
    }

    const optimisticText = messageFile
      ? text || `[Arquivo] ${messageFile.name}`
      : text;

    const optimisticId = `${selectedTarget.id}-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: optimisticId,
      from: 'me',
      text: optimisticText,
      timestamp: new Date().toISOString(),
    };

    setMessagesByTarget((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newMessage],
    }));
    setMessageInput('');
    setSending(true);

    try {
      if (messageFile) {
        const formData = new FormData();
        formData.append('file', messageFile);
        formData.append('to', targetValue);
        if (text) {
          formData.append('caption', text);
        }

        const mediaUrl = `${api}/whatsapp/send-media`;
        console.debug('Sending media to', mediaUrl, { to: targetValue, caption: text, fileName: messageFile?.name });
        const response = await fetch(mediaUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        const mediaBody = await response.json().catch(() => null);
        console.debug('send-media response', { status: response.status, body: mediaBody });
        if (!response.ok) {
          let txt = '';
          try { txt = await response.text(); } catch (e) {}
          console.debug('send-media response body (text fallback)', txt);
          setStatus('Nao foi possivel enviar o arquivo');
        } else if (mediaBody?.conversationId) {
          const convoId = mediaBody.conversationId;
          setSelectedConversationId(convoId);
          // update optimistic message timestamp/messageId if provider returned them
          if (mediaBody?.timestamp) {
            try {
              const normalized = new Date(mediaBody.timestamp).toISOString();
              setMessagesByTarget((prev) => {
                const list = [...(prev[key] || [])];
                const idx = list.findIndex((m) => m.id === optimisticId);
                if (idx >= 0) {
                  list[idx] = { ...list[idx], timestamp: normalized, serverMessageId: mediaBody.messageId || list[idx].serverMessageId } as ChatMessage;
                }
                return { ...prev, [key]: list };
              });
            } catch (e) {
              // ignore invalid timestamp
            }
          }
          await loadConversationMessages(convoId, key);
        }
      } else {
        const textUrl = `${api}/whatsapp/send-text`;
        const payload = { to: targetValue, text };
        console.debug('Sending text to', textUrl, { payload });
        const response = await fetch(textUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const textBody = await response.json().catch(() => null);
        console.debug('send-text response', { status: response.status, body: textBody });
        if (!response.ok) {
          let body = '';
          try { body = await response.text(); } catch (e) {}
          console.debug('send-text response body', body);
          setStatus('Nao foi possivel enviar a mensagem');
        } else if (textBody?.conversationId) {
          const convoId = textBody.conversationId;
          setSelectedConversationId(convoId);
          // update optimistic message timestamp/messageId if provider returned them
          if (textBody?.timestamp) {
            try {
              const normalized = new Date(textBody.timestamp).toISOString();
              setMessagesByTarget((prev) => {
                const list = [...(prev[key] || [])];
                const idx = list.findIndex((m) => m.id === optimisticId);
                if (idx >= 0) {
                  list[idx] = { ...list[idx], timestamp: normalized, serverMessageId: textBody.messageId || list[idx].serverMessageId } as ChatMessage;
                }
                return { ...prev, [key]: list };
              });
            } catch (e) {
              // ignore invalid timestamp
            }
          }
          await loadConversationMessages(convoId, key);
        }
      }

      const refreshed = await fetchConversations({ Authorization: `Bearer ${token}` });
      console.debug('refreshed conversations count', Array.isArray(refreshed) ? refreshed.length : typeof refreshed, refreshed?.slice?.(0,5));

      if (selectedTarget.type === 'contact') {
        const convo = refreshed.find(
          (item) =>
            item.leadId === selectedTarget.id ||
            (selectedTarget.phoneNumber && item.lead?.phoneNumber === selectedTarget.phoneNumber),
        );
        console.debug('found convo for contact', { convo });
        if (convo?.id) {
          setSelectedConversationId(convo.id);
          await loadConversationMessages(convo.id, key);
        }
      }

      if (selectedTarget.type === 'group') {
        const convo = refreshed.find((item) => item.groupId === selectedTarget.id);
        console.debug('found convo for group', { convo });
        if (convo?.id) {
          setSelectedConversationId(convo.id);
          await loadConversationMessages(convo.id, key);
        }
      }
    } catch (err) {
      console.error('handleSendMessage error', err);
      setStatus('Erro ao enviar mensagem');
    } finally {
      setMessageFile(null);
      setSending(false);
    }
  };

  const handleAddTag = (value: string) => {
    if (!selectedLead || !value.trim()) return;
    const nextTag = value.trim();
    setTagsByLead((prev) => {
      const existing = prev[selectedLead.id] || [];
      if (existing.includes(nextTag)) return prev;
      const nextTags = [...existing, nextTag];
      updateLead(selectedLead.id, {
        customFields: {
          ...(selectedLead.customFields || {}),
          tags: nextTags,
        },
      });
      return { ...prev, [selectedLead.id]: nextTags };
    });
  };

  const handleRemoveTag = (tag: string) => {
    if (!selectedLead) return;
    setTagsByLead((prev) => {
      const existing = prev[selectedLead.id] || [];
      const nextTags = existing.filter((item) => item !== tag);
      updateLead(selectedLead.id, {
        customFields: {
          ...(selectedLead.customFields || {}),
          tags: nextTags,
        },
      });
      return { ...prev, [selectedLead.id]: nextTags };
    });
  };

  const handlePipelineRename = (index: number, value: string) => {
    setPipeline((prev) => prev.map((stage, idx) => (idx === index ? value : stage)));
  };

  useEffect(() => {
    if (!selectedTarget) return;
    setIsAtBottom(true);
    setHasNewMessages(false);
    fetchProfilePicture(selectedTarget);

    if (selectedTarget.type === 'contact') {
      const conversation =
        conversationsByLeadId[selectedTarget.id] ||
        (selectedTarget.phoneNumber
          ? conversationsByPhone[selectedTarget.phoneNumber]
          : undefined);
      const targetKey = `contact:${selectedTarget.id}`;
      if (conversation?.id) {
        setSelectedConversationId(conversation.id);
        loadConversationMessages(conversation.id, targetKey);
        markConversationRead(conversation.id, selectedTarget);
      } else {
        setSelectedConversationId(null);
        setMessagesByTarget((prev) => ({ ...prev, [targetKey]: [] }));
      }
    } else {
      const conversation = conversationsByGroupId[selectedTarget.id];
      const targetKey = `group:${selectedTarget.id}`;
      if (conversation?.id) {
        setSelectedConversationId(conversation.id);
        loadConversationMessages(conversation.id, targetKey);
        markConversationRead(conversation.id, selectedTarget);
      } else {
        setSelectedConversationId(null);
        setMessagesByTarget((prev) => ({ ...prev, [targetKey]: [] }));
      }
    }
    // reset visible messages when switching target
    setMessagesVisibleCount(25);
  }, [selectedTarget, conversationsByLeadId, conversationsByGroupId]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const interval = setInterval(async () => {
      const refreshed = await fetchConversations(headers);
      if (!selectedTarget) return;

      const key = `${selectedTarget.type}:${selectedTarget.id}`;
      if (selectedTarget.type === 'contact') {
        const convo = refreshed.find(
          (item) =>
            item.leadId === selectedTarget.id ||
            (selectedTarget.phoneNumber && item.lead?.phoneNumber === selectedTarget.phoneNumber),
        );
        if (convo?.id) {
          setSelectedConversationId(convo.id);
          await loadConversationMessages(convo.id, key);
        }
        return;
      }

      const convo = refreshed.find((item) => item.groupId === selectedTarget.id);
      if (convo?.id) {
        setSelectedConversationId(convo.id);
        await loadConversationMessages(convo.id, key);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, selectedConversationId, selectedTarget]);

  useEffect(() => {
    if (!token || leads.length === 0) return;
    leads.slice(0, 12).forEach((lead) => {
      fetchProfilePicture({
        type: 'contact',
        id: lead.id,
        name: lead.name,
        phoneNumber: lead.phoneNumber,
        jid: lead.jid,
      });
    });
  }, [token, leads]);

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
                <div className="h-9 w-9 rounded-full bg-[#00a884] flex items-center justify-center text-xs font-semibold overflow-hidden">
                  {selfAvatarUrl ? (
                    <img src={selfAvatarUrl} alt="Perfil" className="h-full w-full object-cover" />
                  ) : (
                    'CRM'
                  )}
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
                  onClick={() => setShowUnreadOnly((prev) => !prev)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                    showUnreadOnly
                      ? 'border-[#00a884] text-[#00a884]'
                      : 'border-[#202c33] text-slate-400'
                  }`}
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
                  {filteredGroups.length === 0 ? 'Nenhum grupo sincronizado.' : ''}
                  <div className="space-y-3">
                    {filteredGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          setSelectedTarget({
                            type: 'group',
                            id: group.id,
                            name: group.name,
                            jid: group.whatsappGroupId || group.id,
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
                        {unreadByGroupId[group.id] && (
                          <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                        )}
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
                    const conversation = conversationsByLeadId[lead.id];
                    const lastMessage =
                      conversation?.lastMessage || lead.lastMessage || 'Sem mensagens recentes';
                    const lastMessageAt = conversation?.lastMessageAt || lead.lastMessageAt;
                    const avatarUrl = profilePhotos[lead.id] || lead.avatarUrl;
                    const stageLabel = lead.pipelineStage || 'Novo';
                    const hasUnread = unreadByLeadId[lead.id];
                    const tagList = [
                      ...(lead.tags || []).map((item) => item.tag.name),
                      ...(lead.customFields?.tags || []),
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
                          <div className="h-10 w-10 rounded-full bg-[#2a3942] text-white flex items-center justify-center overflow-hidden text-sm font-semibold">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={lead.name} className="h-full w-full object-cover" />
                            ) : (
                              lead.name?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{lead.name}</p>
                            <p className="text-xs text-slate-400">
                              {lastMessage}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">
                              {lastMessageAt
                                ? new Date(lastMessageAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            {hasUnread && (
                              <span className="mt-1 block h-2 w-2 rounded-full bg-[#00a884] ml-auto" />
                            )}
                          </div>
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
                  <div className="h-9 w-9 rounded-full bg-[#2a3942] flex items-center justify-center overflow-hidden text-sm font-semibold">
                    {selectedTarget.type === 'contact' && profilePhotos[selectedTarget.id] ? (
                      <img
                        src={profilePhotos[selectedTarget.id]}
                        alt={selectedTarget.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      selectedTarget.name?.slice(0, 2).toUpperCase()
                    )}
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

            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="wa-chat-bg relative flex-1 p-4 space-y-2 overflow-auto"
            >
              {selectedTarget && chatMessages.length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma mensagem ainda.</p>
              )}
              {
                // Mostrar apenas as ultimas `messagesVisibleCount` mensagens
                (() => {
                  const visible = chatMessages.slice(-messagesVisibleCount);
                  const hasMore = chatMessages.length > visible.length;
                  return (
                    <>
                      {hasMore && (
                        <div className="w-full text-center">
                          <button
                            type="button"
                            onClick={() => setMessagesVisibleCount((prev) => Math.min(prev + 25, chatMessages.length))}
                            className="mx-auto mb-2 inline-block rounded-full border border-[#202c33] bg-[#111b21] px-3 py-1 text-xs text-slate-300"
                          >
                            Ver mais mensagens
                          </button>
                        </div>
                      )}

                      {visible.map((message) => (
                        <div
                          key={message.id}
                          className={`max-w-[72%] rounded-md px-3 py-1 text-xs ${
                            message.from === 'me'
                              ? 'bg-[#005c4b] text-white ml-auto'
                              : 'bg-[#202c33] text-slate-100'
                          }`}
                        >
                          <p className="leading-tight">{message.text}</p>
                          <p className="mt-1 text-[10px] text-slate-300">
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </>
                  );
                })()
              }
              <div ref={chatEndRef} />
              {hasNewMessages && (
                <button
                  type="button"
                  onClick={() => {
                    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setHasNewMessages(false);
                    setIsAtBottom(true);
                  }}
                  className="sticky bottom-4 mx-auto block rounded-full bg-[#00a884] px-4 py-2 text-xs font-semibold text-[#0b141a] shadow-lg"
                >
                  Ver novas mensagens
                </button>
              )}
            </div>

            <div className="border-t border-[#202c33] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="text-slate-400"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                  >
                    😊
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-10 left-0 z-10 w-56 rounded-xl border border-[#202c33] bg-[#111b21] p-2 shadow-2xl">
                      <div className="grid grid-cols-8 gap-1">
                        {emojiList.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="rounded-md p-1 text-sm hover:bg-[#202c33]"
                            onClick={() => {
                              setMessageInput((prev) => `${prev}${emoji}`);
                              setShowEmojiPicker(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <label className="text-slate-400 cursor-pointer">
                  📎
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => setMessageFile(event.target.files?.[0] || null)}
                  />
                </label>
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Digite uma mensagem"
                  className="flex-1 rounded-2xl border border-[#202c33] bg-[#1f2a30] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending}
                  className="rounded-2xl bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] disabled:opacity-60"
                >
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              {messageFile && (
                <p className="mt-2 text-xs text-slate-400">Arquivo: {messageFile.name}</p>
              )}
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
                        if (selectedLead.id.includes('@')) {
                          setStatus('Sincronize o contato para salvar etapa.');
                          return;
                        }
                        updateLead(selectedLead.id, { pipelineStage: nextStage });
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
                      onBlur={(event) => {
                        if (selectedLead.id.includes('@')) {
                          setStatus('Sincronize o contato para salvar notas.');
                          return;
                        }
                        updateLead(selectedLead.id, { notes: event.target.value });
                      }}
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
