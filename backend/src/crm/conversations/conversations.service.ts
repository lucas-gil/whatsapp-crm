import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { Logger } from '../../common/utils/logger.util';

@Injectable()
export class ConversationsService {
  private logger = new Logger('ConversationsService');
  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  async listConversations(workspaceId: string, filters?: any) {
    return this.prisma.conversation.findMany({
      where: {
        workspaceId,
        status: filters?.status || 'ACTIVE',
      },
      include: {
        lead: true,
        group: true,
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: filters?.limit || 50,
    });
  }

  async getConversation(workspaceId: string, conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true,
        group: true,
        messages: {
          include: { attachments: true },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  async sendMessage(workspaceId: string, conversationId: string, data: any) {
    // Salva a mensagem no banco
    const message = await this.prisma.message.create({
      data: {
        workspaceId,
        conversationId,
        text: data.text,
        type: data.type || 'text',
        direction: 'OUTGOING',
        status: 'SENDING',
      },
      include: { attachments: true },
    });

    // Busca o destinatário (lead ou grupo)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true, group: true },
    });
    let to = '';
    if (conversation?.lead?.phoneNumber) {
      to = conversation.lead.phoneNumber;
    } else if (conversation?.group?.whatsappGroupId) {
      to = conversation.group.whatsappGroupId;
    }

    // Envia a mensagem real pelo WhatsApp
    if (to && data.text) {
      try {
        await this.whatsAppService.sendText(workspaceId, to, data.text);
        // Atualiza status para 'SENT'
        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: 'SENT' },
        });
      } catch (error) {
        this.logger.error(`Erro ao enviar mensagem WhatsApp para ${to}: ${error?.message || error}`);
        this.logger.error(error?.stack || error);
        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        });
      }
    }
    return message;
  }

  async markAsRead(workspaceId: string, conversationId: string) {
    await this.prisma.message.updateMany({
      where: {
        workspaceId,
        conversationId,
        direction: 'INCOMING',
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
        updatedAt: new Date(),
      },
    });

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async archiveConversation(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'ARCHIVED' },
    });
  }
}
