import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingJobs } from './billing.jobs';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule, WhatsAppModule],
  controllers: [BillingController],
  providers: [BillingService, BillingJobs],
  exports: [BillingService],
})
export class BillingModule {}
import { Module, OnModuleInit } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule implements OnModuleInit {
  constructor(private billingService: BillingService) {}
  async onModuleInit() {
    // Executa a limpeza automática a cada 24h
    setInterval(() => {
      this.billingService.autoDeleteOldClientsAndLeads();
    }, 24 * 60 * 60 * 1000);
  }
}
