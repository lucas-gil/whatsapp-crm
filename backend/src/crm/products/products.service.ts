import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async listProducts(workspaceId: string) {
    return this.prisma.product.findMany({
      where: { workspaceId },
      include: { inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(workspaceId: string, data: any) {
    if (!data?.name) {
      throw new BadRequestException('Nome do produto e obrigatorio');
    }

    const unitPrice = Number(data.unitPrice) || 0;
    const productType = data.productType === 'DIGITAL' ? 'DIGITAL' : 'PHYSICAL';
    const product = await this.prisma.product.create({
      data: {
        workspaceId,
        name: data.name,
        sku: data.sku || null,
        description: data.description || null,
        unitPrice,
        productType,
        digitalUrl: data.digitalUrl || null,
        isActive: data.isActive !== false,
      },
    });

    const initialStock = Number(data.initialStock) || 0;
    const minStock = Number(data.minStock) || 0;
    if (productType === 'PHYSICAL' && (initialStock || minStock)) {
      await this.prisma.inventoryItem.create({
        data: {
          workspaceId,
          productId: product.id,
          quantity: Math.max(0, initialStock),
          minStock: Math.max(0, minStock),
        },
      });
    }

    return product;
  }

  async updateProduct(workspaceId: string, productId: string, data: any) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Produto nao encontrado');
    }

    const productType = data.productType ? (data.productType === 'DIGITAL' ? 'DIGITAL' : 'PHYSICAL') : undefined;
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name ?? undefined,
        sku: data.sku ?? undefined,
        description: data.description ?? undefined,
        unitPrice: data.unitPrice !== undefined ? Number(data.unitPrice) || 0 : undefined,
        productType,
        digitalUrl: data.digitalUrl !== undefined ? data.digitalUrl || null : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });
  }

  async deleteProduct(workspaceId: string, productId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Produto nao encontrado');
    }

    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true };
  }
}
