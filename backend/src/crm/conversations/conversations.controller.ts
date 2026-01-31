import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '@auth/jwt.guard';

@Controller('crm/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  async listConversations(@Query('status') status?: string, @Request() req) {
    return this.conversationsService.listConversations(
      req.user.workspaceId,
      { status },
    );
  }

  @Get(':id')
  async getConversation(@Param('id') id: string, @Request() req) {
    return this.conversationsService.getConversation(req.user.workspaceId, id);
  }

  @Post(':id/messages')
  async sendMessage(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.conversationsService.sendMessage(req.user.workspaceId, id, data);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.conversationsService.markAsRead(id);
  }

  @Put(':id/archive')
  async archiveConversation(@Param('id') id: string) {
    return this.conversationsService.archiveConversation(id);
  }
}
