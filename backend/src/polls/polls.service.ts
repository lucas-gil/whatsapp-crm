import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreatePollDto, SendPollDto } from './dto/polls.dto';

@Injectable()
export class PollsService {
  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  async createPoll(workspaceId: string, dto: CreatePollDto) {
    const prisma = this.prisma as any;
    const campaign = await prisma.pollCampaign.create({
      data: {
        workspaceId,
        name: dto.name,
        question: dto.question,
        options: dto.options,
        followUps: dto.followUps || undefined,
        useNative: dto.useNative ?? true,
      },
    });

    return campaign;
  }

  async listPolls(workspaceId: string) {
    const prisma = this.prisma as any;
    return prisma.pollCampaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPoll(workspaceId: string, pollId: string) {
    const prisma = this.prisma as any;
    const poll = await prisma.pollCampaign.findUnique({
      where: { id: pollId },
    });

    if (!poll || poll.workspaceId !== workspaceId) {
      throw new NotFoundException('Enquete nao encontrada');
    }

    return poll;
  }

  async sendPoll(workspaceId: string, pollId: string, dto: SendPollDto) {
    const poll = await this.getPoll(workspaceId, pollId);
    const prisma = this.prisma as any;
    const options = Array.isArray(poll.options) ? poll.options : [];

    if (!options.length) {
      throw new BadRequestException('Enquete sem opcoes');
    }

    const phoneNumbers = dto.phoneNumbers || [];
    const groupIds = dto.groupIds || [];

    if (!phoneNumbers.length && !groupIds.length) {
      throw new BadRequestException('Nenhum destinatario informado');
    }

    const recipients: any[] = [];

    for (const phoneNumber of phoneNumbers) {
      const messageId = poll.useNative
        ? await this.whatsAppService.sendPoll(workspaceId, phoneNumber, poll.question, options)
        : await this.whatsAppService.sendText(workspaceId, phoneNumber, this.buildFallbackText(poll.question, options));

      if (poll.useNative) {
        await this.whatsAppService.sendText(workspaceId, phoneNumber, this.buildFallbackText(poll.question, options));
      }

      recipients.push(
        await prisma.pollRecipient.create({
          data: {
            campaignId: poll.id,
            targetJid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
            phoneNumber,
            targetType: 'contact',
            pollMessageId: messageId,
            status: 'SENT',
          },
        }),
      );
    }

    for (const groupId of groupIds) {
      const target = groupId.includes('@') ? groupId : `${groupId}@g.us`;
      const messageId = poll.useNative
        ? await this.whatsAppService.sendPoll(workspaceId, target, poll.question, options)
        : await this.whatsAppService.sendText(workspaceId, target, this.buildFallbackText(poll.question, options));

      if (poll.useNative) {
        await this.whatsAppService.sendText(workspaceId, target, this.buildFallbackText(poll.question, options));
      }

      recipients.push(
        await prisma.pollRecipient.create({
          data: {
            campaignId: poll.id,
            targetJid: target,
            targetType: 'group',
            pollMessageId: messageId,
            status: 'SENT',
          },
        }),
      );
    }

    return {
      pollId: poll.id,
      sent: recipients.length,
    };
  }

  async getInteractions(workspaceId: string, pollId: string) {
    const poll = await this.getPoll(workspaceId, pollId);

    const prisma = this.prisma as any;
    const interactions = await prisma.pollInteraction.findMany({
      where: { campaignId: poll.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const counts = new Map<string, number>();
    interactions.forEach((interaction: { selectedOption?: string | null }) => {
      const key = interaction.selectedOption || 'Sem resposta';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return {
      poll,
      interactions,
      counts: Array.from(counts.entries()).map(([option, total]) => ({ option, total })),
    };
  }

  private buildFallbackText(question: string, options: string[]) {
    const header = `🗳️ *Enquete*\n${question}`;
    const items = options
      .map((option, index) => `${index + 1}) ${option}`)
      .join('\n');
    return `${header}\n\n${items}\n\nResponda com o numero da opcao.`;
  }
}
