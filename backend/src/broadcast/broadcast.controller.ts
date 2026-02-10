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
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastDto, UpdateBroadcastDto, AddBroadcastRecipientsDto, BroadcastQueryDto } from './dto/broadcast.dto';

@Controller('broadcasts')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private broadcastService: BroadcastService) {}

  /**
   * POST /broadcasts
   * Criar novo broadcast/disparador em massa
   */
  @Post()
  async createBroadcast(@Request() req: any, @Body() dto: CreateBroadcastDto) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.createBroadcast(workspaceId, dto);
  }

  /**
   * GET /broadcasts
   * Listar todos os broadcasts
   */
  @Get()
  async listBroadcasts(@Request() req: any, @Query() query: BroadcastQueryDto) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.listBroadcasts(
      workspaceId,
      query.status,
      query.limit || 20,
      query.offset || 0,
    );
  }

  /**
   * GET /broadcasts/:id
   * Obter detalhes de um broadcast
   */
  @Get(':id')
  async getBroadcast(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.getBroadcast(workspaceId, broadcastId);
  }

  /**
   * PATCH /broadcasts/:id
   * Atualizar broadcast
   */
  @Patch(':id')
  async updateBroadcast(
    @Request() req: any,
    @Param('id') broadcastId: string,
    @Body() dto: UpdateBroadcastDto,
  ) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.updateBroadcast(workspaceId, broadcastId, dto);
  }

  /**
   * POST /broadcasts/:id/recipients
   * Adicionar destinatários (contatos 1:1)
   */
  @Post(':id/recipients')
  async addRecipients(
    @Request() req: any,
    @Param('id') broadcastId: string,
    @Body() dto: AddBroadcastRecipientsDto,
  ) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.addRecipients(workspaceId, broadcastId, dto);
  }

  /**
   * POST /broadcasts/:id/groups
   * Adicionar grupos ao broadcast (envio para grupo inteiro)
   */
  @Post(':id/groups')
  async addGroupRecipients(
    @Request() req: any,
    @Param('id') broadcastId: string,
    @Body() body: { groupIds: string[] },
  ) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.addGroupRecipients(workspaceId, broadcastId, body.groupIds);
  }

  /**
   * POST /broadcasts/:id/start
   * Iniciar/executar broadcast
   */
  @Post(':id/start')
  async startBroadcast(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.startBroadcast(workspaceId, broadcastId);
  }

  /**
   * POST /broadcasts/:id/pause
   * Pausar broadcast em execução
   */
  @Post(':id/pause')
  async pauseBroadcast(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.pauseBroadcast(workspaceId, broadcastId);
  }

  /**
   * POST /broadcasts/:id/resume
   * Retomar broadcast pausado
   */
  @Post(':id/resume')
  async resumeBroadcast(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.resumeBroadcast(workspaceId, broadcastId);
  }

  /**
   * DELETE /broadcasts/:id
   * Deletar broadcast
   */
  @Delete(':id')
  async deleteBroadcast(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.deleteBroadcast(workspaceId, broadcastId);
  }

  /**
   * GET /broadcasts/:id/statistics
   * Obter relatório e estatísticas do broadcast
   */
  @Get(':id/statistics')
  async getBroadcastStatistics(@Request() req: any, @Param('id') broadcastId: string) {
    const workspaceId = req.user.workspaceId;
    return this.broadcastService.getBroadcastStatistics(workspaceId, broadcastId);
  }
}
