//
import { Controller, Post, Body, Param, Get, Query, Put, Request } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private service: BillingService) {}

  @Post('clients')
  async createClient(@Request() req: any, @Body() body: any) {
    // Usa sempre o workspaceId do usuário autenticado
    const workspaceId = req.user.workspaceId;
    return this.service.createClient(workspaceId, body);
  }

  @Get('clients')
  async listClients(@Query('workspaceId') workspaceId: string, @Query('q') q?: string, @Query('limit') limit = '50', @Query('offset') offset = '0') {
    return this.service.listClients(workspaceId, q, Number(limit), Number(offset));
  }

  @Post('clients/:clientId/charges')
  async createCharge(@Param('clientId') clientId: string, @Body() body: any) {
    return this.service.createCharge(body.workspaceId, clientId, body);
  }

  @Get('charges')
  async listCharges(@Query('workspaceId') workspaceId: string, @Query() query: any) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    return this.service.listCharges(workspaceId, filter, Number(query.limit || 50), Number(query.offset || 0));
  }

  @Post('charges/:chargeId/send')
  async sendCharge(@Param('chargeId') chargeId: string, @Body() body: any) {
    return this.service.sendChargeMessage(body.workspaceId, chargeId, body.text, body.tone, body.templateName);
  }

  @Put('charges/:chargeId/mark-paid')
  async markPaid(@Param('chargeId') chargeId: string, @Body() body: any) {
    return this.service.markPaid(body.workspaceId, chargeId, body.paidAt ? new Date(body.paidAt) : undefined);
  }

  @Post('clients/delete-all')
  async deleteAllClients(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.service.deleteAllClientsAndLeads(workspaceId);
  }
}
