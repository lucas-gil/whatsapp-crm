import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

interface AuthRequest {
  user: {
    workspaceId: string;
    id: string;
  };
}

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private whatsAppService: WhatsAppService) {}

  @Post('init')
  async init(@Request() req) {
    return this.whatsAppService.initializeWorkspace(req.user.workspaceId);
  }

  @Get('qr-code')
  async getQRCode(@Request() req) {
    const qr = await this.whatsAppService.getQRCode(req.user.workspaceId);
    return { qrCode: qr };
  }

  @Get('status')
  async getStatus(@Request() req) {
    const connected = await this.whatsAppService.isConnected(
      req.user.workspaceId,
    );
    return { connected };
  }

  @Post('send-text')
  async sendText(@Body() { to, text }: any, @Request() req) {
    return this.whatsAppService.sendText(req.user.workspaceId, to, text);
  }

  @Post('send-media')
  @UseInterceptors(FileInterceptor('file'))
  async sendMedia(
    @UploadedFile() file: any,
    @Body('to') to: string,
    @Body('caption') caption: string,
    @Request() req,
  ) {
    return this.whatsAppService.sendMedia(
      req.user.workspaceId,
      to,
      file.buffer,
      file.originalname,
      file.mimetype,
      caption,
    );
  }

  @Post('send-poll')
  async sendPoll(
    @Body() { to, question, options }: any,
    @Request() req,
  ) {
    return this.whatsAppService.sendPoll(
      req.user.workspaceId,
      to,
      question,
      options,
    );
  }

  @Get('groups')
  async listGroups(@Request() req) {
    return this.whatsAppService.listGroups(req.user.workspaceId);
  }

  @Post('test')
  async testConnection(@Request() req) {
    const success = await this.whatsAppService.testConnection(
      req.user.workspaceId,
    );
    return { success };
  }
}
