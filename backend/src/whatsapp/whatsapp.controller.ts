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

      const sessionId = req.user.sessionId || null;
      const settings = await this.whatsAppService.initializeWorkspace(workspaceId, sessionId, { forceNewSession: true });
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
    const sessionId = req.user.sessionId || null;
    const mapKey = sessionId ? `${workspaceId}:${sessionId}` : workspaceId;
    const qrCode = await this.whatsAppService.getQRCode(mapKey);

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
    const sessionId = req.user.sessionId || null;
    const mapKey = sessionId ? `${workspaceId}:${sessionId}` : workspaceId;

    try {
      const connected = await this.whatsAppService.isConnected(mapKey);
      const state = connected ? 'connected' : 'disconnected';

      // Return standardized status shape
      return {
        connected,
        state,
        me: null, // optional: provider 'me' info not available in minimal implementation
        lastChangeAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        connected: false,
        state: 'disconnected',
        me: null,
        lastChangeAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Desconectar WhatsApp
   */
  @Post('disconnect')
  async disconnect(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const sessionId = req.user.sessionId || null;
    const mapKey = sessionId ? `${workspaceId}:${sessionId}` : workspaceId;
    await this.whatsAppService.disconnect(mapKey);

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

    const sessionId = req.user.sessionId || null;
    const mapKey = sessionId ? `${req.user.workspaceId}:${sessionId}` : req.user.workspaceId;
    return this.whatsAppService.sendText(mapKey, to, text);
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
      req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId,
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

    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    return this.whatsAppService.sendPoll(
      mapKey,
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
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    return this.whatsAppService.listGroups(mapKey);
  }

  /**
   * Listar contatos do WhatsApp
   */
  @Get('contacts')
  async listContacts(@Request() req: any) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    try {
      const providerContacts = await this.whatsAppService.listContacts(mapKey);

      // Normalize into the required shape
      const normalized = (providerContacts || []).map((c: any) => ({
        id: c.id || c.jid || c.phoneNumber,
        jid: c.id || c.jid || null,
        type: c.id && String(c.id).endsWith('@g.us') ? 'group' : 'contact',
        displayName: c.displayName || c.name || c.notify || c.phoneNumber || c.phoneNumber,
        phone: c.phoneNumber || null,
        profilePicUrl: c.profilePicUrl || null,
      }));

      return normalized;
    } catch (err: any) {
      // If not connected, return empty list (UI should show "Conecte o WhatsApp")
      const msg = err?.message || String(err);
      if (/not connected|nao esta conectado|WhatsApp não está conectado/i.test(msg)) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Obter foto de perfil de um contato
   */
  @Get('profile-picture')
  async getProfilePicture(@Query('to') to: string, @Request() req: any) {
    if (!to) {
      throw new BadRequestException('to e obrigatorio');
    }

    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    try {
      const url = await this.whatsAppService.getProfilePicture(mapKey, to);
      if (!url) {
        return {
          error: true,
          code: 'PROFILE_PIC_NOT_FOUND',
          message: 'Foto de perfil não encontrada',
        };
      }
      return { url };
    } catch (err: any) {
      const msg = err?.message || String(err || 'Erro desconhecido');
      if (/not connected|nao esta conectado|WhatsApp não está conectado/i.test(msg)) {
        throw new BadRequestException({ error: true, code: 'WHATSAPP_NOT_CONNECTED', message: 'WhatsApp não está conectado' });
      }
      // Generic failure -> return structured JSON with 500
      throw new BadRequestException({ error: true, code: 'PROFILE_PIC_ERROR', message: msg });
    }
  }

  /**
   * Sincronizar contatos do WhatsApp para o CRM
   */
  @Post('sync-contacts')
  async syncContacts(@Request() req: any) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    return this.whatsAppService.syncContacts(mapKey);
  }

  /**
   * Cleanup fake contacts/groups not present on the connected WhatsApp provider.
   * Use { dryRun: true } to preview candidates.
   */
  @Post('cleanup-fake')
  async cleanupFake(@Body() body: { dryRun?: boolean }, @Request() req: any) {
    const dryRun = body?.dryRun !== false; // default true
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    try {
      const result = await this.whatsAppService.cleanupFakeEntities(mapKey, dryRun);
      return { success: true, dryRun, result };
    } catch (err: any) {
      const msg = err?.message || String(err || 'Erro desconhecido');
      throw new BadRequestException({ error: true, code: 'CLEANUP_ERROR', message: msg });
    }
  }

  /**
   * Remover todas as mensagens OUTGOING deste workspace (limpeza administrativa)
   */
  @Post('cleanup-outgoing')
  async cleanupOutgoing(@Request() req: any) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    return this.whatsAppService.deleteOutgoingMessages(mapKey);
  }

  /**
   * Testar conexão
   */
  @Post('test')
  async testConnection(@Request() req: any) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    const success = await this.whatsAppService.testConnection(
      mapKey,
    );
    return { success, status: success ? 'connected' : 'disconnected' };
  }

  @Get('settings')
  async getSettings(@Request() req: any) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    const settings = await this.whatsAppService.getSettings(mapKey);
    return {
      pollsEnabled: settings?.pollsEnabled ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Request() req: any,
    @Body() body: { pollsEnabled?: boolean },
  ) {
    const mapKey = req.user.sessionId ? `${req.user.workspaceId}:${req.user.sessionId}` : req.user.workspaceId;
    const settings = await this.whatsAppService.updateSettings(
      mapKey,
      { pollsEnabled: body.pollsEnabled },
    );

    return {
      pollsEnabled: settings.pollsEnabled,
    };
  }
}
