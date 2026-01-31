import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

@Controller('crm/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  async listLeads(
    @Query('search') search: string,
    @Query('stage') stage: string,
    @Query('optIn') optIn: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    return this.leadsService.listLeads(req.user.workspaceId, {
      search,
      pipelineStage: stage,
      optIn: optIn === 'true',
      page: parseInt(page || '0'),
      limit: parseInt(limit || '50'),
    });
  }

  @Post()
  async createLead(@Body() data: any, @Request() req: any) {
    return this.leadsService.createLead(req.user.workspaceId, data);
  }

  @Get(':id')
  async getLead(@Param('id') id: string, @Request() req: any) {
    return this.leadsService.getLead(req.user.workspaceId, id);
  }

  @Put(':id')
  async updateLead(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.leadsService.updateLead(req.user.workspaceId, id, data);
  }

  @Post(':id/opt-out')
  async optOut(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.leadsService.optOutLead(req.user.workspaceId, id, reason);
  }

  @Post(':id/tags/:tagId')
  async addTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.leadsService.addTag(id, tagId);
  }

  @Delete(':id/tags/:tagId')
  async removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.leadsService.removeTag(id, tagId);
  }
}
