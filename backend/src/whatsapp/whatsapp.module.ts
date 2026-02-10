import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppGateway } from './whatsapp.gateway';
import { WhatsAppWebQRProvider } from './providers/whatsapp-web-qr.provider';
import { WhatsAppCloudAPIProvider } from './providers/whatsapp-cloud-api.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppGateway,
    WhatsAppWebQRProvider,
    WhatsAppCloudAPIProvider,
  ],
  exports: [WhatsAppService, WhatsAppGateway],
})
export class WhatsAppModule {}
