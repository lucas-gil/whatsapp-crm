import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '../../common/utils/logger.util';

@Injectable()
export class LeadsService {
  private logger = new Logger('LeadsService');

  constructor(private prisma: PrismaService) {}

  async createLead(workspaceId: string, data: any) {
    const lead = await this.prisma.lead.upsert({
      where: {
        workspaceId_phoneNumber: {
          workspaceId,
          phoneNumber: data.phoneNumber,
        },
      },
      update: {
        name: data.name || undefined,
        email: data.email || undefined,
        avatarUrl: data.avatarUrl || undefined,
      },
      create: {
        workspaceId,
        phoneNumber: data.phoneNumber,
        name: data.name || 'Novo Lead',
        email: data.email,
        avatarUrl: data.avatarUrl,
        pipelineStage: 'novo',
        optIn: true,
        optInDate: new Date(),
      },
    });

    this.logger.info(`Lead criado/atualizado: ${lead.phoneNumber}`);
    return lead;
  }

  async listLeads(workspaceId: string, filters?: any) {
    const where: any = { workspaceId };

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phoneNumber: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.pipelineStage) {
      where.pipelineStage = filters.pipelineStage;
    }

    if (filters?.optIn !== undefined) {
      where.optIn = filters.optIn;
    }

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: (filters?.page || 0) * (filters?.limit || 50),
    });

    return leads;
  }

  async getLead(workspaceId: string, leadId: string) {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        tags: { include: { tag: true } },
        conversations: { include: { messages: true } },
      },
    });
  }

  async updateLead(workspaceId: string, leadId: string, data: any) {
    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data,
    });

    this.logger.info(`Lead atualizado: ${leadId}`);
    return lead;
  }

  async optOutLead(workspaceId: string, leadId: string, reason?: string) {
    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        optIn: false,
        optOutDate: new Date(),
        optOutReason: reason,
      },
    });

    this.logger.info(`Lead optou por sair: ${leadId}`);
    return lead;
  }

  async addTag(leadId: string, tagId: string) {
    return this.prisma.leadTag.create({
      data: { leadId, tagId },
      include: { tag: true },
    });
  }

  async removeTag(leadId: string, tagId: string) {
    return this.prisma.leadTag.delete({
      where: { leadId_tagId: { leadId, tagId } },
    });
  }
}
