import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto } from './dto/template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  /**
   * POST /templates
   * Criar novo template de mensagem
   */
  @Post()
  async createTemplate(@Request() req: any, @Body() dto: CreateTemplateDto) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.createTemplate(workspaceId, dto);
  }

  /**
   * GET /templates
   * Listar todos os templates com filtros opcionais
   */
  @Get()
  async listTemplates(@Request() req: any, @Query() query: TemplateQueryDto) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.listTemplates(
      workspaceId,
      query.category,
      query.isActive,
      query.search,
    );
  }

  /**
   * GET /templates/categories
   * Listar todas as categorias de templates disponíveis
   */
  @Get('categories')
  async getCategories(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.getCategories(workspaceId);
  }

  /**
   * GET /templates/:id
   * Obter um template específico
   */
  @Get(':id')
  async getTemplate(@Request() req: any, @Param('id') templateId: string) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.getTemplate(workspaceId, templateId);
  }

  /**
   * PATCH /templates/:id
   * Atualizar template
   */
  @Patch(':id')
  async updateTemplate(
    @Request() req: any,
    @Param('id') templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.updateTemplate(workspaceId, templateId, dto);
  }

  /**
   * DELETE /templates/:id
   * Deletar template
   */
  @Delete(':id')
  async deleteTemplate(@Request() req: any, @Param('id') templateId: string) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.deleteTemplate(workspaceId, templateId);
  }

  /**
   * POST /templates/:id/render
   * Renderizar template com variáveis substituídas
   * Body: { "variables": { "nome": "João", "cidade": "São Paulo" } }
   */
  @Post(':id/render')
  async renderTemplate(
    @Request() req: any,
    @Param('id') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const workspaceId = req.user.workspaceId;
    return this.templateService.renderTemplate(workspaceId, templateId, body.variables);
  }
}
