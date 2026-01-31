import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Logger } from '../common/utils/logger.util';

interface QueueConfig {
  name: string;
  handler: (job: any) => Promise<void>;
}

/**
 * Serviço de gerenciamento de filas com BullMQ
 */
@Injectable()
export class QueueService {
  private logger = new Logger('QueueService');
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisUrl: string;

  constructor(private configService: ConfigService) {
    this.redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
  }

  registerQueue(config: QueueConfig) {
    // Criar fila
    const queue = new Queue(config.name, {
      connection: { url: this.redisUrl },
    });

    // Criar worker
    const worker = new Worker(config.name, config.handler, {
      connection: { url: this.redisUrl },
      concurrency: 5,
    });

    // Listeners
    worker.on('completed', (job) => {
      this.logger.info(`✅ Job ${job.id} concluído`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`❌ Job ${job.id} falhou: ${err.message}`);
    });

    this.queues.set(config.name, queue);
    this.workers.set(config.name, worker);

    this.logger.info(`Fila registrada: ${config.name}`);
  }

  async enqueueJob(queueName: string, data: any, options?: any) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Fila ${queueName} não registrada`);
    }

    const job = await queue.add(queueName, data, {
      attempts: options?.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });

    this.logger.info(`Job enfileirado: ${job.id} em ${queueName}`);
    return job;
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress();

    return { id: job.id, state, progress };
  }

  async closeQueues() {
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.info(`Fila fechada: ${name}`);
    }

    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.info(`Worker fechado: ${name}`);
    }
  }
}

@Injectable()
export class BroadcastProducer {
  constructor(private queueService: QueueService) {}

  async enqueueBroadcast(broadcastId: string, recipientBatch: any[]) {
    return this.queueService.enqueueJob('broadcast', {
      broadcastId,
      recipients: recipientBatch,
    });
  }
}

@Injectable()
export class AIProducer {
  constructor(private queueService: QueueService) {}

  async enqueueAIProcessing(messageId: string, context: any) {
    return this.queueService.enqueueJob('ai-processing', {
      messageId,
      context,
    });
  }
}
