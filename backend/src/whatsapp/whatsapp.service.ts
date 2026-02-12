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

    return this.defaultProvider.listContacts(workspaceId);
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
          workspaceId_leadId_groupId: {
            workspaceId,
            leadId: lead.id,
            groupId: null as any,
          },
        },
        update: {
          lastMessageAt: new Date(timestamp),
          lastMessage: text || `[${type}]`,
        },
        create: {
          workspaceId,
          leadId: lead.id,
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
      const phoneNumber = to.replace('@s.whatsapp.net', '');

      // Encontrar lead/conversa
      const lead = await this.prisma.lead.findUnique({
        where: {
          workspaceId_phoneNumber: {
            workspaceId,
            phoneNumber,
          },
        },
      });

      if (lead) {
        const conversation = await this.prisma.conversation.findFirst({
          where: {
            workspaceId,
            leadId: lead.id,
            groupId: null,
          },
        });

        if (conversation) {
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
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao logar mensagem:`, error);
    }
  }
}
