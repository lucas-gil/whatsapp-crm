import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { OrdersService } from './orders.service';

@Controller('crm/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  async listOrders(@Request() req: any) {
    return this.ordersService.listOrders(req.user.workspaceId);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Request() req: any) {
    return this.ordersService.getOrder(req.user.workspaceId, id);
  }

  @Post()
  async createOrder(@Body() data: any, @Request() req: any) {
    return this.ordersService.createOrder(req.user.workspaceId, data);
  }

  @Put(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.ordersService.updateOrderStatus(req.user.workspaceId, id, data);
  }

  @Put(':id/delivery')
  async updateDelivery(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.ordersService.updateDelivery(req.user.workspaceId, id, data);
  }
}
