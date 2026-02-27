import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../common/utils/logger.util';
import { WhatsAppProvider } from './whatsapp.provider.interface';

/**
 * Provider para WhatsApp Cloud API (Beta)
 * Implementação stub - pronto para ativar quando migrar para API Cloud
 */
@Injectable()
export class WhatsAppCloudAPIProvider implements WhatsAppProvider {
  private logger = new Logger('WhatsAppCloudAPIProvider');
  private sessions: Map<string, any> = new Map(); // keyed by mapKey

  constructor(private configService: ConfigService) {}

  async initSession(
    mapKey: string,
    _options?: { forceNewSession?: boolean },
  ): Promise<void> {
    this.logger.info(
      `[STUB] Inicializando sessão Cloud API para mapKey: ${mapKey}`,
    );
    const token = this.configService.get('WHATSAPP_CLOUD_API_TOKEN');
    const phoneId = this.configService.get('WHATSAPP_PHONE_ID');

    if (!token || !phoneId) {
      this.logger.warn(
        'Cloud API não configurada. Configure WHATSAPP_CLOUD_API_TOKEN e WHATSAPP_PHONE_ID',
      );
      return;
    }

    this.sessions.set(mapKey, {
      token,
      phoneId,
      connected: false,
    });
  }

  async getQRCode(mapKey: string): Promise<string | null> {
    // Cloud API não usa QR Code
    return null;
  }

  async isConnected(mapKey: string): Promise<boolean> {
    const session = this.sessions.get(mapKey);
    return session?.connected || false;
  }

  async disconnect(mapKey: string): Promise<void> {
    this.sessions.delete(mapKey);
    this.logger.info(`Desconectado da Cloud API: ${mapKey}`);
  }

  async sendText(
    mapKey: string,
    to: string,
    text: string,
  ): Promise<{ messageId: string; timestamp?: number }> {
    // TODO: Implementar chamada para Cloud API
    // POST /v18.0/{PHONE_ID}/messages
    this.logger.info(`[STUB] Enviando mensagem para ${to} (mapKey=${mapKey}): ${text}`);
    return { messageId: 'msg_' + Date.now(), timestamp: Date.now() };
  }

  async sendMedia(
    mapKey: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<{ messageId: string; timestamp?: number }> {
    // TODO: Upload mídia e enviar via Cloud API
    this.logger.info(`[STUB] Enviando mídia para ${to} (mapKey=${mapKey}): ${fileName}`);
    return { messageId: 'msg_' + Date.now(), timestamp: Date.now() };
  }

  async sendPoll(
    mapKey: string,
    to: string,
    question: string,
    options: string[],
  ): Promise<{ messageId: string; timestamp?: number }> {
    // Cloud API suporta polls nativos
    this.logger.info(
      `[STUB] Enviando enquete para ${to} (mapKey=${mapKey}): ${question}`,
    );
    return { messageId: 'msg_' + Date.now(), timestamp: Date.now() };
  }

  async listGroups(mapKey: string): Promise<any[]> {
    this.logger.info(`[STUB] Listando grupos para mapKey: ${mapKey}`);
    return [];
  }

  async getGroupInfo(mapKey: string, groupId: string): Promise<any> {
    return null;
  }

  async getProfilePicture(
    mapKey: string,
    phoneNumber: string,
  ): Promise<string | null> {
    // TODO: GET /v18.0/{PHONE_ID}/profile_picture
    return null;
  }

  async listContacts(mapKey: string): Promise<any[]> {
    this.logger.info(`[STUB] Listando contatos para mapKey: ${mapKey}`);
    return [];
  }

  on(mapKey: string, event: string, callback: (data: any) => void): void {
    // Cloud API usa webhooks, não eventos em tempo real
    this.logger.debug(
      `[STUB] Registrando listener para evento: ${mapKey}:${event}`,
    );
  }

  off(mapKey: string, event: string, callback?: (data: any) => void): void {
    this.logger.debug(`[STUB] Removendo listener do evento: ${mapKey}:${event}`);
  }

  async testConnection(mapKey: string): Promise<boolean> {
    const session = this.sessions.get(mapKey);
    if (!session) {
      return false;
    }

    // TODO: Verificar token com GET /v18.0/me
    this.logger.info(`[STUB] Testando conexão Cloud API (mapKey=${mapKey})`);
    return true;
  }
}
