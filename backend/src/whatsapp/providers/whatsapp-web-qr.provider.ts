import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../common/utils/logger.util';
import { WhatsAppProvider, WhatsAppEvent } from './whatsapp.provider.interface';

/**
 * Provider para WhatsApp Web com QR Code (Baileys)
 * Implementação com persistência de sessão
 */
@Injectable()
export class WhatsAppWebQRProvider implements WhatsAppProvider {
  private logger = new Logger('WhatsAppWebQRProvider');
  private sessions: Map<string, any> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private sessionStoragePath: string;

  constructor(private configService: ConfigService) {
    this.sessionStoragePath = path.join(process.cwd(), '.whatsapp-sessions');
    if (!fs.existsSync(this.sessionStoragePath)) {
      fs.mkdirSync(this.sessionStoragePath, { recursive: true });
    }
  }

  async initSession(workspaceId: string): Promise<void> {
    try {
      this.logger.info(`📱 Importando Baileys e QRCode...`);
      
      const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        proto,
        WAMessageStubType,
      } = await import('@whiskeysockets/baileys');
      const QRCode = await import('qrcode');

      this.logger.info(`✅ Módulos importados com sucesso`);
      this.logger.info(`💾 Inicializando pasta de sessão para workspace: ${workspaceId}`);

      const sessionFolder = path.join(this.sessionStoragePath, workspaceId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      this.logger.info(`🔌 Criando socket Baileys...`);

      // Criar socket do Baileys
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: {
          trace: (pino: any) => this.logger.debug(JSON.stringify(pino)),
          debug: (pino: any) => this.logger.debug(JSON.stringify(pino)),
          info: (pino: any) => this.logger.info(JSON.stringify(pino)),
          warn: (pino: any) => this.logger.warn(JSON.stringify(pino)),
          error: (pino: any) => this.logger.error(JSON.stringify(pino)),
        } as any,
        browser: ['WhatsApp CRM', 'Desktop', '2.3000.1013807438'],
        syncFullHistory: false,
        shouldIgnoreJid: (jid) => !jid || jid.endsWith('@g.us'),
      });

      this.logger.info(`✅ Socket Baileys criado`);

      // Handle QR Code
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          const qrDataUrl = await QRCode.toDataURL(qr);
          this.qrCodes.set(workspaceId, qrDataUrl);
          this.emitEvent(workspaceId, 'qr', { qr: qrDataUrl, timestamp: Date.now() });
          this.logger.info(`QR Code gerado para ${workspaceId}`);
        }

        if (connection === 'connecting') {
          this.emitEvent(workspaceId, 'connection_status', { status: 'connecting' });
          this.logger.info(`Conectando ${workspaceId}...`);
        }

        if (connection === 'open') {
          this.logger.info(`✅ Conectado com sucesso: ${workspaceId}`);
          this.emitEvent(workspaceId, 'connection_status', { status: 'connected' });
          this.sessions.set(workspaceId, socket);
          this.qrCodes.delete(workspaceId); // Remover QR após sucesso
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
          const reason =
            DisconnectReason[(lastDisconnect?.error as any)?.output?.statusCode] ||
            'unknown';

          this.logger.warn(`❌ Desconectado (${reason}): ${workspaceId}`);
          this.emitEvent(workspaceId, 'connection_status', {
            status: 'disconnected',
            reason,
            shouldReconnect,
          });

          if (shouldReconnect) {
            setTimeout(() => this.initSession(workspaceId), 3000);
          } else {
            this.sessions.delete(workspaceId);
            this.qrCodes.delete(workspaceId);
          }
        }
      });

      // Handle credenciais alteradas
      socket.ev.on('creds.update', saveCreds);

      // Handle mensagens recebidas
      socket.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.key.fromMe && m.type === 'notify') {
          this.emitEvent(workspaceId, 'message_received', {
            from: message.key.remoteJid,
            messageId: message.key.id,
            timestamp: message.messageTimestamp,
            text: message.message?.conversation || message.message?.extendedTextMessage?.text,
            type: this.getMessageType(message),
          });
        }
      });

      // Handle status de entrega/leitura
      socket.ev.on('messages.update' as any, (updates: any[]) => {
        updates.forEach(({ key, update }) => {
          if (update.status) {
            this.emitEvent(workspaceId, 'message_status', {
              messageId: key.id,
              status: update.status,
              timestamp: Date.now(),
            });
          }
        });
      });

      // Handle chamadas (opcional)
      socket.ev.on('call', async (callData) => {
        this.logger.info(`Chamada recebida: ${JSON.stringify(callData)}`);
        this.emitEvent(workspaceId, 'call', callData);
      });

      this.sessions.set(workspaceId, socket);
      this.logger.info(`✅ Sessão inicializada com sucesso para ${workspaceId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = (error instanceof Error ? error.stack : '') || '';
      this.logger.error(`❌ Erro ao inicializar sessão ${workspaceId}:`);
      this.logger.error(`   Tipo: ${error?.constructor?.name}`);
      this.logger.error(`   Mensagem: ${errorMessage}`);
      this.logger.error(`   Stack: ${errorStack.substring(0, 500)}`);
      throw error;
    }
  }

  async getQRCode(workspaceId: string): Promise<string | null> {
    const qr = this.qrCodes.get(workspaceId);
    
    if (qr) {
      this.logger.debug(`✅ QR Code found for workspace: ${workspaceId}`);
      return qr;
    }

    // Verificar se sessão já existe
    const session = this.sessions.get(workspaceId);
    if (!session) {
      this.logger.info(`📱 Iniciando nova sessão para ${workspaceId}...`);
      await this.initSession(workspaceId);
      
      // Aguardar que o QR code seja gerado (máximo 5 segundos)
      for (let i = 0; i < 10; i++) {
        const generatedQr = this.qrCodes.get(workspaceId);
        if (generatedQr) {
          this.logger.info(`✅ QR Code gerado com sucesso para ${workspaceId}`);
          return generatedQr;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      this.logger.warn(`⚠️ QR Code não foi gerado após 5 segundos para ${workspaceId}`);
    } else {
      this.logger.debug(`📱 Sessão já existe para ${workspaceId}`);
    }

    const finalQr = this.qrCodes.get(workspaceId);
    if (!finalQr) {
      this.logger.warn(`⚠️ Nenhum QR Code disponível para ${workspaceId}`);
    }
    
    return finalQr || null;
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const session = this.sessions.get(workspaceId);
    return session?.user ? true : false;
  }

  async disconnect(workspaceId: string): Promise<void> {
    const session = this.sessions.get(workspaceId);
    if (session) {
      try {
        await session.logout();
      } catch (error) {
        this.logger.error(`Erro ao fazer logout ${workspaceId}:`, error);
      }
      // Limpar arquivos de sessão
      const sessionFolder = path.join(this.sessionStoragePath, workspaceId);
      if (fs.existsSync(sessionFolder)) {
        fs.rmSync(sessionFolder, { recursive: true, force: true });
      }
    }
    this.sessions.delete(workspaceId);
    this.qrCodes.delete(workspaceId);
    this.logger.info(`Desconectado: ${workspaceId}`);
  }

  async sendText(workspaceId: string, to: string, text: string): Promise<string> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const response = await socket.sendMessage(jid, { text });
      const messageId = response.key.id;

      this.logger.info(`✉️ Mensagem enviada para ${to}: ${messageId}`);
      this.emitEvent(workspaceId, 'message_sent', {
        to,
        messageId,
        timestamp: Date.now(),
      });

      return messageId;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${to}:`, error);
      throw error;
    }
  }

  async sendMedia(
    workspaceId: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<string> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const messagePayload: any = {
        [this.getMimeTypePrefix(mimeType)]: media,
        mimetype: mimeType,
        fileName,
      };

      if (caption) {
        messagePayload.caption = caption;
      }

      const response = await socket.sendMessage(jid, messagePayload);
      const messageId = response.key.id;

      this.logger.info(`📎 Mídia enviada para ${to}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Erro ao enviar mídia para ${to}:`, error);
      throw error;
    }
  }

  async sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ): Promise<string> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const response = await socket.sendMessage(jid, {
        poll: {
          name: question,
          values: options,
        },
      });
      const messageId = response.key.id;

      this.logger.info(`🗳️ Enquete enviada para ${to}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Erro ao enviar enquete para ${to}:`, error);
      throw error;
    }
  }

  async listGroups(workspaceId: string): Promise<any[]> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }

    try {
      const chats = await socket.groupFetchAllParticipating();
      const groups = Object.values(chats).filter((chat: any) => chat.id.endsWith('@g.us'));

      return groups.map((g: any) => ({
        id: g.id,
        name: g.subject,
        participantCount: g.participants?.length || 0,
      }));
    } catch (error) {
      this.logger.error(`Erro ao listar grupos para ${workspaceId}:`, error);
      throw error;
    }
  }

  // ========== HELPERS ==========
  private getMimeTypePrefix(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }

  private getMessageType(message: any): string {
    if (message.message?.conversation) return 'text';
    if (message.message?.imageMessage) return 'image';
    if (message.message?.audioMessage) return 'audio';
    if (message.message?.videoMessage) return 'video';
    if (message.message?.documentMessage) return 'document';
    return 'unknown';
  }

  // ========== EVENT EMITTER ==========
  on(workspaceId: string, event: string, handler: Function): void {
    const key = `${workspaceId}:${event}`;
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set());
    }
    this.eventHandlers.get(key)!.add(handler);
  }

  off(workspaceId: string, event: string, handler?: Function): void {
    const key = `${workspaceId}:${event}`;
    if (handler) {
      this.eventHandlers.get(key)?.delete(handler);
    } else {
      this.eventHandlers.delete(key);
    }
  }

  async testConnection(workspaceId: string): Promise<boolean> {
    const session = this.sessions.get(workspaceId);
    return session?.user ? true : false;
  }

  async getGroupInfo(workspaceId: string, groupId: string): Promise<any> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }
    try {
      return await socket.groupMetadata(groupId);
    } catch (error) {
      this.logger.error(`Erro ao obter info do grupo ${groupId}:`, error);
      return null;
    }
  }

  async getProfilePicture(
    workspaceId: string,
    phoneNumber: string,
  ): Promise<string | null> {
    const socket = this.sessions.get(workspaceId);
    if (!socket?.user) {
      throw new Error(`Não conectado ao WhatsApp para ${workspaceId}`);
    }
    try {
      return await socket.profilePictureUrl(phoneNumber);
    } catch (error) {
      this.logger.error(`Erro ao obter foto do perfil ${phoneNumber}:`, error);
      return null;
    }
  }

  private emitEvent(workspaceId: string, event: string, payload: any): void {
    const key = `${workspaceId}:${event}`;
    const handlers = this.eventHandlers.get(key);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          this.logger.error(`Erro ao executar handler de evento ${event}:`, error);
        }
      });
    }
  }
}
