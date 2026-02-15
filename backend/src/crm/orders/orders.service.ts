import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
  ) {}

  async listOrders(workspaceId: string) {
    return this.prisma.order.findMany({
      where: { workspaceId },
      include: {
        lead: true,
        items: { include: { product: true } },
        delivery: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(workspaceId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, workspaceId },
      include: {
        lead: true,
        items: { include: { product: true } },
        delivery: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido nao encontrado');
    }

    return order;
  }

  async createOrder(workspaceId: string, data: any) {
    if (!Array.isArray(data?.items) || data.items.length === 0) {
      throw new BadRequestException('Itens do pedido sao obrigatorios');
    }

    let leadId = data.leadId || null;
    let leadPhone: string | null = null;

    if (!leadId && data.phoneNumber) {
      const phoneNumber = String(data.phoneNumber);
      const lead = await this.prisma.lead.upsert({
        where: {
          workspaceId_phoneNumber: { workspaceId, phoneNumber },
        },
        update: {},
        create: {
          workspaceId,
          phoneNumber,
          name: phoneNumber,
          origin: 'order_created',
          optIn: true,
          optInDate: new Date(),
        },
      });
      leadId = lead.id;
      leadPhone = lead.phoneNumber;
    }

    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: leadId, workspaceId },
      });
      if (!lead) {
        throw new NotFoundException('Lead nao encontrado');
      }
      leadPhone = lead.phoneNumber;
    }

    const productIds = data.items.map((item: any) => item.productId);
    const products = (await this.prisma.product.findMany({
      where: { id: { in: productIds }, workspaceId },
    })) as Array<{
      id: string;
      unitPrice?: number | null;
      productType?: string | null;
      digitalUrl?: string | null;
    }>;

    if (products.length !== productIds.length) {
      throw new BadRequestException('Produto invalido na lista de itens');
    }

    const productMap = new Map<
      string,
      { id: string; unitPrice?: number | null; productType?: string | null; digitalUrl?: string | null }
    >(
      products.map((product) => [product.id, product]),
    );
    const items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      productType: 'DIGITAL' | 'PHYSICAL';
      digitalUrl: string | null;
    }> = data.items.map((item: any) => {
      const product = productMap.get(item.productId);
      const quantity = Number(item.quantity) || 0;
      if (!product || quantity <= 0) {
        throw new BadRequestException('Quantidade invalida nos itens');
      }
      const unitPrice =
        item.unitPrice !== undefined ? Number(item.unitPrice) || 0 : product.unitPrice || 0;
      const totalPrice = unitPrice * quantity;
      return {
        productId: product.id,
        quantity,
        unitPrice,
        totalPrice,
        productType: product.productType || 'PHYSICAL',
        digitalUrl: product.digitalUrl || null,
      };
    });

    const itemsForCreate = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    const totalAmount = items.reduce(
      (sum: number, item: { totalPrice: number }) => sum + item.totalPrice,
      0,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.productType === 'DIGITAL') {
          continue;
        }
        const inventory = await tx.inventoryItem.findUnique({
          where: { productId: item.productId },
        });
        if (inventory && inventory.quantity < item.quantity) {
          throw new BadRequestException('Estoque insuficiente');
        }
      }

      const order = await tx.order.create({
        data: {
          workspaceId,
          leadId,
          status: data.status || 'NEW',
          totalAmount,
          notes: data.notes || null,
          items: { create: itemsForCreate },
        },
        include: {
          lead: true,
          items: { include: { product: true } },
        },
      });

      await tx.delivery.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
          carrier: data.carrier || null,
          trackingCode: data.trackingCode || null,
          expectedAt: data.expectedAt ? new Date(data.expectedAt) : null,
        },
      });

      for (const item of items) {
        if (item.productType === 'DIGITAL') {
          continue;
        }
        await tx.inventoryItem.upsert({
          where: { productId: item.productId },
          update: {
            quantity: { decrement: item.quantity },
          },
          create: {
            workspaceId,
            productId: item.productId,
            quantity: 0,
            minStock: 0,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            workspaceId,
            productId: item.productId,
            orderId: order.id,
            type: 'OUT',
            quantity: item.quantity,
            reason: 'Pedido criado',
          },
        });
      }

      return order;
    });

    if (data.sendMessage !== false && leadPhone) {
      const digitalLinks = items
        .filter((item) => item.productType === 'DIGITAL' && item.digitalUrl)
        .map((item) => `\nAcesso digital: ${item.digitalUrl}`)
        .join('');
      const message =
        `Pedido criado!\nNumero: ${created.id}\nTotal: R$ ${totalAmount.toFixed(2)}` +
        digitalLinks;
      this.safeSendMessage(workspaceId, leadPhone, message);
    }

    return created;
  }

  async updateOrderStatus(workspaceId: string, orderId: string, data: any) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, workspaceId },
      include: { lead: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido nao encontrado');
    }

    const status = data.status || 'NEW';
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    if (data.sendMessage !== false && order.lead?.phoneNumber) {
      const message = `Atualizacao do pedido ${order.id}: ${this.formatStatus(status)}`;
      this.safeSendMessage(workspaceId, order.lead.phoneNumber, message);
    }

    return updated;
  }

  async updateDelivery(workspaceId: string, orderId: string, data: any) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, workspaceId },
      include: { lead: true, delivery: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido nao encontrado');
    }

    const status = data.status || order.delivery?.status || 'PENDING';
    const delivery = order.delivery
      ? await this.prisma.delivery.update({
          where: { id: order.delivery.id },
          data: {
            status,
            carrier: data.carrier ?? order.delivery.carrier,
            trackingCode: data.trackingCode ?? order.delivery.trackingCode,
            expectedAt: data.expectedAt ? new Date(data.expectedAt) : order.delivery.expectedAt,
            deliveredAt: status === 'DELIVERED' ? new Date() : order.delivery.deliveredAt,
          },
        })
      : await this.prisma.delivery.create({
          data: {
            orderId: order.id,
            status,
            carrier: data.carrier || null,
            trackingCode: data.trackingCode || null,
            expectedAt: data.expectedAt ? new Date(data.expectedAt) : null,
            deliveredAt: status === 'DELIVERED' ? new Date() : null,
          },
        });

    if (data.sendMessage !== false && order.lead?.phoneNumber) {
      const message = this.buildDeliveryMessage(order.id, status, delivery);
      this.safeSendMessage(workspaceId, order.lead.phoneNumber, message);
    }

    return delivery;
  }

  private buildDeliveryMessage(orderId: string, status: string, delivery: any) {
    const label = this.formatStatus(status);
    const tracking = delivery?.trackingCode ? `\nRastreio: ${delivery.trackingCode}` : '';
    const carrier = delivery?.carrier ? `\nTransportadora: ${delivery.carrier}` : '';
    return `Entrega do pedido ${orderId}: ${label}${carrier}${tracking}`;
  }

  private formatStatus(status: string) {
    const map: Record<string, string> = {
      NEW: 'Pedido criado',
      PACKING: 'Separando itens',
      SHIPPED: 'Enviado',
      OUT_FOR_DELIVERY: 'Saiu para entrega',
      DELIVERED: 'Entregue',
      CANCELED: 'Cancelado',
      PENDING: 'Aguardando envio',
      FAILED: 'Falha na entrega',
      RETURNED: 'Devolvido',
    };
    return map[status] || status;
  }

  private normalizeTarget(target: string) {
    if (!target) return '';
    if (target.includes('@')) {
      return target;
    }
    return target.replace(/\D/g, '');
  }

  private async safeSendMessage(workspaceId: string, to: string, text: string) {
    const target = this.normalizeTarget(to);
    if (!target) {
      this.logger.warn('Skipped send message: empty target');
      return;
    }
    try {
      await this.whatsAppService.sendText(workspaceId, target, text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send order message: ${message}`);
    }
  }
}
