import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../common/utils/logger.util';
import { WhatsAppProvider } from './interface';

/**
 * Provider para WhatsApp Cloud API (Beta)
 * Implementação stub - pronto para ativar quando migrar para API Cloud
 */
@Injectable()
export class WhatsAppCloudAPIProvider implements WhatsAppProvider {
  private logger = new Logger('WhatsAppCloudAPIProvider');
  private sessions: Map<string, any> = new Map();

  constructor(private configService: ConfigService) {}

  async initSession(workspaceId: string): Promise<void> {
    this.logger.info(
      `[STUB] Inicializando sessão Cloud API para workspace: ${workspaceId}`,
    );
    const token = this.configService.get('WHATSAPP_CLOUD_API_TOKEN');
    const phoneId = this.configService.get('WHATSAPP_PHONE_ID');

    if (!token || !phoneId) {
      this.logger.warn(
        'Cloud API não configurada. Configure WHATSAPP_CLOUD_API_TOKEN e WHATSAPP_PHONE_ID',
      );
      return;
    }

    this.sessions.set(workspaceId, {
      token,
      phoneId,
      connected: false,
    });
  }

  async getQRCode(workspaceId: string): Promise<string | null> {
    // Cloud API não usa QR Code
    return null;
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const session = this.sessions.get(workspaceId);
    return session?.connected || false;
  }

  async disconnect(workspaceId: string): Promise<void> {
    this.sessions.delete(workspaceId);
    this.logger.info(`Desconectado da Cloud API: ${workspaceId}`);
  }

  async sendText(
    workspaceId: string,
    to: string,
    text: string,
  ): Promise<string> {
    // TODO: Implementar chamada para Cloud API
    // POST /v18.0/{PHONE_ID}/messages
    this.logger.info(`[STUB] Enviando mensagem para ${to}: ${text}`);
    return 'msg_' + Date.now();
  }

  async sendMedia(
    workspaceId: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<string> {
    // TODO: Upload mídia e enviar via Cloud API
    this.logger.info(`[STUB] Enviando mídia para ${to}: ${fileName}`);
    return 'msg_' + Date.now();
  }

  async sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ): Promise<string> {
    // Cloud API suporta polls nativos
    this.logger.info(
      `[STUB] Enviando enquete para ${to}: ${question}`,
    );
    return 'msg_' + Date.now();
  }

  async listGroups(workspaceId: string): Promise<any[]> {
    this.logger.info(`[STUB] Listando grupos para workspace: ${workspaceId}`);
    return [];
  }

  async getGroupInfo(workspaceId: string, groupId: string): Promise<any> {
    return null;
  }

  async getProfilePicture(
    workspaceId: string,
    phoneNumber: string,
  ): Promise<string | null> {
    // TODO: GET /v18.0/{PHONE_ID}/profile_picture
    return null;
  }

  on(event: string, callback: (data: any) => void): void {
    // Cloud API usa webhooks, não eventos em tempo real
    this.logger.debug(`[STUB] Registrando listener para evento: ${event}`);
  }

  off(event: string, callback?: (data: any) => void): void {
    this.logger.debug(`[STUB] Removendo listener do evento: ${event}`);
  }

  async testConnection(workspaceId: string): Promise<boolean> {
    const session = this.sessions.get(workspaceId);
    if (!session) {
      return false;
    }

    // TODO: Verificar token com GET /v18.0/me
    this.logger.info(`[STUB] Testando conexão Cloud API`);
    return true;
  }
}
