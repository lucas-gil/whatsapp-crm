import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma/prisma.module';
import { LeadsService } from './leads/leads.service';
import { LeadsController } from './leads/leads.controller';
import { ConversationsService } from './conversations/conversations.service';
import { ConversationsController } from './conversations/conversations.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsController, ConversationsController],
  providers: [LeadsService, ConversationsService],
  exports: [LeadsService, ConversationsService],
})
export class CrmModule {}
