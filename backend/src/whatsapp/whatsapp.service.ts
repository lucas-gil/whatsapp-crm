import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../common/utils/logger.util';
import { WhatsAppProvider } from './providers/whatsapp.provider.interface';
import { WhatsAppWebQRProvider } from './providers/whatsapp-web-qr.provider';
import { WhatsAppCloudAPIProvider } from './providers/whatsapp-cloud-api.provider';

@Injectable()
export class WhatsAppService {
  private logger = new Logger('WhatsAppService');
  private providers: Map<string, WhatsAppProvider> = new Map();
  private defaultProvider: WhatsAppProvider;
  private eventCallbacks: Map<string, Set<Function>> = new Map();
  private recentJids: Map<string, Map<string, string>> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private webQRProvider: WhatsAppWebQRProvider,
    private cloudAPIProvider: WhatsAppCloudAPIProvider,
  ) {
    const providerType = this.configService.get('WHATSAPP_PROVIDER', 'web-qr');
    this.defaultProvider =
      providerType === 'cloud-api' ? cloudAPIProvider : webQRProvider;
  }

  /**
   * Inicializa a conexão WhatsApp
   */
  async initializeWorkspace(workspaceId: string) {
    try {
      this.logger.info(`🔄 Inicializando WhatsApp para workspace: ${workspaceId}`);

      const settings = await this.prisma.whatsAppSettings.upsert({
        where: { workspaceId },
        update: { isConnected: false },
        create: {
          workspaceId,
          provider: this.configService.get('WHATSAPP_PROVIDER', 'web-qr'),
          isConnected: false,
          pollsEnabled: true,
        },
      });

      this.logger.info(`💾 Configurações salvas no banco`);

      // Inicializar provider
      this.logger.info(`📱 Iniciando sessão Baileys...`);
      await this.defaultProvider.initSession(workspaceId, { forceNewSession: true });

      this.logger.info(`✅ Sessão Baileys inicializada`);

      // Registrar event handlers para este workspace
      this.setupEventListenersForWorkspace(workspaceId);

      this.logger.info(`✅ WhatsApp inicializado com sucesso para workspace: ${workspaceId}`);

      return settings;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`❌ Erro ao inicializar WhatsApp ${workspaceId}:`);
      this.logger.error(`   Mensagem: ${errorMessage}`);
      this.logger.error(`   Stack: ${errorStack}`);
      throw new Error(`Falha na inicialização: ${errorMessage}`);
    }
  }

  /**
   * Obter QR Code para conectar
   */
  async getQRCode(workspaceId: string): Promise<string | null> {
    this.logger.info(`🔍 Obtendo QR Code para ${workspaceId}`);
    const qr = await this.defaultProvider.getQRCode(workspaceId);
    
    if (!qr) {
      this.logger.warn(`⚠️ QR Code não disponível para ${workspaceId}`);
    } else {
      this.logger.info(`✅ QR Code obtido para ${workspaceId}`);
    }
    
    return qr;
  }

  /**
   * Verificar se está conectado
   */
  async isConnected(workspaceId: string): Promise<boolean> {
    const isConnected = await this.defaultProvider.isConnected(workspaceId);

    // Atualizar status no banco
    if (isConnected) {
      await this.prisma.whatsAppSettings.update({
        where: { workspaceId },
        data: {
          isConnected: true,
          lastConnectedAt: new Date(),
        },
      });
    }

    return isConnected;
  }

  /**
   * Desconectar
   */
  async disconnect(workspaceId: string): Promise<void> {
    await this.defaultProvider.disconnect(workspaceId);

    await this.prisma.whatsAppSettings.update({
      where: { workspaceId },
      data: {
        isConnected: false,
        lastDisconnectReason: 'user_disconnected',
      },
    });

    this.logger.info(`✋ Desconectado: ${workspaceId}`);
  }

  /**
   * Enviar mensagem de texto
   */
  async sendText(workspaceId: string, to: string, text: string) {
    const isConnected = await this.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    const messageId = await this.defaultProvider.sendText(workspaceId, to, text);

    // Registrar no banco
    await this.logMessage(workspaceId, to, text, 'text', messageId);

    return { messageId, status: 'sent', timestamp: new Date() };
  }

  /**
   * Enviar mídia (imagem, vídeo, áudio, documento)
   */
  async sendMedia(
    workspaceId: string,
    to: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ) {
    const isConnected = await this.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    const messageId = await this.defaultProvider.sendMedia(
      workspaceId,
      to,
      buffer,
      fileName,
      mimeType,
      caption,
    );

    await this.logMessage(workspaceId, to, caption || fileName, 'media', messageId);

    return { messageId, status: 'sent', timestamp: new Date() };
  }

  /**
   * Enviar enquete/poll
   */
  async sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ) {
    const isConnected = await this.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    const messageId = await this.defaultProvider.sendPoll(
      workspaceId,
      to,
      question,
      options,
    );

    await this.logMessage(workspaceId, to, question, 'poll', messageId);

    return { messageId, status: 'sent', timestamp: new Date() };
  }

  /**
   * Enviar campanha de enquete com introducao (texto/arquivo)
   */
  async sendPollCampaignMessage(
    workspaceId: string,
    campaign: any,
    targetJid: string,
    phoneNumber?: string,
    sendOptions?: { includeIntro?: boolean; sectionIndex?: number },
  ): Promise<string> {
    await this.ensurePollsEnabled(workspaceId);
    const resolvedTarget = this.resolveTargetJid(workspaceId, targetJid);
    this.logger.info(
      `🧭 Envio de enquete: target=${targetJid} resolved=${resolvedTarget} ` +
        `section=${sendOptions?.sectionIndex ?? 0}`,
    );
    const sections = Array.isArray(campaign.sections) ? campaign.sections : null;
    const sectionIndex = sendOptions?.sectionIndex ?? 0;

    if (sections?.length) {
      const section = sections[sectionIndex];
      if (!section?.options?.length) {
        throw new Error('Enquete sem opcoes');
      }

      if (sendOptions?.includeIntro !== false) {
        await this.sendIntroContent(workspaceId, resolvedTarget, {
          introTitle: section.title,
          introInfo: section.info,
          introMessage: section.message,
          introFilePath: section.introFilePath,
          introFileName: section.introFileName,
          introFileMime: section.introFileMime,
        });
      }

      const labels = section.options.map((option: any) => option.label);
      const pollResponse = campaign.useNative
        ? await this.sendPoll(workspaceId, resolvedTarget, section.question, labels)
        : await this.sendText(
            workspaceId,
            resolvedTarget,
            this.buildPollFallback(section.question, labels),
          );

      return pollResponse.messageId;
    }

    const pollOptions = Array.isArray(campaign.options) ? campaign.options : [];

    if (!pollOptions.length) {
      throw new Error('Enquete sem opcoes');
    }

    if (sendOptions?.includeIntro !== false) {
      await this.sendIntroContent(workspaceId, resolvedTarget, campaign);
    }

    const pollResponse = campaign.useNative
      ? await this.sendPoll(workspaceId, resolvedTarget, campaign.question, pollOptions)
      : await this.sendText(
          workspaceId,
          resolvedTarget,
          this.buildPollFallback(campaign.question, pollOptions),
        );

    return pollResponse.messageId;
  }

  /**
   * Listar grupos
   */
  async listGroups(workspaceId: string) {
    const isConnected = await this.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    return this.defaultProvider.listGroups(workspaceId);
  }

  /**
   * Listar contatos do WhatsApp conectado
   */
  async listContacts(workspaceId: string) {
    const isConnected = await this.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error('WhatsApp não está conectado');
    }

    const providerContacts = await this.defaultProvider.listContacts(workspaceId);
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId },
      select: { id: true, name: true, phoneNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const byPhone = new Map<string, any>();
    const recentJids = this.recentJids.get(workspaceId) || new Map();
    providerContacts.forEach((contact: any) => {
      if (!contact?.phoneNumber) return;
      byPhone.set(contact.phoneNumber, contact);
    });

    leads.forEach((lead) => {
      if (!byPhone.has(lead.phoneNumber)) {
        byPhone.set(lead.phoneNumber, {
          id: lead.id,
          name: lead.name || lead.phoneNumber,
          phoneNumber: lead.phoneNumber,
          jid: recentJids.get(lead.phoneNumber) || null,
        });
      }
    });

    return Array.from(byPhone.values()).map((contact) => {
      if (!contact?.jid && contact?.id && String(contact.id).includes('@')) {
        return { ...contact, jid: contact.id };
      }
      return contact;
    }).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'),
    );
  }

  /**
   * Sincronizar contatos para o CRM
   */
  async syncContacts(workspaceId: string) {
    let providerContacts: any[] = [];

    try {
      providerContacts = await this.defaultProvider.listContacts(workspaceId);
    } catch (error) {
      this.logger.warn(`⚠️ Falha ao carregar contatos do WhatsApp: ${error}`);
    }

    const messagePhones = await this.prisma.message.findMany({
      where: {
        workspaceId,
        senderPhoneNumber: { not: null },
      },
      select: { senderPhoneNumber: true },
      distinct: ['senderPhoneNumber'],
    });

    const phones = new Set<string>();
    messagePhones.forEach((item) => {
      if (item.senderPhoneNumber) {
        phones.add(item.senderPhoneNumber);
      }
    });
    providerContacts.forEach((contact) => {
      if (contact?.phoneNumber) {
        phones.add(contact.phoneNumber);
      }
    });

    let created = 0;

    for (const phoneNumber of phones) {
      const existing = await this.prisma.lead.findUnique({
        where: { workspaceId_phoneNumber: { workspaceId, phoneNumber } },
      });

      if (!existing) {
        const contact = providerContacts.find((c) => c.phoneNumber === phoneNumber);
        await this.prisma.lead.create({
          data: {
            workspaceId,
            phoneNumber,
            name: contact?.name || phoneNumber,
            origin: 'whatsapp_sync',
            optIn: true,
            optInDate: new Date(),
          },
        });
        created += 1;
      }
    }

    return {
      total: phones.size,
      created,
    };
  }

  /**
   * Testar conexão (mock - sempre true se conectado)
   */
  async testConnection(workspaceId: string): Promise<boolean> {
    return this.isConnected(workspaceId);
  }

  /**
   * Registrar listener para eventos
   */
  onEvent(workspaceId: string, eventType: string, callback: Function): void {
    const key = `${workspaceId}:${eventType}`;
    if (!this.eventCallbacks.has(key)) {
      this.eventCallbacks.set(key, new Set());
    }
    this.eventCallbacks.get(key)!.add(callback);
  }

  /**
   * Remover listener
   */
  offEvent(workspaceId: string, eventType: string, callback: Function): void {
    const key = `${workspaceId}:${eventType}`;
    this.eventCallbacks.get(key)?.delete(callback);
  }

  // ========== PRIVATE ==========

  /**
   * Configurar listeners no provider por workspace
   */
  private setupEventListenersForWorkspace(workspaceId: string): void {
    // QR Code
    this.defaultProvider.on(
      workspaceId,
      'qr',
      (payload: any) => {
        const key = `${workspaceId}:qr`;
        this.eventCallbacks.get(key)?.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error(`Erro ao executar callback de qr:`, error);
          }
        });
      },
    );

    // Connection status
    this.defaultProvider.on(
      workspaceId,
      'connection_status',
      (payload: any) => {
        const key = `${workspaceId}:connection_status`;
        this.eventCallbacks.get(key)?.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error(`Erro ao executar callback de connection_status:`, error);
          }
        });
        // Also handle internal status
        this.handleConnectionStatus(workspaceId, payload);
      },
    );

    // Message received
    this.defaultProvider.on(
      workspaceId,
      'message_received',
      (payload: any) => {
        const key = `${workspaceId}:message_received`;
        this.eventCallbacks.get(key)?.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error(`Erro ao executar callback de message_received:`, error);
          }
        });
        // Also handle internal
        this.handleMessageReceived(workspaceId, payload);
      },
    );

    // Message status
    this.defaultProvider.on(
      workspaceId,
      'message_status',
      (payload: any) => {
        const key = `${workspaceId}:message_status`;
        this.eventCallbacks.get(key)?.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error(`Erro ao executar callback de message_status:`, error);
          }
        });
        // Also handle internal
        this.handleMessageStatus(workspaceId, payload);
      },
    );

    // Message sent
    this.defaultProvider.on(
      workspaceId,
      'message_sent',
      (payload: any) => {
        const key = `${workspaceId}:message_sent`;
        this.eventCallbacks.get(key)?.forEach((callback) => {
          try {
            callback(payload);
          } catch (error) {
            this.logger.error(`Erro ao executar callback de message_sent:`, error);
          }
        });
        // Also handle internal
        this.handleMessageSent(workspaceId, payload);
      },
    );
  }

  /**
   * Manejar eventos específicos do WhatsApp
   */
  private async handleEvent(
    workspaceId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    try {
      switch (eventType) {
        case 'connection_status':
          await this.handleConnectionStatus(workspaceId, payload);
          break;
        case 'message_received':
          await this.handleMessageReceived(workspaceId, payload);
          break;
        case 'message_status':
          await this.handleMessageStatus(workspaceId, payload);
          break;
        case 'message_sent':
          await this.handleMessageSent(workspaceId, payload);
          break;
      }
    } catch (error) {
      this.logger.error(`Erro ao manejar evento ${eventType}:`, error);
    }
  }

  /**
   * Handle: Status da conexão mudou
   */
  private async handleConnectionStatus(workspaceId: string, payload: any): Promise<void> {
    const status = payload.status;
    this.logger.info(`🔄 Status de conexão: ${status}`);

    if (status === 'connected') {
      await this.prisma.whatsAppSettings.update({
        where: { workspaceId },
        data: {
          isConnected: true,
          lastConnectedAt: new Date(),
        },
      });
    } else if (status === 'disconnected') {
      await this.prisma.whatsAppSettings.update({
        where: { workspaceId },
        data: {
          isConnected: false,
          lastDisconnectReason: payload.reason,
        },
      });
    }
  }

  /**
   * Handle: Mensagem recebida
   */
  private async handleMessageReceived(workspaceId: string, payload: any): Promise<void> {
    const { from, messageId, text, type, timestamp } = payload;
    this.logger.info(`📥 Mensagem recebida de ${from}: ${text?.substring(0, 30)}`);

    try {
      // Encontrar ou criar lead/conversa
      const phoneNumber = this.normalizePhoneNumber(from);
      const normalizedFrom = this.normalizeJid(from);
      this.rememberJid(workspaceId, from);

      let lead = await this.prisma.lead.findFirst({
        where: {
          workspaceId,
          phoneNumber,
        },
      });

      if (!lead) {
        lead = await this.prisma.lead.create({
          data: {
            workspaceId,
            phoneNumber,
            name: phoneNumber,
            origin: 'whatsapp_incoming',
          },
        });
      }

      // Criar/atualizar conversa
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          workspaceId,
          leadId: lead.id,
          groupId: null,
        },
      });

      const isNewConversation = !existingConversation;

      const conversation = existingConversation
        ? await this.prisma.conversation.update({
            where: { id: existingConversation.id },
            data: {
              lastMessageAt: new Date(timestamp),
              lastMessage: text || `[${type}]`,
            },
          })
        : await this.prisma.conversation.create({
            data: {
              workspaceId,
              leadId: lead.id,
              groupId: null,
              lastMessageAt: new Date(timestamp),
              lastMessage: text || `[${type}]`,
            },
          });

      // Criar mensagem
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          workspaceId,
          whatsappMessageId: messageId,
          direction: 'INCOMING',
          text: text || `[${type}]`,
          type,
          senderPhoneNumber: phoneNumber,
          senderName: lead.name,
          status: 'SENT',
          createdAt: new Date(timestamp),
        },
      });

      this.logger.info(`✅ Mensagem salva: ${messageId}`);

      if (!from.endsWith('@g.us')) {
        await this.handleAutoPollStart(workspaceId, phoneNumber, normalizedFrom);
        await this.handlePollResponse(workspaceId, phoneNumber, text, normalizedFrom);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem recebida:`, error);
    }
  }

  /**
   * Handle: Status da mensagem mudou (entregue, lida)
   */
  private async handleMessageStatus(workspaceId: string, payload: any): Promise<void> {
    const { messageId, status } = payload;
    this.logger.debug(`📌 Status de mensagem: ${messageId} → ${status}`);

    try {
      // Map status codes to enum values
      const statusMap: any = {
        0: 'SENDING',
        1: 'SENT',
        2: 'DELIVERED',
        3: 'READ',
        4: 'FAILED',
      };
      const mappedStatus = statusMap[status] || 'SENT';

      await this.prisma.message.updateMany({
        where: {
          whatsappMessageId: messageId,
          workspaceId,
        },
        data: {
          status: mappedStatus,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Erro ao atualizar status de mensagem:`, error);
    }
  }

  /**
   * Handle: Mensagem enviada com sucesso
   */
  private async handleMessageSent(workspaceId: string, payload: any): Promise<void> {
    const { to, messageId, timestamp } = payload;
    this.logger.info(`✉️ Mensagem enviada para ${to}: ${messageId}`);

    try {
      await this.prisma.message.updateMany({
        where: {
          whatsappMessageId: messageId,
          workspaceId,
        },
        data: {
          status: 'SENT',
          updatedAt: new Date(timestamp),
        },
      });
    } catch (error) {
      this.logger.error(`Erro ao marcar mensagem como enviada:`, error);
    }
  }

  /**
   * Log mensagem no banco (para histórico)
   */
  private async logMessage(
    workspaceId: string,
    to: string,
    text: string,
    type: string,
    messageId: string,
  ): Promise<void> {
    try {
      if (to.endsWith('@g.us')) {
        return;
      }

      const phoneNumber = this.normalizePhoneNumber(to);
      const lead = await this.prisma.lead.upsert({
        where: {
          workspaceId_phoneNumber: {
            workspaceId,
            phoneNumber,
          },
        },
        update: {},
        create: {
          workspaceId,
          phoneNumber,
          name: phoneNumber,
          origin: 'whatsapp_outgoing',
          optIn: true,
          optInDate: new Date(),
        },
      });

      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          workspaceId,
          leadId: lead.id,
          groupId: null,
        },
      });

      const conversation = existingConversation
        ? await this.prisma.conversation.update({
            where: { id: existingConversation.id },
            data: {
              lastMessageAt: new Date(),
              lastMessage: text || `[${type}]`,
            },
          })
        : await this.prisma.conversation.create({
            data: {
              workspaceId,
              leadId: lead.id,
              groupId: null,
              lastMessageAt: new Date(),
              lastMessage: text || `[${type}]`,
            },
          });

      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          workspaceId,
          whatsappMessageId: messageId,
          direction: 'OUTGOING',
          text: text,
          type: type,
          status: 'SENT',
          createdAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Erro ao logar mensagem:`, error);
    }
  }

  private async handlePollResponse(
    workspaceId: string,
    phoneNumber: string,
    text?: string,
    fromJid?: string,
  ): Promise<void> {
    if (!text) return;

    const trimmed = text.trim();
    const optionIndex = Number.parseInt(trimmed, 10);

    if (!Number.isFinite(optionIndex)) {
      return;
    }

    const recipient = await this.prisma.pollRecipient.findFirst({
      where: {
        phoneNumber,
        status: 'SENT',
      },
      orderBy: { sentAt: 'desc' },
      include: { campaign: true },
    });

    if (!recipient) return;

    const sections = Array.isArray(recipient.campaign.sections)
      ? (recipient.campaign.sections as any[])
      : null;
    const selectedIndex = optionIndex - 1;

    let selectedOptionLabel = '';
    let nextSectionIndex: number | null | undefined = undefined;
    let selectedOptionReply: {
      introTitle?: string | null;
      introInfo?: string | null;
      introMessage?: string | null;
      introFilePath?: string | null;
      introFileName?: string | null;
      introFileMime?: string | null;
    } | null = null;

    if (sections?.length) {
      const currentSection = sections[recipient.flowStep ?? 0];
      const sectionOptions = currentSection?.options || [];

      if (selectedIndex < 0 || selectedIndex >= sectionOptions.length) {
        return;
      }

      const selectedOption = sectionOptions[selectedIndex];
      if (!selectedOption) {
        return;
      }

      selectedOptionLabel = selectedOption.label || '';
      nextSectionIndex = selectedOption.nextSection;
      selectedOptionReply = {
        introTitle: selectedOption.replyTitle,
        introInfo: selectedOption.replyInfo,
        introMessage: selectedOption.replyMessage,
        introFilePath: selectedOption.replyFilePath,
        introFileName: selectedOption.replyFileName,
        introFileMime: selectedOption.replyFileMime,
      };
    } else {
      const options = Array.isArray(recipient.campaign.options)
        ? (recipient.campaign.options as string[])
        : [];

      if (selectedIndex < 0 || selectedIndex >= options.length) {
        return;
      }

      const selectedOption = options[selectedIndex];

      if (!selectedOption) {
        return;
      }

      selectedOptionLabel = selectedOption;
    }

    const isMenuReturn = this.isMenuReturnOption(selectedOptionLabel);
    const isCancelOption = this.isCancelOption(selectedOptionLabel);

    await this.prisma.pollInteraction.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        fromJid: this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
        selectedIndex,
        selectedOption: selectedOptionLabel,
        rawText: text,
        flowStep: recipient.flowStep,
      },
    });

    await this.prisma.pollRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'RESPONDED',
        respondedAt: new Date(),
      },
    });

    if (isMenuReturn) {
      const messageId = await this.sendPollCampaignMessage(
        workspaceId,
        recipient.campaign,
        this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
        phoneNumber,
        { includeIntro: false, sectionIndex: 0 },
      );

      await this.prisma.pollRecipient.create({
        data: {
          campaignId: recipient.campaignId,
          targetJid: this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
          phoneNumber,
          targetType: 'contact',
          pollMessageId: messageId,
          status: 'SENT',
          flowStep: 0,
          parentRecipientId: recipient.id,
        },
      });

      return;
    }

    if (isCancelOption) {
      return;
    }

    if (selectedOptionReply) {
      const hasReplyContent =
        selectedOptionReply.introTitle ||
        selectedOptionReply.introInfo ||
        selectedOptionReply.introMessage ||
        selectedOptionReply.introFilePath;

      if (hasReplyContent) {
        await this.sendIntroContent(
          workspaceId,
          this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
          selectedOptionReply,
        );
      }
    }

    if (sections?.length) {
      if (typeof nextSectionIndex !== 'number') {
        return;
      }

      const nextSection = sections[nextSectionIndex];
      if (!nextSection?.options?.length) {
        return;
      }

      const messageId = await this.sendPollCampaignMessage(
        workspaceId,
        recipient.campaign,
        this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
        phoneNumber,
        { sectionIndex: nextSectionIndex },
      );

      await this.prisma.pollRecipient.create({
        data: {
          campaignId: recipient.campaignId,
          targetJid: this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
          phoneNumber,
          targetType: 'contact',
          pollMessageId: messageId,
          status: 'SENT',
          flowStep: nextSectionIndex,
          parentRecipientId: recipient.id,
        },
      });

      return;
    }

    const followUps = recipient.campaign.followUps as Record<
      string,
      {
        question: string;
        options: string[];
        introTitle?: string;
        introInfo?: string;
        introMessage?: string;
        introFilePath?: string;
        introFileName?: string;
        introFileMime?: string;
      }
    > | null;

    const followUp = followUps ? followUps[String(selectedIndex)] : undefined;

    if (followUp && followUp.options?.length) {
      await this.sendIntroContent(
        workspaceId,
        this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
        followUp,
      );
      const response = recipient.campaign.useNative
        ? await this.sendPoll(
            workspaceId,
            this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
            followUp.question,
            followUp.options,
          )
        : await this.sendText(
            workspaceId,
            this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
            this.buildPollFallback(followUp.question, followUp.options),
          );

      const messageId = response.messageId;

      await this.prisma.pollRecipient.create({
        data: {
          campaignId: recipient.campaignId,
          targetJid: this.resolveTargetJid(workspaceId, fromJid || phoneNumber),
          phoneNumber,
          targetType: 'contact',
          pollMessageId: messageId,
          status: 'SENT',
          flowStep: recipient.flowStep + 1,
          parentRecipientId: recipient.id,
        },
      });
    }
  }

  private isMenuReturnOption(option: string): boolean {
    const normalized = option.toLowerCase();
    return normalized.includes('menu') || normalized.includes('inicio');
  }

  private isCancelOption(option: string): boolean {
    const normalized = option.toLowerCase();
    return normalized.includes('cancelar') || normalized.includes('anular');
  }

  private buildIntroText(source: {
    introTitle?: string | null;
    introInfo?: string | null;
    introMessage?: string | null;
  }): string | null {
    const parts: string[] = [];

    if (source.introTitle) {
      parts.push(`*${source.introTitle}*`);
    }

    if (source.introInfo) {
      parts.push(source.introInfo);
    }

    if (source.introMessage) {
      parts.push(source.introMessage);
    }

    if (!parts.length) {
      return null;
    }

    return parts.join('\n\n');
  }

  private async sendIntroContent(
    workspaceId: string,
    targetJid: string,
    source: {
      introTitle?: string | null;
      introInfo?: string | null;
      introMessage?: string | null;
      introFilePath?: string | null;
      introFileName?: string | null;
      introFileMime?: string | null;
    },
  ): Promise<void> {
    const introText = this.buildIntroText(source);

    if (introText) {
      await this.sendText(workspaceId, targetJid, introText);
    }

    if (source.introFilePath && source.introFileName && source.introFileMime) {
      try {
        const buffer = fs.readFileSync(source.introFilePath);
        await this.sendMedia(
          workspaceId,
          targetJid,
          buffer,
          source.introFileName,
          source.introFileMime,
        );
      } catch (error) {
        this.logger.warn('Falha ao enviar arquivo da introducao da enquete');
      }
    }
  }

  private async handleAutoPollStart(
    workspaceId: string,
    phoneNumber: string,
    fromJid: string,
  ): Promise<void> {

    const settings = await this.getSettings(workspaceId);
    if (settings && settings.pollsEnabled === false) {
      return;
    }

    const campaign = await (this.prisma as any).pollCampaign.findFirst({
      where: { workspaceId, autoStart: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!campaign) {
      return;
    }

    const existingRecipient = await this.prisma.pollRecipient.findFirst({
      where: {
        campaignId: campaign.id,
        phoneNumber,
        status: 'SENT',
      },
      orderBy: { sentAt: 'desc' },
    });

    if (existingRecipient) {
      return;
    }

    const messageId = await this.sendPollCampaignMessage(
      workspaceId,
      campaign,
      this.resolveTargetJid(workspaceId, fromJid),
      phoneNumber,
    );

    await this.prisma.pollRecipient.create({
      data: {
        campaignId: campaign.id,
        targetJid: fromJid,
        phoneNumber,
        targetType: 'contact',
        pollMessageId: messageId,
        status: 'SENT',
      },
    });
  }

  private buildPollFallback(question: string, options: string[]) {
    const items = options
      .map((option, index) => `${index + 1}) ${option}`)
      .join('\n');
    return `🗳️ *Enquete*\n${question}\n\n${items}\n\nResponda com o numero da opcao.`;
  }

  private normalizePhoneNumber(jid: string): string {
    return jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '');
  }

  private normalizeJid(jid: string): string {
    if (!jid.includes('@')) {
      return `${jid}@s.whatsapp.net`;
    }
    
    return jid;
  }

  private rememberJid(workspaceId: string, jid: string): void {
    if (!jid) return;
    const phoneNumber = this.normalizePhoneNumber(jid);
    if (!phoneNumber) return;
    const workspaceMap = this.recentJids.get(workspaceId) || new Map();
    workspaceMap.set(phoneNumber, jid);
    this.recentJids.set(workspaceId, workspaceMap);
  }

  private resolveTargetJid(workspaceId: string, target: string): string {
    if (!target) {
      return target;
    }

    if (target.includes('@')) {
      const phoneNumber = this.normalizePhoneNumber(target);
      const recent = this.recentJids.get(workspaceId)?.get(phoneNumber);
      return recent || target;
    }

    const recent = this.recentJids.get(workspaceId)?.get(target);
    return recent || `${target}@s.whatsapp.net`;
  }

  async getSettings(workspaceId: string) {
    return this.prisma.whatsAppSettings.findUnique({
      where: { workspaceId },
    });
  }

  async updateSettings(workspaceId: string, data: { pollsEnabled?: boolean }) {
    return this.prisma.whatsAppSettings.upsert({
      where: { workspaceId },
      update: {
        pollsEnabled: data.pollsEnabled,
      },
      create: {
        workspaceId,
        provider: this.configService.get('WHATSAPP_PROVIDER', 'web-qr'),
        isConnected: false,
        pollsEnabled: data.pollsEnabled ?? true,
      },
    });
  }

  private async ensurePollsEnabled(workspaceId: string): Promise<void> {
    const settings = await this.getSettings(workspaceId);
    if (settings && settings.pollsEnabled === false) {
      throw new Error('Enquetes desativadas para este workspace');
    }
  }
}
