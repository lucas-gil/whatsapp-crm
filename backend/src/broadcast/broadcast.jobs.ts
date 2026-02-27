import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Logger } from '../common/utils/logger.util';

@Injectable()
export class BroadcastJobs implements OnModuleInit {
  private logger = new Logger('BroadcastJobs');
  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    this.queue.registerQueue({ name: 'broadcast', handler: async (job: any) => this.handleBroadcast(job) });
    this.logger.info('Broadcast queue registrada: broadcast');
  }

  async handleBroadcast(job: any) {
    const { mapKey, broadcastId, recipients } = job.data || {};
    if (!broadcastId || !Array.isArray(recipients)) {
      this.logger.error('Job de broadcast inválido: payload incompleto');
      return;
    }

    for (const r of recipients) {
      const recipient = await this.prisma.broadcastRecipient.findUnique({ where: { id: r.id } });
      if (!recipient) continue;
      if (recipient.status !== 'PENDING') continue;

      try {
        const to = recipient.phoneNumber;
        const msg = (await this.prisma.broadcast.findUnique({ where: { id: broadcastId } }))?.message || '';
        // Enviar como texto simples (pode ser estendido para mídia/templates)
        await this.whatsapp.sendText(mapKey || '', to, msg);
        await this.prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: 'SENT', sentAt: new Date() } });
      } catch (e) {
        this.logger.error('Erro ao processar recipient broadcast:', e instanceof Error ? e.message : String(e));
        try {
          await this.prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED' } });
        } catch {}
      }
    }

    // Optionally mark broadcast as completed if all recipients done
    const remaining = await this.prisma.broadcastRecipient.count({ where: { broadcastId, status: 'PENDING' } });
    if (remaining === 0) {
      await this.prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    }
  }
}
