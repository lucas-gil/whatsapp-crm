import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private whatsAppService: WhatsAppService) {}

  /**
   * Iniciar conexão QR Code
   */
  @Post('connect-qr')
  async connectQR(@Request() req: any) {
    try {
      const workspaceId = req.user.workspaceId;
      if (!workspaceId) {
        throw new BadRequestException('Workspace ID não encontrado');
      }

      const settings = await this.whatsAppService.initializeWorkspace(workspaceId);
      return {
        status: 'initializing',
        message: 'Escaneie o código QR com seu WhatsApp',
        settings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao inicializar WhatsApp';
      console.error('❌ Erro em connectQR:', error);
      throw new BadRequestException(`Erro ao conectar: ${message}`);
    }
  }

  /**
   * Obter QR Code atual
   */
  @Get('qr-code')
  async getQRCode(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const qrCode = await this.whatsAppService.getQRCode(workspaceId);

    if (!qrCode) {
      return {
        status: 'connected',
        qrCode: null,
        message: 'WhatsApp já está conectado',
      };
    }

    return {
      status: 'waiting',
      qrCode, // data URL da imagem
      message: 'Escaneie o código QR para conectar',
    };
  }

  /**
   * Verificar status de conexão
   */
  @Get('status')
  async getStatus(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const connected = await this.whatsAppService.isConnected(workspaceId);

    return {
      connected,
      status: connected ? 'connected' : 'disconnected',
      timestamp: new Date(),
    };
  }

  /**
   * Desconectar WhatsApp
   */
  @Post('disconnect')
  async disconnect(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    await this.whatsAppService.disconnect(workspaceId);

    return {
      status: 'disconnected',
      message: 'WhatsApp desconectado com sucesso',
    };
  }

  /**
   * Enviar mensagem de texto
   */
  @Post('send-text')
  async sendText(@Body() { to, text }: any, @Request() req: any) {
    if (!to || !text) {
      throw new BadRequestException('to e text são obrigatórios');
    }

    return this.whatsAppService.sendText(req.user.workspaceId, to, text);
  }

  /**
   * Enviar mídia
   */
  @Post('send-media')
  @UseInterceptors(FileInterceptor('file'))
  async sendMedia(
    @UploadedFile() file: any,
    @Body('to') to: string,
    @Body('caption') caption: string,
    @Request() req: any,
  ) {
    if (!file || !to) {
      throw new BadRequestException('file e to são obrigatórios');
    }

    return this.whatsAppService.sendMedia(
      req.user.workspaceId,
      to,
      file.buffer,
      file.originalname,
      file.mimetype,
      caption,
    );
  }

  /**
   * Enviar enquete/poll
   */
  @Post('send-poll')
  async sendPoll(
    @Body() { to, question, options }: any,
    @Request() req: any,
  ) {
    if (!to || !question || !options || options.length < 2) {
      throw new BadRequestException(
        'to, question e options (min 2) são obrigatórios',
      );
    }

    return this.whatsAppService.sendPoll(
      req.user.workspaceId,
      to,
      question,
      options,
    );
  }

  /**
   * Listar grupos
   */
  @Get('groups')
  async listGroups(@Request() req: any) {
    return this.whatsAppService.listGroups(req.user.workspaceId);
  }

  /**
   * Listar contatos do WhatsApp
   */
  @Get('contacts')
  async listContacts(@Request() req: any) {
    return this.whatsAppService.listContacts(req.user.workspaceId);
  }

  /**
   * Obter foto de perfil de um contato
   */
  @Get('profile-picture')
  async getProfilePicture(@Query('to') to: string, @Request() req: any) {
    if (!to) {
      throw new BadRequestException('to e obrigatorio');
    }

    const url = await this.whatsAppService.getProfilePicture(req.user.workspaceId, to);
    return { url };
  }

  /**
   * Sincronizar contatos do WhatsApp para o CRM
   */
  @Post('sync-contacts')
  async syncContacts(@Request() req: any) {
    return this.whatsAppService.syncContacts(req.user.workspaceId);
  }

  /**
   * Testar conexão
   */
  @Post('test')
  async testConnection(@Request() req: any) {
    const success = await this.whatsAppService.testConnection(
      req.user.workspaceId,
    );
    return { success, status: success ? 'connected' : 'disconnected' };
  }

  @Get('settings')
  async getSettings(@Request() req: any) {
    const settings = await this.whatsAppService.getSettings(req.user.workspaceId);
    return {
      pollsEnabled: settings?.pollsEnabled ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Request() req: any,
    @Body() body: { pollsEnabled?: boolean },
  ) {
    const settings = await this.whatsAppService.updateSettings(
      req.user.workspaceId,
      { pollsEnabled: body.pollsEnabled },
    );

    return {
      pollsEnabled: settings.pollsEnabled,
    };
  }
}
