import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { StorageUtil } from '../common/utils/storage.util';
import { CreatePollDto, SendPollDto } from './dto/polls.dto';

@Injectable()
export class PollsService {
  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  async createPoll(workspaceId: string, dto: CreatePollDto) {
    const prisma = this.prisma as any;
    const sections = Array.isArray(dto.sections) && dto.sections.length
      ? dto.sections
      : undefined;
    const firstSection = sections?.[0];
    if (!sections && (!dto.question || !dto.options || dto.options.length < 2)) {
      throw new BadRequestException('Preencha pergunta e no minimo 2 opcoes');
    }
    const question = dto.question || firstSection?.question || 'Menu principal';
    const options = dto.options || firstSection?.options?.map((option) => option.label) || [];

    const campaign = await prisma.pollCampaign.create({
      data: {
        workspaceId,
        name: dto.name,
        introTitle: dto.introTitle?.trim() || undefined,
        introInfo: dto.introInfo?.trim() || undefined,
        introMessage: dto.introMessage?.trim() || undefined,
        question,
        options,
        followUps: dto.followUps || undefined,
        sections: sections || undefined,
        useNative: dto.useNative ?? true,
        autoStart: dto.autoStart ?? false,
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
    const sections = Array.isArray(poll.sections) ? poll.sections : null;
    const options = Array.isArray(poll.options) ? poll.options : [];

    if (sections?.length) {
      const firstSection = sections[0];
      if (!firstSection?.options?.length) {
        throw new BadRequestException('Enquete sem opcoes');
      }
    } else if (!options.length) {
      throw new BadRequestException('Enquete sem opcoes');
    }

    const phoneNumbers = dto.phoneNumbers || [];
    const groupIds = dto.groupIds || [];

    if (!phoneNumbers.length && !groupIds.length) {
      throw new BadRequestException('Nenhum destinatario informado');
    }

    const recipients: any[] = [];

    for (const phoneNumber of phoneNumbers) {
      const normalizedPhone = phoneNumber.replace(/@s\.whatsapp\.net|@lid/g, '');
      const targetJid = phoneNumber.includes('@')
        ? phoneNumber
        : `${phoneNumber}@s.whatsapp.net`;
      const messageId = await this.whatsAppService.sendPollCampaignMessage(
        workspaceId,
        poll,
        targetJid,
        normalizedPhone || phoneNumber,
        { sectionIndex: 0 },
      );

      recipients.push(
        await prisma.pollRecipient.create({
          data: {
            campaignId: poll.id,
            targetJid,
            phoneNumber: normalizedPhone || phoneNumber,
            targetType: 'contact',
            pollMessageId: messageId,
            status: 'SENT',
          },
        }),
      );
    }

    for (const groupId of groupIds) {
      const target = groupId.includes('@') ? groupId : `${groupId}@g.us`;
      const messageId = await this.whatsAppService.sendPollCampaignMessage(
        workspaceId,
        poll,
        target,
        undefined,
        { sectionIndex: 0 },
      );

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

  async attachIntroFile(
    workspaceId: string,
    pollId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const poll = await this.getPoll(workspaceId, pollId);
    const storage = new StorageUtil({
      provider: 'local',
      path: process.env.STORAGE_PATH || './storage',
    });

    const extension = path.extname(file.originalname || '');
    const safeName = `${poll.id}-${Date.now()}-${nanoid(6)}${extension}`;
    const saved = await storage.saveFile(file.buffer, safeName, 'polls');

    const prisma = this.prisma as any;
    return prisma.pollCampaign.update({
      where: { id: poll.id },
      data: {
        introFilePath: saved.path,
        introFileName: file.originalname,
        introFileMime: file.mimetype,
      },
    });
  }

  async attachFollowUpFile(
    workspaceId: string,
    pollId: string,
    index: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const poll = await this.getPoll(workspaceId, pollId);
    const followUps = (poll.followUps as Record<string, any>) || {};
    const followUp = followUps[index];

    if (!followUp) {
      throw new BadRequestException('Submenu nao encontrado');
    }

    const storage = new StorageUtil({
      provider: 'local',
      path: process.env.STORAGE_PATH || './storage',
    });

    const extension = path.extname(file.originalname || '');
    const safeName = `${poll.id}-${index}-${Date.now()}-${nanoid(6)}${extension}`;
    const saved = await storage.saveFile(file.buffer, safeName, 'polls');

    followUps[index] = {
      ...followUp,
      introFilePath: saved.path,
      introFileName: file.originalname,
      introFileMime: file.mimetype,
    };

    const prisma = this.prisma as any;
    return prisma.pollCampaign.update({
      where: { id: poll.id },
      data: {
        followUps,
      },
    });
  }

  async attachSectionFile(
    workspaceId: string,
    pollId: string,
    index: number,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const poll = await this.getPoll(workspaceId, pollId);
    const sections = Array.isArray(poll.sections) ? [...poll.sections] : [];
    const section = sections[index];

    if (!section) {
      throw new BadRequestException('Secao nao encontrada');
    }

    const storage = new StorageUtil({
      provider: 'local',
      path: process.env.STORAGE_PATH || './storage',
    });

    const extension = path.extname(file.originalname || '');
    const safeName = `${poll.id}-section-${index}-${Date.now()}-${nanoid(6)}${extension}`;
    const saved = await storage.saveFile(file.buffer, safeName, 'polls');

    sections[index] = {
      ...section,
      introFilePath: saved.path,
      introFileName: file.originalname,
      introFileMime: file.mimetype,
    };

    const prisma = this.prisma as any;
    return prisma.pollCampaign.update({
      where: { id: poll.id },
      data: {
        sections,
      },
    });
  }

  async attachSectionOptionFile(
    workspaceId: string,
    pollId: string,
    sectionIndex: number,
    optionIndex: number,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const poll = await this.getPoll(workspaceId, pollId);
    const sections = Array.isArray(poll.sections) ? [...poll.sections] : [];
    const section = sections[sectionIndex];

    if (!section) {
      throw new BadRequestException('Secao nao encontrada');
    }

    const options = Array.isArray(section.options) ? [...section.options] : [];
    const option = options[optionIndex];

    if (!option) {
      throw new BadRequestException('Opcao nao encontrada');
    }

    const storage = new StorageUtil({
      provider: 'local',
      path: process.env.STORAGE_PATH || './storage',
    });

    const extension = path.extname(file.originalname || '');
    const safeName = `${poll.id}-section-${sectionIndex}-option-${optionIndex}-${Date.now()}-${nanoid(6)}${extension}`;
    const saved = await storage.saveFile(file.buffer, safeName, 'polls');

    options[optionIndex] = {
      ...option,
      replyFilePath: saved.path,
      replyFileName: file.originalname,
      replyFileMime: file.mimetype,
    };

    sections[sectionIndex] = {
      ...section,
      options,
    };

    const prisma = this.prisma as any;
    return prisma.pollCampaign.update({
      where: { id: poll.id },
      data: {
        sections,
      },
    });
  }

  async getInteractions(workspaceId: string, pollId: string) {
    const poll = await this.getPoll(workspaceId, pollId);

    const prisma = this.prisma as any;
    const interactions = await prisma.pollInteraction.findMany({
      where: { campaignId: poll.id },
      include: { recipient: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const counts = new Map<string, number>();
    interactions.forEach((interaction: { selectedOption?: string | null }) => {
      const key = interaction.selectedOption || 'Sem resposta';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const sections = Array.isArray(poll.sections) ? poll.sections : [];
    const sectionCounts = new Map<string, number>();
    interactions.forEach((interaction: { flowStep?: number | null }) => {
      const sectionIndex = interaction.flowStep ?? 0;
      const sectionTitle = sections[sectionIndex]?.title || `Secao ${sectionIndex + 1}`;
      sectionCounts.set(sectionTitle, (sectionCounts.get(sectionTitle) || 0) + 1);
    });

    return {
      poll,
      interactions: interactions.map((interaction: any) => ({
        ...interaction,
        phoneNumber: interaction.recipient?.phoneNumber || null,
        sectionTitle:
          sections[interaction.flowStep ?? 0]?.title || `Secao ${(interaction.flowStep ?? 0) + 1}`,
      })),
      counts: Array.from(counts.entries()).map(([option, total]) => ({ option, total })),
      sectionSummary: Array.from(sectionCounts.entries()).map(([section, total]) => ({
        section,
        total,
      })),
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
