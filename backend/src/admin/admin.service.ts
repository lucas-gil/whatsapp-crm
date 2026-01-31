import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../common/utils/logger.util';

@Injectable()
export class AdminService {
  private logger = new Logger('AdminService');

  constructor(private prisma: PrismaService) {}

  async getAuditLogs(workspaceId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: {
        licenseKey: {
          workspaceId,
        },
      },
      include: { licenseKey: { select: { keyPreview: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUserSessions(workspaceId: string) {
    return this.prisma.userSession.findMany({
      where: { workspaceId },
      include: { licenseKey: { select: { keyPreview: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkspaceStats(workspaceId: string) {
    const [leadsCount, conversationsCount, messagesCount, broadcastsCount] =
      await Promise.all([
        this.prisma.lead.count({ where: { workspaceId } }),
        this.prisma.conversation.count({ where: { workspaceId } }),
        this.prisma.message.count({ where: { workspaceId } }),
        this.prisma.broadcast.count({ where: { workspaceId } }),
      ]);

    return {
      leads: leadsCount,
      conversations: conversationsCount,
      messages: messagesCount,
      broadcasts: broadcastsCount,
    };
  }

  async invalidateSession(sessionId: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date() },
    });

    this.logger.info(`Sessão invalidada: ${sessionId}`);
  }
}
