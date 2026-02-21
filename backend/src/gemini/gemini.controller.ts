import {
  Controller,
  Get,
  Post,
  Put,
  Request,
  Body,
} from '@nestjs/common';
import { UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeminiService } from './gemini.service';

@Controller('settings/gemini')
export class GeminiController {
  constructor(private geminiService: GeminiService) {}

  @Get()
  async getSettings(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const licenseKeyId = req.user.licenseKeyId;
    return this.geminiService.getSettings(workspaceId, licenseKeyId);
  }

  @Post()
  async updateSettings(@Body() data: any, @Request() req: any) {
    const workspaceId = req.user.workspaceId;
    const licenseKeyId = req.user.licenseKeyId;
    const isAdmin = !!req.user.isAdmin;
    return this.geminiService.updateSettings(workspaceId, data, licenseKeyId, isAdmin);
  }

  @Post('test')
  async testConnection(@Body('message') message: string, @Request() req: any) {
    const reply = await this.geminiService.generateReply(
      req.user.workspaceId,
      'Test User',
      [{ role: 'user', content: message }],
    );
    return { reply };
  }

  @Post('upload-context')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContextFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo nao enviado');

    return this.geminiService.attachContextFile(req.user.workspaceId, file);
  }
}
