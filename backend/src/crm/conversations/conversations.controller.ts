import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('crm/conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  async listConversations(
    @Query('status') status: string | undefined,
  ) {
    const defaultWorkspaceId = 'default';
    return this.conversationsService.listConversations(
      defaultWorkspaceId,
      { status },
    );
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    const defaultWorkspaceId = 'default';
    return this.conversationsService.getConversation(defaultWorkspaceId, id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    const defaultWorkspaceId = 'default';
    return this.conversationsService.sendMessage(defaultWorkspaceId, id, data);
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
