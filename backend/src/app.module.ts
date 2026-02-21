import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from './config/validation.schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LicenseModule } from './license/license.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { CrmModule } from './crm/crm.module';
import { GeminiModule } from './gemini/gemini.module';
import { QueueModule } from './queue/queue.module';
import { AdminModule } from './admin/admin.module';
import { BillingModule } from './billing/billing.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { PollsModule } from './polls/polls.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),
    PrismaModule,
    AuthModule,
    LicenseModule,
    WhatsAppModule,
    CrmModule,
    GeminiModule,
    QueueModule,
    AdminModule,
    BillingModule,
    WorkspaceModule,
    BroadcastModule,
    PollsModule,
    // settings
    require('./settings/settings.module').SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
