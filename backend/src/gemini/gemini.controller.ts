import {
  Controller,
  Get,
  Post,
  Put,
  Request,
  Body,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Controller('settings/gemini')
export class GeminiController {
  constructor(private geminiService: GeminiService) {}

  @Get()
  async getSettings(@Request() req: any) {
    return this.geminiService.getSettings(req.user.workspaceId);
  }

  @Post()
  async updateSettings(@Body() data: any, @Request() req: any) {
    return this.geminiService.updateSettings(req.user.workspaceId, data);
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
}
