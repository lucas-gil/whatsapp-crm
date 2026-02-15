import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { InventoryService } from './inventory.service';

@Controller('crm/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  async listInventory(@Request() req: any) {
    return this.inventoryService.listInventory(req.user.workspaceId);
  }

  @Post('adjust')
  async adjustStock(@Body() data: any, @Request() req: any) {
    return this.inventoryService.adjustStock(req.user.workspaceId, data);
  }
}
