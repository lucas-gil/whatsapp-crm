import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule],
  controllers: [BroadcastController, TemplateController],
  providers: [BroadcastService, TemplateService],
  exports: [BroadcastService, TemplateService],
})
export class BroadcastModule {}
