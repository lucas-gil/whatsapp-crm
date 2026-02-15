import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async listInventory(workspaceId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { workspaceId },
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async adjustStock(workspaceId: string, data: any) {
    if (!data?.productId) {
      throw new BadRequestException('productId e obrigatorio');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, workspaceId },
    });
    if (!product) {
      throw new NotFoundException('Produto nao encontrado');
    }

    if (product.productType === 'DIGITAL') {
      throw new BadRequestException('Produto digital nao possui estoque');
    }

    const delta = Number(data.quantity) || 0;
    if (!delta) {
      throw new BadRequestException('quantity deve ser diferente de 0');
    }

    const inventory = await this.prisma.inventoryItem.upsert({
      where: { productId: data.productId },
      update: {
        quantity: { increment: delta },
      },
      create: {
        workspaceId,
        productId: data.productId,
        quantity: delta,
        minStock: 0,
      },
    });

    const movementType = data.type || (delta >= 0 ? 'IN' : 'OUT');
    await this.prisma.inventoryMovement.create({
      data: {
        workspaceId,
        productId: data.productId,
        type: movementType,
        quantity: Math.abs(delta),
        reason: data.reason || null,
      },
    });

    return inventory;
  }
}
