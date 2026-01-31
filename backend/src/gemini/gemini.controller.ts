import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { JwtAuthGuard } from '@auth/jwt.guard';

@Controller('settings/gemini')
@UseGuards(JwtAuthGuard)
export class GeminiController {
  constructor(private geminiService: GeminiService) {}

  @Get()
  async getSettings(@Request() req) {
    return this.geminiService.getSettings(req.user.workspaceId);
  }

  @Post()
  async updateSettings(@Body() data: any, @Request() req) {
    return this.geminiService.updateSettings(req.user.workspaceId, data);
  }

  @Post('test')
  async testConnection(@Body('message') message: string, @Request() req) {
    const reply = await this.geminiService.generateReply(
      req.user.workspaceId,
      'Test User',
      [{ role: 'user', content: message }],
    );
    return { reply };
  }
}
