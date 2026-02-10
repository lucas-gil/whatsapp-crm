import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBroadcastDto, UpdateBroadcastDto, AddBroadcastRecipientsDto } from './dto/broadcast.dto';

@Injectable()
export class BroadcastService {
  constructor(private prisma: PrismaService) {}

  /**
   * Criar novo broadcast (disparador em massa)
   */
  async createBroadcast(workspaceId: string, dto: CreateBroadcastDto) {
    const broadcast = await this.prisma.broadcast.create({
      data: {
        workspaceId,
        name: dto.name,
        message: dto.message,
        templateId: dto.templateId,
        tagFilter: dto.tagFilter || [],
        stageFilter: dto.stageFilter,
        messagesPerMinute: dto.messagesPerMinute || 20,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        status: 'DRAFT',
      },
    });

    return broadcast;
  }

  /**
   * Listar broadcasts
   */
  async listBroadcasts(workspaceId: string, status?: string, limit = 20, offset = 0) {
    const where: any = { workspaceId };
    if (status) where.status = status;

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          recipients: { select: { id: true, status: true } },
        },
      }),
      this.prisma.broadcast.count({ where }),
    ]);

    return {
      broadcasts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Obter detalhes de um broadcast
   */
  async getBroadcast(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: {
        recipients: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    return broadcast;
  }

  /**
   * Atualizar broadcast
   */
  async updateBroadcast(workspaceId: string, broadcastId: string, dto: UpdateBroadcastDto) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status !== 'DRAFT') {
      throw new BadRequestException('Apenas broadcasts em DRAFT podem ser atualizados');
    }

    return this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        name: dto.name,
        message: dto.message,
        messagesPerMinute: dto.messagesPerMinute,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      },
    });
  }

  /**
   * Adicionar destinatários ao broadcast
   * 1:1 para contatos específicos
   * Ou grupos
   */
  async addRecipients(
    workspaceId: string,
    broadcastId: string,
    dto: AddBroadcastRecipientsDto,
  ) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status !== 'DRAFT') {
      throw new BadRequestException('Apenas broadcasts em DRAFT podem receber destinatários');
    }

    // Criar recipients baseado em filtros
    const recipients = await Promise.all(
      dto.phoneNumbers.map(phoneNumber =>
        this.prisma.broadcastRecipient.create({
          data: {
            broadcastId,
            phoneNumber,
            status: 'PENDING',
          },
          select: { id: true, phoneNumber: true, status: true },
        }),
      ),
    );

    // Atualizar contagem total
    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        totalRecipients: await this.prisma.broadcastRecipient.count({
          where: { broadcastId },
        }),
      },
    });

    return recipients;
  }

  /**
   * Adicionar grupos ao broadcast
   */
  async addGroupRecipients(
    workspaceId: string,
    broadcastId: string,
    groupIds: string[],
  ) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    // Validar grupos existem
    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds }, workspaceId },
    });

    if (groups.length !== groupIds.length) {
      throw new BadRequestException('Um ou mais grupos não encontrados');
    }

    // Criar recipients para cada grupo
    const recipients = await Promise.all(
      groups.map(group =>
        this.prisma.broadcastRecipient.create({
          data: {
            broadcastId,
            groupId: group.id,
            phoneNumber: group.id, // usar ID do grupo como identificador
            status: 'PENDING',
          },
          select: { id: true, groupId: true, status: true },
        }),
      ),
    );

    return recipients;
  }

  /**
   * Iniciar/executar broadcast (enfileirar envios)
   * Aplicar rate limit + segmentação
   */
  async startBroadcast(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { recipients: true },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status === 'RUNNING' || broadcast.status === 'COMPLETED') {
      throw new BadRequestException('Broadcast já foi iniciado ou completado');
    }

    // Atualizar status
    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // TODO: Enfileirar jobs no BullMQ para enviar mensagens com rate limiting
    // BroadcastQueue.add('send-broadcast', { broadcastId, workspaceId });

    return { status: 'iniciado', broadcastId };
  }

  /**
   * Pausar broadcast
   */
  async pauseBroadcast(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status !== 'RUNNING') {
      throw new BadRequestException('Apenas broadcasts em execução podem ser pausados');
    }

    return this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Retomar broadcast pausado
   */
  async resumeBroadcast(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status !== 'PAUSED') {
      throw new BadRequestException('Apenas broadcasts pausados podem ser retomados');
    }

    return this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'RUNNING' },
    });
  }

  /**
   * Deletar broadcast
   */
  async deleteBroadcast(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    if (broadcast.status === 'RUNNING' || broadcast.status === 'COMPLETED') {
      throw new BadRequestException('Não é possível deletar broadcasts em execução ou completados');
    }

    await this.prisma.broadcastRecipient.deleteMany({
      where: { broadcastId },
    });

    await this.prisma.broadcast.delete({
      where: { id: broadcastId },
    });

    return { message: 'Broadcast deletado com sucesso' };
  }

  /**
   * Obter relatório/estatísticas do broadcast
   */
  async getBroadcastStatistics(workspaceId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast || broadcast.workspaceId !== workspaceId) {
      throw new NotFoundException('Broadcast não encontrado');
    }

    const recipientStats = await this.prisma.broadcastRecipient.groupBy({
      by: ['status'],
      where: { broadcastId },
      _count: true,
    });

    const stats = {
      broadcast: {
        id: broadcast.id,
        name: broadcast.name,
        status: broadcast.status,
        totalRecipients: broadcast.totalRecipients,
        createdAt: broadcast.createdAt,
        startedAt: broadcast.startedAt,
        completedAt: broadcast.completedAt,
      },
      recipients: {
        pending: recipientStats.find(s => s.status === 'PENDING')?._count || 0,
        sent: recipientStats.find(s => s.status === 'SENT')?._count || 0,
        failed: recipientStats.find(s => s.status === 'FAILED')?._count || 0,
        optedOut: recipientStats.find(s => s.status === 'OPTED_OUT')?._count || 0,
        invalidNumber: recipientStats.find(s => s.status === 'INVALID_NUMBER')?._count || 0,
      },
    };

    return stats;
  }
}
