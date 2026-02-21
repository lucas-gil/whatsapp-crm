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
