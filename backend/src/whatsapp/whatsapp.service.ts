import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../common/utils/logger.util';
import { WhatsAppProvider } from './providers/interface';
import { WhatsAppWebQRProvider } from './providers/whatsapp-web-qr.provider';
import { WhatsAppCloudAPIProvider } from './providers/whatsapp-cloud-api.provider';

@Injectable()
export class WhatsAppService {
  private logger = new Logger('WhatsAppService');
  private providers: Map<string, WhatsAppProvider> = new Map();
  private defaultProvider: WhatsAppProvider;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private webQRProvider: WhatsAppWebQRProvider,
    private cloudAPIProvider: WhatsAppCloudAPIProvider,
  ) {
    const providerType = this.configService.get(
      'WHATSAPP_PROVIDER',
      'web-qr',
    );
    this.defaultProvider =
      providerType === 'cloud-api' ? cloudAPIProvider : webQRProvider;
  }

  async initializeWorkspace(workspaceId: string) {
    // Criar/atualizar WhatsAppSettings
    const settings = await this.prisma.whatsAppSettings.upsert({
      where: { workspaceId },
      update: {},
      create: {
        workspaceId,
        provider: this.configService.get('WHATSAPP_PROVIDER', 'web-qr'),
      },
    });

    // Inicializar provider
    await this.defaultProvider.initSession(workspaceId);
    this.logger.info(`WhatsApp inicializado para workspace: ${workspaceId}`);

    return settings;
  }

  async getQRCode(workspaceId: string): Promise<string | null> {
    return this.defaultProvider.getQRCode(workspaceId);
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    return this.defaultProvider.isConnected(workspaceId);
  }

  async sendText(workspaceId: string, to: string, text: string) {
    const messageId = await this.defaultProvider.sendText(workspaceId, to, text);

    // Registrar no banco
    await this.logMessage(workspaceId, to, text, 'text', messageId);

    return { messageId, status: 'sent' };
  }

  async sendMedia(
    workspaceId: string,
    to: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ) {
    const messageId = await this.defaultProvider.sendMedia(
      workspaceId,
      to,
      buffer,
      fileName,
      mimeType,
      caption,
    );

    await this.logMessage(
      workspaceId,
      to,
      caption || fileName,
      'media',
      messageId,
    );

    return { messageId, status: 'sent' };
  }

  async sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ) {
    const messageId = await this.defaultProvider.sendPoll(
      workspaceId,
      to,
      question,
      options,
    );

    await this.logMessage(workspaceId, to, question, 'poll', messageId);

    return { messageId, status: 'sent' };
  }

  async listGroups(workspaceId: string) {
    return this.defaultProvider.listGroups(workspaceId);
  }

  async testConnection(workspaceId: string): Promise<boolean> {
    return this.defaultProvider.testConnection(workspaceId);
  }

  private async logMessage(
    workspaceId: string,
    to: string,
    text: string,
    type: string,
    messageId: string,
  ) {
    // TODO: Registrar no banco de dados
    this.logger.debug(
      `Mensagem registrada: ${messageId} para ${to}`,
    );
  }
}
