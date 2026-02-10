import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('crm/leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  async listLeads(
    @Query('search') search: string,
    @Query('stage') stage: string,
    @Query('optIn') optIn: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    // Use default workspace (no authentication required)
    const defaultWorkspaceId = 'default';
    return this.leadsService.listLeads(defaultWorkspaceId, {
      search,
      pipelineStage: stage,
      optIn: optIn === 'true',
      page: parseInt(page || '0'),
      limit: parseInt(limit || '50'),
    });
  }

  @Post()
  async createLead(@Body() data: any) {
    const defaultWorkspaceId = 'default';
    return this.leadsService.createLead(defaultWorkspaceId, data);
  }

  @Get(':id')
  async getLead(@Param('id') id: string) {
    const defaultWorkspaceId = 'default';
    return this.leadsService.getLead(defaultWorkspaceId, id);
  }

  @Put(':id')
  async updateLead(@Param('id') id: string, @Body() data: any) {
    const defaultWorkspaceId = 'default';
    return this.leadsService.updateLead(defaultWorkspaceId, id, data);
  }

  @Post(':id/opt-out')
  async optOut(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const defaultWorkspaceId = 'default';
    return this.leadsService.optOutLead(defaultWorkspaceId, id, reason);
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
