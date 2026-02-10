import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private webQRProvider: WhatsAppWebQRProvider,
    private cloudAPIProvider: WhatsAppCloudAPIProvider,
  ) {
    const providerType = this.configService.get('WHATSAPP_PROVIDER', 'web-qr');
    this.defaultProvider =
      providerType === 'cloud-api' ? cloudAPIProvider : webQRProvider;
    this.setupEventListeners();
  }

  /**
   * Inicializa a conexão WhatsApp
   */
  async initializeWorkspace(workspaceId: string) {
    try {
      const settings = await this.prisma.whatsAppSettings.upsert({
        where: { workspaceId },
        update: { isConnected: false },
        create: {
          workspaceId,
          provider: this.configService.get('WHATSAPP_PROVIDER', 'web-qr'),
          isConnected: false,
        },
      });

      // Inicializar provider
      await this.defaultProvider.initSession(workspaceId);
      this.logger.info(`✅ WhatsApp inicializado para workspace: ${workspaceId}`);

      return settings;
    } catch (error) {
      this.logger.error(`Erro ao inicializar WhatsApp ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Obter QR Code para conectar
   */
  async getQRCode(workspaceId: string): Promise<string | null> {
    const qr = await this.defaultProvider.getQRCode(workspaceId);
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
    this.eventCallbacks.get(key).add(callback);
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
   * Configurar listeners no provider
   */
  private setupEventListeners(): void {
    // Escutar eventos do provider
    const handleEvent = (workspaceId: string, eventType: string, payload: any) => {
      this.logger.debug(`📡 Evento ${eventType} de ${workspaceId}:`, payload);

      // Executar callbacks registrados
      const key = `${workspaceId}:${eventType}`;
      this.eventCallbacks.get(key)?.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          this.logger.error(`Erro ao executar callback de ${eventType}:`, error);
        }
      });

      // Manejar eventos específicos
      this.handleEvent(workspaceId, eventType, payload);
    };

    // Conectar ao provider (se suportar listeners)
    if (this.defaultProvider instanceof WhatsAppWebQRProvider) {
      this.defaultProvider.on('qr', (payload) => handleEvent('*', 'qr', payload));
      this.defaultProvider.on('connection_status', (payload) =>
        handleEvent('*', 'connection_status', payload),
      );
      this.defaultProvider.on('message_received', (payload) =>
        handleEvent('*', 'message_received', payload),
      );
      this.defaultProvider.on('message_status', (payload) =>
        handleEvent('*', 'message_status', payload),
      );
    }
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
      const phoneNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');

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
      const conversation = await this.prisma.conversation.upsert({
        where: {
          workspaceId_participantPhone: {
            workspaceId,
            participantPhone: phoneNumber,
          },
        },
        update: {
          lastMessageAt: new Date(timestamp),
        },
        create: {
          workspaceId,
          leadId: lead.id,
          participantPhone: phoneNumber,
          participantName: lead.name,
          messageCount: 1,
          lastMessageAt: new Date(timestamp),
        },
      });

      // Criar mensagem
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          workspaceId,
          externalMessageId: messageId,
          direction: 'inbound',
          from: phoneNumber,
          body: text || `[${type}]`,
          messageType: type,
          receivedAt: new Date(timestamp),
          status: 'received',
        },
      });

      this.logger.info(`✅ Mensagem salva: ${messageId}`);
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
      await this.prisma.message.updateMany({
        where: {
          externalMessageId: messageId,
          workspaceId,
        },
        data: {
          status,
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
          externalMessageId: messageId,
          workspaceId,
        },
        data: {
          status: 'sent',
          sentAt: new Date(timestamp),
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
      const phoneNumber = to.replace('@s.whatsapp.net', '');

      // Encontrar conversa
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          workspaceId,
          participantPhone: phoneNumber,
        },
      });

      if (conversation) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            workspaceId,
            externalMessageId: messageId,
            direction: 'outbound',
            to: phoneNumber,
            body: text,
            messageType: type,
            status: 'sent',
            sentAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Erro ao logar mensagem:`, error);
    }
  }
}
