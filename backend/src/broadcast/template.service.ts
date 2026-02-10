import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Criar novo template de mensagem
   */
  async createTemplate(workspaceId: string, dto: CreateTemplateDto) {
    const existingTemplate = await this.prisma.template.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: dto.name,
        },
      },
    });

    if (existingTemplate) {
      throw new BadRequestException('Template com esse nome já existe');
    }

    const template = await this.prisma.template.create({
      data: {
        workspaceId,
        name: dto.name,
        category: dto.category,
        content: dto.content,
        variables: dto.variables || [],
        attachmentUrl: dto.attachmentUrl,
        isActive: dto.isActive !== false,
      },
    });

    return template;
  }

  /**
   * Listar templates
   */
  async listTemplates(
    workspaceId: string,
    category?: string,
    isActive?: boolean,
    search?: string,
  ) {
    const where: any = { workspaceId };

    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const templates = await this.prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates;
  }

  /**
   * Obter um template específico
   */
  async getTemplate(workspaceId: string, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundException('Template não encontrado');
    }

    return template;
  }

  /**
   * Atualizar template
   */
  async updateTemplate(workspaceId: string, templateId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundException('Template não encontrado');
    }

    // Validar unicidade do nome se estiver mudando
    if (dto.name && dto.name !== template.name) {
      const existingTemplate = await this.prisma.template.findUnique({
        where: {
          workspaceId_name: {
            workspaceId,
            name: dto.name,
          },
        },
      });

      if (existingTemplate) {
        throw new BadRequestException('Outro template com esse nome já existe');
      }
    }

    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        name: dto.name,
        category: dto.category,
        content: dto.content,
        variables: dto.variables,
        attachmentUrl: dto.attachmentUrl,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Deletar template
   */
  async deleteTemplate(workspaceId: string, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundException('Template não encontrado');
    }

    await this.prisma.template.delete({
      where: { id: templateId },
    });

    return { message: 'Template deletado com sucesso' };
  }

  /**
   * Renderizar template com variáveis
   * Substitui {{variavel}} pelos valores
   */
  async renderTemplate(
    workspaceId: string,
    templateId: string,
    variables?: Record<string, string>,
  ) {
    const template = await this.getTemplate(workspaceId, templateId);

    let content = template.content;

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    return {
      templateId,
      name: template.name,
      originalContent: template.content,
      renderedContent: content,
      usedVariables: variables || {},
    };
  }

  /**
   * Listar categorias de templates disponíveis
   */
  async getCategories(workspaceId: string) {
    const categories = await this.prisma.template.findMany({
      where: { workspaceId },
      distinct: ['category'],
      select: { category: true },
    });

    return categories.map(c => c.category);
  }
}
