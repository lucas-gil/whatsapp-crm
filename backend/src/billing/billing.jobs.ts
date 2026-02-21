import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../common/utils/logger.util';

@Injectable()
export class BillingJobs implements OnModuleInit {
  private logger = new Logger('BillingJobs');
  constructor(private queue: QueueService, private billing: BillingService, private prisma: PrismaService) {}

  onModuleInit() {
    // Registrar handler para enviar mensagens em lote
    this.queue.registerQueue({ name: 'billing-send', handler: async (job: any) => this.handleSend(job) });
    // Registrar handler para recalcular status diário
    this.queue.registerQueue({ name: 'billing-daily', handler: async (job: any) => this.handleDaily(job) });
    this.logger.info('Billing queues registradas: billing-send, billing-daily');
  }

  async handleSend(job: any) {
    const { chargeId, workspaceId, text, templateName } = job.data || {};
    try {
      await this.billing.sendChargeMessage(workspaceId, chargeId, text, undefined, templateName);
    } catch (e) {
      this.logger.error('Erro ao enviar cobrança via queue:', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async handleDaily(job: any) {
    // recalcular status de cobranças: atualizar diasLate e status baseado em dueDate
    const workspaceId = job.data?.workspaceId;
    const today = new Date();
    const charges = await this.prisma.charge.findMany({ where: { workspaceId } });
    await Promise.all(
      charges.map(async ch => {
        const daysLate = Math.max(0, Math.floor((today.getTime() - ch.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        let status = ch.status;
        if (ch.paidAt) status = 'PAID';
        else if (daysLate <= 0) status = 'A_VENCER';
        else status = 'VENCIDO';
        await this.prisma.charge.update({ where: { id: ch.id }, data: { daysLate, status } });
      }),
    );
    this.logger.info('Recalculo diário de cobranças concluído:', workspaceId || 'all');
  }
}
