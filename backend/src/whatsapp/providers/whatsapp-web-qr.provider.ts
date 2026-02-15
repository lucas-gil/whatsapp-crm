import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
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
  private connectionStatus: Map<string, string> = new Map(); // Track connection status per workspace
  private contacts: Map<string, any[]> = new Map();

  constructor(private configService: ConfigService) {
    const configuredPath =
      this.configService.get('WHATSAPP_SESSION_PATH') ||
      process.env.WHATSAPP_SESSION_PATH;

    const legacyPath = path.join(process.cwd(), '.whatsapp-sessions');
    const defaultPath = path.join(process.cwd(), 'sessions');

    this.sessionStoragePath = configuredPath || (fs.existsSync(legacyPath) ? legacyPath : defaultPath);
    if (!fs.existsSync(this.sessionStoragePath)) {
      fs.mkdirSync(this.sessionStoragePath, { recursive: true });
    }
  }

  async initSession(
    workspaceId: string,
    options: { forceNewSession?: boolean } = {},
  ): Promise<void> {
    const forceNewSession = options.forceNewSession === true;
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
        fetchLatestBaileysVersion,
      } = await import('@whiskeysockets/baileys');
      const QRCode = await import('qrcode');

      this.logger.info(`✅ Módulos importados com sucesso`);
      this.logger.info(`💾 Inicializando pasta de sessão para workspace: ${workspaceId}`);

      // Limpar socket anterior se existir
      const existingSession = this.sessions.get(workspaceId);
      if (existingSession) {
        try {
          await Promise.resolve(existingSession.logout());
        } catch (e) {
          this.logger.warn(`⚠️  Erro ao fazer logout da sessão anterior`);
        }
        this.sessions.delete(workspaceId);
      }

      const sessionFolder = path.join(this.sessionStoragePath, workspaceId);
      
      // Somente apagar sessão quando o usuário solicitar um QR novo
      if (forceNewSession && fs.existsSync(sessionFolder)) {
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
      let waVersion: [number, number, number] | undefined;
      try {
        const latest = await fetchLatestBaileysVersion();
        waVersion = latest.version;
        this.logger.info(`📦 Baileys WA version: ${waVersion.join('.')}`);
      } catch (err) {
        this.logger.warn(`⚠️  Falha ao obter versão do WhatsApp Web, usando padrão`);
      }

      const baileysLogger = pino({
        level: process.env.BAILEYS_LOG_LEVEL || 'silent',
      });

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        qrTimeout: 180000, // 180 segundos (3 minutos) para geração de QR - AUMENTADO
        browser: ['WhatsApp CRM', 'Desktop', '2.3000.1013807438'],
        version: waVersion,
        syncFullHistory: false,
        shouldIgnoreJid: (jid) => !jid,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 180000, // Aumentar timeout de conexão para 3 minutos
        logger: baileysLogger,
      });

      this.logger.info(`✅ Socket Baileys criado`);

      // Handle QR Code - Listener principal com timeout
      let qrEmitted = false;
      const qrTimeout = setTimeout(() => {
        if (!qrEmitted) {
          this.logger.warn(`⏳ QR timeout de 180s atingido, ainda não emitido - pode haver problema de rede/WhatsApp`);
        }
      }, 180000);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection) {
          this.connectionStatus.set(workspaceId, connection);
        }
        
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
          if (lastDisconnect?.error) {
            const lastError: any = lastDisconnect.error;
            this.logger.warn(
              `❌ Detalhes do disconnect: ${lastError?.message || 'sem mensagem'} | status=${lastError?.output?.statusCode || 'n/a'}`,
            );
          }
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
            // Backoff exponencial para reconexão (AUMENTADO)
            const retryCount = this.connectionRetries.get(workspaceId) || 0;
            const retryDelay = Math.min(2000 * Math.pow(2, retryCount), 60000); // Max 60s (era 30s)
            this.logger.info(`⏳ Reconectando em ${retryDelay}ms (tentativa ${retryCount + 1}/10)...`);
            
            setTimeout(() => this.initSession(workspaceId), retryDelay);
            this.connectionRetries.set(workspaceId, Math.min(retryCount + 1, 10)); // 10 tentativas (era 5)
          } else {
            this.sessions.delete(workspaceId);
            this.qrCodes.delete(workspaceId);
            this.connectionRetries.delete(workspaceId);
          }
        }
      });

      (socket.ev as any).on('contacts.set', (payload: any) => {
        const contactList = Array.isArray(payload?.contacts) ? payload.contacts : [];
        this.setContacts(workspaceId, contactList);
      });

      (socket.ev as any).on('contacts.upsert', (contacts: any[]) => {
        this.upsertContacts(workspaceId, contacts || []);
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
          const pollUpdate = message.message?.pollUpdateMessage as any;
          if (pollUpdate) {
            const rawSelected = pollUpdate.vote?.selectedOptions || pollUpdate.vote?.selectedOptionIds || [];
            const selectedOptions = (rawSelected as any[]).map((opt: any) =>
              opt?.toString ? opt.toString() : String(opt),
            );
            this.emitEvent(workspaceId, 'poll_update', {
              from: message.key.remoteJid,
              pollMessageId: pollUpdate.pollCreationMessageKey?.id,
              selectedOptions,
              timestamp: message.messageTimestamp,
            });
            return;
          }

          this.emitEvent(workspaceId, 'message_received', {
            from: message.key.remoteJid,
            participant: message.key.participant,
            pushName: message.pushName,
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
    const status = this.connectionStatus.get(workspaceId);
    if (session && status !== 'close' && status !== 'disconnected') {
      this.logger.info(`📱 Sessão já existe para ${workspaceId}, aguardando QR code por até 5 minutos...`);
      // Aguardar até 300 segundos (5 minutos) por um QR code existente
      let sessionDisconnected = false;
      for (let i = 0; i < 600; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const existingQr = this.qrCodes.get(workspaceId);
        if (existingQr) {
          this.logger.info(`✅ QR Code obtido após ${(i + 1) * 500}ms`);
          return existingQr;
        }
        const currentStatus = this.connectionStatus.get(workspaceId);
        if (currentStatus === 'close' || currentStatus === 'disconnected') {
          this.logger.warn(`⚠️ Sessão desconectou antes do QR, iniciando nova tentativa...`);
          sessionDisconnected = true;
          break;
        }
        if (i % 60 === 0 && i > 0) {
          this.logger.info(`⏳ Aguardando QR code... (${(i + 1) * 500}ms / 300000ms)`);
        }
      }
      if (!sessionDisconnected) {
        this.logger.warn(`⏳ Sessão existe mas QR não foi emitido em 5 minutos, tentando inicializar nova...`);
        return null;
      }
    }

    if (session && (status === 'close' || status === 'disconnected')) {
      this.sessions.delete(workspaceId);
      this.qrCodes.delete(workspaceId);
      this.connectionStatus.delete(workspaceId);
    }

    // Tentar até 5 vezes para obter QR (foi 3, aumentado para 5)
    for (let attempt = 1; attempt <= 5; attempt++) {
      this.logger.info(`📱 Iniciando nova sessão para ${workspaceId}... (tentativa ${attempt}/5)`);
      
      try {
        await this.initSession(workspaceId);
      } catch (error) {
        this.logger.error(`❌ Erro ao inicializar sessão (tentativa ${attempt}):`, error);
        if (attempt < 5) {
          const delay = 3000 * attempt; // 3s, 6s, 9s, 12s, 15s
          this.logger.info(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }
      
      // Aguardar geração de QR (máximo 300 segundos = 5 minutos com polling a cada 500ms)
      this.logger.info(`⏳ Aguardando geração de QR code por até 5 minutos (300 segundos)...`);
      for (let i = 0; i < 600; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const generatedQr = this.qrCodes.get(workspaceId);
        if (generatedQr) {
          this.logger.info(`✅ QR Code gerado com sucesso após ${(i + 1) * 500}ms (tentativa ${attempt})`);
          return generatedQr;
        }
        if (i % 60 === 0 && i > 0) { // Log a cada 30 segundos
          this.logger.info(`⏳ Ainda aguardando QR code... (${(i + 1) * 500}ms / 300000ms - tentativa ${attempt}/5)`);
        }
      }

      this.logger.warn(`⏳ QR Code não foi gerado após 5 minutos (tentativa ${attempt}/5)`);
      
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
      this.connectionStatus.delete(workspaceId);
      
      if (attempt < 5) {
        const delay = 5000 * attempt; // 5s, 10s, 15s, 20s, 25s
        this.logger.info(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.logger.error(`❌ Falha ao gerar QR code após 5 tentativas (25 minutos totais) para ${workspaceId}`);
    this.logger.error(`❌ Possíveis problemas:
      1. 🌐 Conectividade de rede (check internet connection)
      2. 🚫 WhatsApp está bloqueando sua region/IP (try VPN)
      3. 📄 Versão do @whiskeysockets/baileys pode estar incompatível
      4. ⏱️ Timeout insuficiente (está em 300s, pode precisar mais)
      5. 🔍 Verificar logs do Baileys acima`);
    
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
    this.connectionStatus.delete(workspaceId);
    this.contacts.delete(workspaceId);
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
      this.logger.info(
        `🧪 Enviando enquete: jid=${jid} options=${options.length} question=${question.substring(0, 40)}`,
      );
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

  async listContacts(workspaceId: string): Promise<any[]> {
    const contacts = this.contacts.get(workspaceId) || [];
    return contacts;
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
      const target =
        phoneNumber === 'me' || phoneNumber === 'self'
          ? socket.user?.id
          : phoneNumber;
      if (!target) {
        return null;
      }
      return await socket.profilePictureUrl(target);
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

  private setContacts(workspaceId: string, contacts: any[]): void {
    const normalized = this.normalizeContacts(contacts);
    this.contacts.set(workspaceId, normalized);
  }

  private upsertContacts(workspaceId: string, contacts: any[]): void {
    const existing = this.contacts.get(workspaceId) || [];
    const byId = new Map(existing.map((c: any) => [c.id, c]));

    this.normalizeContacts(contacts).forEach((contact) => {
      byId.set(contact.id, { ...byId.get(contact.id), ...contact });
    });

    this.contacts.set(workspaceId, Array.from(byId.values()));
  }

  private normalizeContacts(contacts: any[]): any[] {
    return contacts
      .filter((contact) => {
        if (!contact?.id) return false;
        const id = String(contact.id);
        return id.includes('@s.whatsapp.net') || id.includes('@lid');
      })
      .map((contact) => {
        const id = String(contact.id);
        const phoneNumber = id.split('@')[0];
        const name =
          contact.name || contact.notify || contact.verifiedName || phoneNumber;

        return {
          id,
          phoneNumber,
          name,
        };
      });
  }
}
