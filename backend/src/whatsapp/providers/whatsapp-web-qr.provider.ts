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
  private initializingWorkspaces: Set<string> = new Set(); // Evitar múltiplas inicializações
  private sessionStoragePath: string;
  private connectionRetries: Map<string, number> = new Map(); // Track retries

  constructor(private configService: ConfigService) {
    this.sessionStoragePath = path.join(process.cwd(), '.whatsapp-sessions');
    if (!fs.existsSync(this.sessionStoragePath)) {
      fs.mkdirSync(this.sessionStoragePath, { recursive: true });
    }
  }

  async initSession(workspaceId: string): Promise<void> {
    // Evitar múltiplas inicializações simultâneas
    if (this.initializingWorkspaces.has(workspaceId)) {
      this.logger.warn(`⚠️  Inicialização já em progresso para ${workspaceId}, ignorando requisição duplicada`);
      return;
    }
    
    this.initializingWorkspaces.add(workspaceId);
    
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

      // Limpar socket anterior se existir
      const existingSession = this.sessions.get(workspaceId);
      if (existingSession) {
        try {
          existingSession.logout();
        } catch (e) {
          this.logger.warn(`⚠️  Erro ao fazer logout da sessão anterior`);
        }
        this.sessions.delete(workspaceId);
      }

      const sessionFolder = path.join(this.sessionStoragePath, workspaceId);
      
      // Se o QR code foi solicitado (por clique do usuário), deletar pasta de sessão antiga
      // Isso força Baileys a gerar um novo QR code em vez de tentar reutilizar credenciais antigas
      if (fs.existsSync(sessionFolder)) {
        try {
          this.logger.info(`🗑️  Deletando pasta de sessão antiga para gerar novo QR code`);
          fs.rmSync(sessionFolder, { recursive: true, force: true });
          this.logger.info(`✅ Pasta de sessão deletada`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`⚠️  Erro ao deletar pasta de sessão: ${errMsg}`);
        }
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      this.logger.info(`🔌 Criando socket Baileys...`);

      // Criar socket do Baileys com configurações otimizadas para QR generation
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        qrTimeout: 90000, // 90 segundos para geração de QR
        browser: ['WhatsApp CRM', 'Desktop', '2.3000.1013807438'],
        syncFullHistory: false,
        shouldIgnoreJid: (jid) => !jid || jid.endsWith('@g.us'),
        keepAliveIntervalMs: 30000,
        logger: {
          trace: () => {},
          debug: (msg: string) => this.logger.debug(`[Baileys] ${msg}`),
          info: (msg: string) => this.logger.info(`[Baileys] ${msg}`),
          warn: (msg: string) => this.logger.warn(`[Baileys] ${msg}`),
          error: (msg: string) => this.logger.error(`[Baileys] ${msg}`),
        } as any,
      });

      this.logger.info(`✅ Socket Baileys criado`);

      // Handle QR Code - Listener principal com timeout
      let qrEmitted = false;
      const qrTimeout = setTimeout(() => {
        if (!qrEmitted) {
          this.logger.warn(`⏳ QR timeout de 90s atingido, ainda não emitido`);
        }
      }, 90000);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Log detalhado para debug
        this.logger.info(`📡 connection.update event: connection=${connection}, qr=${qr ? '✅ presente' : '❌ ausente'}`);
        if (qr) {
          this.logger.info(`🔐 QR code value received (length: ${qr.length})`);
          qrEmitted = true;
          clearTimeout(qrTimeout);
        }

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            this.qrCodes.set(workspaceId, qrDataUrl);
            this.emitEvent(workspaceId, 'qr', { qr: qrDataUrl, timestamp: Date.now() });
            this.logger.info(`✅ QR Code gerado e armazenado para ${workspaceId}`);
          } catch (error) {
            this.logger.error(`❌ Erro ao gerar QR Data URL:`, error);
          }
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
          this.connectionRetries.delete(workspaceId); // Reset retry counter
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

          // NÃO reconectar automaticamente se ainda estamos esperando QR
          // Deixar que o getQRCode() trate a reconexão
          if (!qrEmitted && shouldReconnect) {
            this.logger.info(`⏳ Aguardando QR code antes de reconectar (${reason})`);
            clearTimeout(qrTimeout);
          } else if (shouldReconnect) {
            // Backoff exponencial para reconexão
            const retryCount = this.connectionRetries.get(workspaceId) || 0;
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s
            this.logger.info(`⏳ Reconectando em ${retryDelay}ms (tentativa ${retryCount + 1})...`);
            
            setTimeout(() => this.initSession(workspaceId), retryDelay);
            this.connectionRetries.set(workspaceId, Math.min(retryCount + 1, 5));
          } else {
            this.sessions.delete(workspaceId);
            this.qrCodes.delete(workspaceId);
            this.connectionRetries.delete(workspaceId);
          }
        }
      });

      // Handle credenciais alteradas
      socket.ev.on('creds.update', async () => {
        this.logger.info(`💾 Credenciais atualizadas para ${workspaceId}`);
        await saveCreds();
      });

      // Tentar escutar evento de QR direto (em caso de API diferente)
      try {
        (socket.ev as any).on('qr', async (qr: string) => {
          this.logger.info(`🔐 Evento 'qr' disparado diretamente`);
          const qrDataUrl = await QRCode.toDataURL(qr);
          this.qrCodes.set(workspaceId, qrDataUrl);
          this.emitEvent(workspaceId, 'qr', { qr: qrDataUrl, timestamp: Date.now() });
          this.logger.info(`✅ QR Code gerado do evento direto para ${workspaceId}`);
        });
      } catch (err) {
        // Silenciar se não funcionar
      }

      // Listener de erro
      (socket.ev as any).on('error', (error: any) => {
        this.logger.error(`🔴 Socket error: ${error?.message || JSON.stringify(error)}`);
        this.logger.error(`🔴 Stack: ${error?.stack?.substring(0, 300)}`);
      });

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

      // Debug: Log de todos os eventos para entender qual está disparando
      socket.ev.on('connection.update', (update) => {
        // Nota: este é um listener adicional apenas para debug
        Object.keys(update).forEach(key => {
          const val = (update as any)[key];
          if (val !== null && val !== undefined) {
            this.logger.debug(`📶 connection.update propriedade: ${key} = ${typeof val}`);
          }
        });
      });

      this.sessions.set(workspaceId, socket);
      this.logger.info(`✅ Sessão inicializada com sucesso para ${workspaceId}`);
      this.logger.info(`📲 Socket está pronto para receber eventos de QR code`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = (error instanceof Error ? error.stack : '') || '';
      this.logger.error(`❌ Erro ao inicializar sessão ${workspaceId}:`);
      this.logger.error(`   Tipo: ${error?.constructor?.name}`);
      this.logger.error(`   Mensagem: ${errorMessage}`);
      this.logger.error(`   Stack: ${errorStack.substring(0, 500)}`);
      throw error;
    } finally {
      this.initializingWorkspaces.delete(workspaceId);
    }
  }

  async getQRCode(workspaceId: string): Promise<string | null> {
    const qr = this.qrCodes.get(workspaceId);
    
    if (qr) {
      this.logger.debug(`✅ QR Code found for workspace: ${workspaceId}`);
      return qr;
    }

    // Verificar se sessão já existe e aguardar QR
    const session = this.sessions.get(workspaceId);
    if (session) {
      this.logger.info(`📱 Sessão já existe para ${workspaceId}, aguardando QR code...`);
      // Aguardar até 90 segundos por um QR code existente
      for (let i = 0; i < 180; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const existingQr = this.qrCodes.get(workspaceId);
        if (existingQr) {
          this.logger.info(`✅ QR Code obtido após ${(i + 1) * 500}ms`);
          return existingQr;
        }
        if (i % 20 === 0 && i > 0) {
          this.logger.info(`⏳ Aguardando QR code... (${(i + 1) * 500}ms / 90000ms)`);
        }
      }
      this.logger.warn(`⏳ Sessão existe mas QR não foi emitido em 90s, tentando inicializar nova...`);
      return null;
    }

    // Tentar até 3 vezes para obter QR
    for (let attempt = 1; attempt <= 3; attempt++) {
      this.logger.info(`📱 Iniciando nova sessão para ${workspaceId}... (tentativa ${attempt}/3)`);
      
      try {
        await this.initSession(workspaceId);
      } catch (error) {
        this.logger.error(`❌ Erro ao inicializar sessão (tentativa ${attempt}):`, error);
        if (attempt < 3) {
          const delay = 2000 * attempt; // 2s, 4s, 6s
          this.logger.info(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }
      
      // Aguardar geração de QR (máximo 120 segundos com polling a cada 500ms)
      this.logger.info(`⏳ Aguardando geração de QR code por até 120 segundos...`);
      for (let i = 0; i < 240; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const generatedQr = this.qrCodes.get(workspaceId);
        if (generatedQr) {
          this.logger.info(`✅ QR Code gerado com sucesso após ${(i + 1) * 500}ms (tentativa ${attempt})`);
          return generatedQr;
        }
        if (i % 20 === 0 && i > 0) { // Log a cada 10 segundos
          this.logger.info(`⏳ Ainda aguardando QR code... (${(i + 1) * 500}ms / 120000ms)`);
        }
      }

      this.logger.warn(`⏳ QR Code não foi gerado após 120s (tentativa ${attempt}/3)`);
      
      // Limpar a sessão para próxima tentativa
      const session = this.sessions.get(workspaceId);
      if (session) {
        try {
          await session.logout();
        } catch (e) {
          // Ignorar erros de logout
        }
      }
      this.sessions.delete(workspaceId);
      this.qrCodes.delete(workspaceId);
      
      if (attempt < 3) {
        const delay = 3000 * attempt; // 3s, 6s, 9s
        this.logger.info(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.logger.error(`❌ Falha ao gerar QR code após 3 tentativas para ${workspaceId}`);
    this.logger.error(`❌ Verifique:
      1. Conectividade de rede
      2. Versão do @whiskeysockets/baileys (atual: verifique package.json)
      3. Logs do Baileys para mais detalhes`);
    
    return null;
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
    this.connectionRetries.delete(workspaceId);
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
