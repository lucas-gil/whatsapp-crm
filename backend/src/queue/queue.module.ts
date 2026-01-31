import { Module } from '@nestjs/common';
import { QueueService, BroadcastProducer, AIProducer } from './queue.service';

@Module({
  providers: [QueueService, BroadcastProducer, AIProducer],
  exports: [QueueService, BroadcastProducer, AIProducer],
})
export class QueueModule {}
