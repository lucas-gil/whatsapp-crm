import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService, private whatsapp: WhatsAppService) {}

  async createClient(workspaceId: string, data: any) {
    // Validação básica
    if (!data.name || !data.phoneNumber) {
      throw new BadRequestException('Nome e telefone são obrigatórios');
    }
    // Verifica duplicidade
    const exists = await this.prisma.billingClient.findFirst({
      where: {
        workspaceId,
        phoneNumber: data.phoneNumber
      }
    });
    if (exists) {
      throw new BadRequestException('Cliente já cadastrado com esse telefone');
    }
    const client = await this.prisma.billingClient.create({ data: { ...data, workspaceId } });
    return client;
  }

  async listClients(workspaceId: string, q?: string, limit = 50, offset = 0) {
    const where: any = { workspaceId };
    if (q) {
      where.OR = [{ name: { contains: q } }, { phoneNumber: { contains: q } }];
    }
    const [clients, total] = await Promise.all([
      this.prisma.billingClient.findMany({ where, take: limit, skip: offset, orderBy: { updatedAt: 'desc' } }),
      this.prisma.billingClient.count({ where }),
    ]);
    return { clients, total, limit, offset };
  }

  async createCharge(workspaceId: string, clientId: string, dto: any) {
    const client = await this.prisma.billingClient.findUnique({ where: { id: clientId } });
    if (!client || client.workspaceId !== workspaceId) throw new NotFoundException('Cliente não encontrado');
    // Validação dos campos obrigatórios
    if (!dto.amount || !dto.dueDate) {
      throw new BadRequestException('Valor e data de vencimento são obrigatórios');
    }
    // currency opcional, default BRL
    const charge = await this.prisma.charge.create({
      data: {
        ...dto,
        clientId,
        workspaceId,
        currency: dto.currency || 'BRL'
      }
    });
    return charge;
  }

  async listCharges(workspaceId: string, filter: any = {}, limit = 50, offset = 0) {
    const where: any = { workspaceId, ...filter };
    const [charges, total] = await Promise.all([
      this.prisma.charge.findMany({ where, take: limit, skip: offset, orderBy: { dueDate: 'asc' }, include: { client: true } }),
      this.prisma.charge.count({ where }),
    ]);
    return { charges, total, limit, offset };
  }

  async sendChargeMessage(workspaceId: string, chargeId: string, text: string, tone?: string, templateName?: string) {
    const charge = await this.prisma.charge.findUnique({ where: { id: chargeId }, include: { client: true } });
    if (!charge || charge.workspaceId !== workspaceId) throw new NotFoundException('Cobrança não encontrada');
    if (!charge.client) throw new BadRequestException('Cobrança sem cliente associado');

    // respeitar opt-out
    if (charge.client.optOut) throw new BadRequestException('Cliente opt-out');

    // enviar via WhatsAppService
    const to = charge.client.phoneNumber;
    const resp = await this.whatsapp.sendText(workspaceId, to, text);

    // registrar MessageLog
    await this.prisma.messageLog.create({ data: {
      workspaceId,
      chargeId: charge.id,
      toPhone: to,
      content: text,
      templateName: templateName || null,
      tone: tone || null,
      sentAt: new Date(),
      status: 'SENT',
    }});

    // Atualizar charge como enviado (atualiza metadata)
    await this.prisma.charge.update({ where: { id: charge.id }, data: { updatedAt: new Date() } });

    return { ok: true, resp };
  }

  async markPaid(workspaceId: string, chargeId: string, paidAt?: Date) {
    const charge = await this.prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge || charge.workspaceId !== workspaceId) throw new NotFoundException('Cobrança não encontrada');
    const now = paidAt || new Date();
    await this.prisma.charge.update({ where: { id: chargeId }, data: { status: 'PAID', paidAt: now, recovered: true, recoveredAt: now } });
    return { ok: true };
  }
}
