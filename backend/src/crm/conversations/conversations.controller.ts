import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

@Controller('crm/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  async listConversations(
    @Query('status') status: string | undefined,
    @Request() req: any,
  ) {
    return this.conversationsService.listConversations(
      req.user.workspaceId,
      { status },
    );
  }

  @Get(':id')
  async getConversation(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.getConversation(req.user.workspaceId, id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.conversationsService.sendMessage(req.user.workspaceId, id, data);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.markAsRead(req.user.workspaceId, id);
  }

  @Put(':id/archive')
  async archiveConversation(@Param('id') id: string) {
    return this.conversationsService.archiveConversation(id);
  }

  /**
   * GET /crm/conversations/grouped-by-client
   * Lista conversas agrupadas por cliente (lead)
   */
  @Get('grouped-by-client')
  async getGroupedByClient(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    // Busca todas as conversas com lead e mensagens
    const conversations = await this.conversationsService.listConversations(workspaceId);
    // Agrupa por cliente (lead)
    const grouped: Record<string, any> = {};
    for (const conv of conversations) {
      if (!conv.lead) continue;
      if (!grouped[conv.lead.id]) {
        grouped[conv.lead.id] = {
          client: {
            id: conv.lead.id,
            name: conv.lead.name,
            phoneNumber: conv.lead.phoneNumber,
          },
          messages: [],
        };
      }
      if (conv.messages && conv.messages.length > 0) {
        grouped[conv.lead.id].messages.push(...conv.messages.map((m: any) => ({
          id: m.id,
          text: m.text,
          date: m.createdAt,
          direction: m.direction,
        })));
      }
    }
    return { conversations: Object.values(grouped) };
  }
}
