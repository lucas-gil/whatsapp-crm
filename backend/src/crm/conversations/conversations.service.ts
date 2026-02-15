import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.message.create({
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
