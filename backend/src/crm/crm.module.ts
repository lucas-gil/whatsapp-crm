import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { LeadsService } from './leads/leads.service';
import { LeadsController } from './leads/leads.controller';
import { ConversationsService } from './conversations/conversations.service';
import { ConversationsController } from './conversations/conversations.controller';
import { ProductsService } from './products/products.service';
import { ProductsController } from './products/products.controller';
import { InventoryService } from './inventory/inventory.service';
import { InventoryController } from './inventory/inventory.controller';
import { OrdersService } from './orders/orders.service';
import { OrdersController } from './orders/orders.controller';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  controllers: [
    LeadsController,
    ConversationsController,
    ProductsController,
    InventoryController,
    OrdersController,
  ],
  providers: [
    LeadsService,
    ConversationsService,
    ProductsService,
    InventoryService,
    OrdersService,
  ],
  exports: [
    LeadsService,
    ConversationsService,
    ProductsService,
    InventoryService,
    OrdersService,
  ],
})
export class CrmModule {}
